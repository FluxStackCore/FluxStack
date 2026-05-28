// ENTRY SSR do FluxStack. Payload RSC -> HTML, com bootstrap do client.
import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr'
import { renderToReadableStream } from 'react-dom/server.edge'
import type { ReactNode } from 'react'

export async function handleSsr(rscStream: ReadableStream) {
  // payload RSC desserializado é uma árvore React (tipado como unknown).
  const root = (await createFromReadableStream(rscStream)) as ReactNode
  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent('index')
  return renderToReadableStream(root, { bootstrapScriptContent })
}
