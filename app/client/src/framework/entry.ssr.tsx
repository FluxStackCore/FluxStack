// ENTRY SSR do FluxStack. Payload RSC -> HTML, com bootstrap do client.
import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr'
import { renderToReadableStream } from 'react-dom/server.edge'

export async function handleSsr(rscStream: ReadableStream) {
  const root = await createFromReadableStream(rscStream)
  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent('index')
  return renderToReadableStream(root, { bootstrapScriptContent })
}
