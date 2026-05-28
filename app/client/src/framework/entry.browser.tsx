// ENTRY BROWSER do FluxStack. Busca o payload RSC e hidrata.
import { createFromReadableStream } from '@vitejs/plugin-rsc/browser'
import { hydrateRoot } from 'react-dom/client'

async function main() {
  const rscResponse = await fetch(window.location.href + '.rsc')
  const root = await createFromReadableStream(rscResponse.body)
  hydrateRoot(document, root)
}

main()
