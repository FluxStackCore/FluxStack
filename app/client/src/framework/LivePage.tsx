'use client'
// LivePage — wrapper de página que usa Live Components.
//
// Esconde a cerimônia: cabeçalho (server-friendly) + LiveComponentsProvider +
// ClientOnly. O dev só escreve <LivePage><MeuDemoLive/></LivePage> e os Live
// Components funcionam (placeholder no SSR, conectam no client). O Provider
// compartilha a conexão única via connectionPool (keep-alive no entry.browser).
import type { ReactNode } from 'react'
import { LiveComponentsProvider } from '@/core/client'
import { ClientOnly } from './ClientOnly'
import { ParamsProvider } from './params'
import type { RouteParams } from './routes'

function Loading() {
  return (
    <div className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] p-12 text-sm text-gray-500">
      <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-theme" />
      Conectando ao Live…
    </div>
  )
}

export function LivePage({
  title,
  description,
  params = {},
  children,
}: {
  title?: string
  description?: string
  /** params da rota — repasse o `params` que a página recebeu, p/ useParams() funcionar */
  params?: RouteParams
  children: ReactNode
}) {
  return (
    <div className="relative min-h-[calc(100vh-57px)] px-4 py-10">
      <div className="absolute inset-0 app-grid-bg opacity-70" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        {title && (
          <div>
            <h1 className="text-3xl font-semibold text-white">{title}</h1>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
        )}
        <ClientOnly fallback={<Loading />}>
          <ParamsProvider params={params}>
            <LiveComponentsProvider autoConnect reconnectInterval={1000} maxReconnectAttempts={5} heartbeatInterval={30000}>
              {children}
            </LiveComponentsProvider>
          </ParamsProvider>
        </ClientOnly>
      </div>
    </div>
  )
}
