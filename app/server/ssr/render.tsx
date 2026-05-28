/**
 * FluxStack SSR — PoC de renderização server-side de React
 *
 * Prova de conceito do "Caminho A" (react-router em modo SSR):
 * renderiza uma árvore React no servidor com renderToString + StaticRouter,
 * devolvendo HTML pronto para o first paint. O client depois faz hydrateRoot.
 *
 * Esta é a primitiva que o react-router 7 (framework mode) usa por baixo.
 * Mantemos manual no PoC para não tomar controle do server HTTP do FluxStack.
 */

import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { SsrDemo } from './SsrDemo'

export interface RenderResult {
  html: string
  /** marcação inicial serializável para hydration (props/estado) */
  bootstrapData: Record<string, unknown>
}

/**
 * Renderiza o componente de demonstração SSR-safe para uma URL.
 * Retorna o HTML do corpo + dados de bootstrap para o client hidratar.
 */
export function renderSsrDemo(url: string, data: { renderedAt: string; counter: number }): RenderResult {
  const html = renderToString(
    <StaticRouter location={url}>
      <SsrDemo renderedAt={data.renderedAt} counter={data.counter} />
    </StaticRouter>
  )

  return {
    html,
    bootstrapData: { renderedAt: data.renderedAt, counter: data.counter },
  }
}

/**
 * Monta o documento HTML completo com o markup pré-renderizado embutido
 * e o script de hydration. Em produção o script viria do build do Vite.
 */
export function renderDocument(result: RenderResult): string {
  const dataJson = JSON.stringify(result.bootstrapData).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FluxStack SSR PoC</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0a0a0a; color:#eee; margin:0; padding:2rem; }
    .badge { display:inline-block; padding:.25rem .6rem; border-radius:.5rem; font-size:.8rem; }
    .ssr { background:#16331f; color:#7fffa0; }
    .hydrated { background:#1f2937; color:#93c5fd; }
    button { padding:.5rem 1rem; border-radius:.5rem; border:1px solid #333; background:#1a1a1a; color:#eee; cursor:pointer; }
  </style>
</head>
<body>
  <div id="ssr-root">${result.html}</div>
  <script>window.__SSR_DATA__ = ${dataJson};</script>
  <!-- Em produção: <script type="module" src="/assets/ssr-client.js"></script> -->
  <p style="margin-top:2rem;color:#666;font-size:.85rem">
    Este HTML foi renderizado no servidor (Bun + Elysia) com renderToString.
    Veja "view-source" — o conteúdo já vem pronto, sem esperar JS.
  </p>
</body>
</html>`
}
