/**
 * Renderer SSR do app FluxStack — injetado no plugin SSR do core.
 *
 * Renderiza o AppShell (versão SSR-safe do site, SEM LiveComponentsProvider)
 * para a URL pedida. Registrado no boot via registerSsrRenderer().
 *
 * Importante: AppShell NÃO importa @fluxstack/live-react, então não há o
 * problema de dual-React no backend. LiveComponents são ilhas client.
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AppShell } from '@client/src/AppShell'
import { registerSsrRenderer, type SsrRenderInput } from '@core/plugins/built-in/ssr/registry'

export function installAppSsrRenderer(): void {
  registerSsrRenderer((input: SsrRenderInput) => {
    const html = renderToString(
      <StaticRouter location={input.url}>
        <AppShell />
      </StaticRouter>
    )
    return { html }
  })
}
