// ENTRY SSR (ambiente "ssr"). Payload RSC -> HTML, com bootstrap pro client.
import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr'
import { renderToReadableStream } from 'react-dom/server.edge'

export async function handleSsr(rscStream: ReadableStream) {
  const root = await createFromReadableStream(rscStream)

  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent('index')

  const htmlStream = renderToReadableStream(root, { bootstrapScriptContent })
  return htmlStream
}
