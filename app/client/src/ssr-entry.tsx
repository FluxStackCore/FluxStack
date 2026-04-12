/**
 * SSR Entry Point
 *
 * Imports the real App component and renders it server-side.
 * No separate SSR app tree — same component runs on server and client.
 */

import { StrictMode } from 'react'
import { StaticRouter } from 'react-router'
import App from './App'

export function createServerElement(url: string) {
  return (
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>
  )
}
