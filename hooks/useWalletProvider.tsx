import { useCallback, useEffect, useState } from 'react'
import { ethers, Wallet } from 'ethers'
import Web3Modal, { IProviderOptions, providers } from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import WalletLink from 'walletlink'
import { useRouter } from 'next/router'
import { useAppStore } from '../store/app'

// Ethereum mainnet
const ETH_CHAIN_ID = 1

const cachedLookupAddress = new Map<string, string | undefined>()
const cachedResolveName = new Map<string, string | undefined>()
const cachedGetAvatarUrl = new Map<string, string | undefined>()

function getInfuraId() {
  return process.env.NEXT_PUBLIC_INFURA_ID || 'c518355f44bd45709cf0d42567d7bdb4'
}

const useWalletProvider = () => {
  const [provider, setProvider] = useState<ethers.providers.InfuraProvider>()
  const [web3Modal, setWeb3Modal] = useState<Web3Modal>()
  const address = useAppStore((state) => state.address)
  const setAddress = useAppStore((state) => state.setAddress)
  const setSigner = useAppStore((state) => state.setSigner)
  const router = useRouter()

  const resolveName = useCallback(
    async (name: string) => {
      if (cachedResolveName.has(name)) {
        return cachedResolveName.get(name)
      }
      const { chainId } = (await provider?.getNetwork()) || {}

      if (Number(chainId) !== ETH_CHAIN_ID) {
        return undefined
      }
      const address = (await provider?.resolveName(name)) || undefined
      cachedResolveName.set(name, address)
      return address
    },
    [provider]
  )

  const lookupAddress = useCallback(
    async (address: string) => {
      if (cachedLookupAddress.has(address)) {
        return cachedLookupAddress.get(address)
      }
      const { chainId } = (await provider?.getNetwork()) || {}

      if (Number(chainId) !== ETH_CHAIN_ID) {
        return undefined
      }

      const name = (await provider?.lookupAddress(address)) || undefined
      cachedLookupAddress.set(address, name)
      return name
    },
    [provider]
  )

  const getAvatarUrl = useCallback(
    async (name: string) => {
      if (cachedGetAvatarUrl.has(name)) {
        return cachedGetAvatarUrl.get(name)
      }
      const avatarUrl = (await provider?.getAvatar(name)) || undefined
      cachedGetAvatarUrl.set(name, avatarUrl)
      return avatarUrl
    },
    [provider]
  )

  // Note, this triggers a re-render on acccount change and on diconnect.
  const disconnect = useCallback(() => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('xmtp')) {
        localStorage.removeItem(key)
      }
    })
    setSigner(undefined)
    setAddress(undefined)
    router.push('/')
  }, [router, web3Modal])

  const handleAccountsChanged = useCallback(() => {
    disconnect()
  }, [disconnect])

  const connect = useCallback(async () => {
    try {
      if (!address) {
        const newSigner = Wallet.createRandom()
        setSigner(newSigner)
        setAddress(newSigner.address)
        return newSigner
      }
    } catch (e) {
      // TODO: better error handling/surfacing here.
      // Note that web3Modal.connect throws an error when the user closes the
      // modal, as "User closed modal"
      console.log('error', e)
    }
  }, [])

  useEffect(() => {
    const infuraId = getInfuraId()
    const providerOptions: IProviderOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId,
        },
      },
    }
    if (
      !window.ethereum ||
      (window.ethereum && !window.ethereum.isCoinbaseWallet)
    ) {
      providerOptions.walletlink = {
        package: WalletLink,
        options: {
          appName: 'Chat via XMTP',
          infuraId,
          // darkMode: false,
        },
      }
    }
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      providerOptions['custom-metamask'] = {
        display: {
          logo: providers.METAMASK.logo,
          name: 'Install MetaMask',
          description: 'Connect using browser wallet',
        },
        package: {},
        connector: async () => {
          window.open('https://metamask.io')
          // throw new Error("MetaMask not installed");
        },
      }
    }
    setWeb3Modal(new Web3Modal({ cacheProvider: true, providerOptions }))
  }, [])

  useEffect(() => {
    if (!web3Modal) {
      return
    }
    const initCached = async () => {
      try {
        const cachedProviderJson = localStorage.getItem(
          'WEB3_CONNECT_CACHED_PROVIDER'
        )
        if (!cachedProviderJson) {
          return
        }
        const cachedProviderName = JSON.parse(cachedProviderJson)
        const instance = await web3Modal.connectTo(cachedProviderName)
        if (!instance) {
          return
        }
        instance.on('accountsChanged', handleAccountsChanged)
        const newSigner = provider?.getSigner()
        setSigner(newSigner)
        setAddress(await newSigner?.getAddress())
      } catch (e) {
        console.error(e)
      }
    }
    initCached()
  }, [web3Modal])

  useEffect(() => {
    if (!provider) {
      setProvider(new ethers.providers.InfuraProvider('mainnet', getInfuraId()))
      connect()
    }
  }, [provider])

  return {
    resolveName,
    lookupAddress,
    getAvatarUrl,
    connect,
    disconnect,
  }
}

export default useWalletProvider
