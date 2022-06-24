import '../styles/globals.css'
import type { AppProps } from 'next/app'

function AppWrapper({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

export default AppWrapper
