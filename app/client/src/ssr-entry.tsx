/**
 * SSR Entry Point
 *
 * Creates the server-safe React element tree for a given URL.
 * Uses StaticRouter for server-side routing.
 */

import { StrictMode } from 'react'
import { StaticRouter } from 'react-router'
import { SSRApp } from './ssr-app'

/**
 * Create the React element tree for server-side rendering.
 */
export function createServerElement(url: string) {
  return (
    <StrictMode>
      <StaticRouter location={url}>
        <SSRApp />
      </StaticRouter>
    </StrictMode>
  )
}
