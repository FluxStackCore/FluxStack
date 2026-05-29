/**
 * FluxStack SSR — Renderer Registry
 *
 * Inversão de dependência: o CORE (framework) não conhece o App do usuário.
 * O app registra sua função de render (que importa o AppShell client) aqui,
 * e o plugin SSR a consome. Assim o core fica agnóstico ao React do app.
 */

export interface SsrRenderInput {
  /** Caminho da rota a renderizar (ex: '/', '/counter') */
  url: string
  /** Headers da request original (útil para cookies/auth no futuro) */
  headers: Record<string, string>
}

export interface SsrRenderOutput {
  /** HTML do corpo do app (vai dentro de <div id="root">) */
  html: string
  /** Status HTTP (default 200; use 404 para rota não encontrada) */
  status?: number
  /** Dados serializáveis injetados como window.__SSR_DATA__ para hydration */
  bootstrapData?: Record<string, unknown>
  /** <head> extra opcional (meta tags, title dinâmico) */
  headTags?: string
}

export type SsrRenderer = (input: SsrRenderInput) => SsrRenderOutput | Promise<SsrRenderOutput>

let registeredRenderer: SsrRenderer | null = null

/** O app chama isto no boot para registrar seu renderer (AppShell). */
export function registerSsrRenderer(renderer: SsrRenderer): void {
  registeredRenderer = renderer
}

export function getSsrRenderer(): SsrRenderer | null {
  return registeredRenderer
}
