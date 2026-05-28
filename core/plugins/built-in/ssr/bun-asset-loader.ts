/**
 * Bun asset loader para SSR — alinha imports de asset com o Vite.
 *
 * Problema: no client, o Vite resolve `import logo from '...x.svg'` para a URL
 * `/src/assets/x.svg`. No server, o Bun resolve o MESMO import para o caminho
 * de arquivo absoluto (C:\...\x.svg). Strings diferentes no atributo src/href
 * → hydration mismatch (o React descarta o HTML do server e re-renderiza tudo).
 *
 * Solução: registrar um plugin no Bun que, ao carregar um asset, exporta a
 * MESMA URL que o Vite geraria — relativa ao root do client (app/client).
 * Em dev essa URL é servida pelo Vite; em prod, pelos assets buildados.
 *
 * Registrar via bunfig.toml [run].preload ANTES de qualquer import do app.
 */

import { plugin } from 'bun'
import { sep } from 'path'

/** Root do client onde o Vite baseia as URLs (app/client) */
const CLIENT_ROOT = 'app' + sep + 'client' + sep

/** Extensões que o Vite trata como asset-URL (não código) */
const ASSET_RE = /\.(svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|mp4|webm|mp3|wav)$/i

plugin({
  name: 'ssr-asset-url',
  setup(build) {
    build.onLoad({ filter: ASSET_RE }, (args) => {
      // args.path é absoluto. Converter para a URL que o Vite usa:
      // .../app/client/src/assets/x.svg  ->  /src/assets/x.svg
      const idx = args.path.replace(/\//g, sep).indexOf(CLIENT_ROOT)
      let url: string
      if (idx !== -1) {
        const rel = args.path.slice(idx + CLIENT_ROOT.length).replaceAll(sep, '/')
        url = '/' + rel
      } else {
        // fallback: usa o basename
        url = '/' + args.path.split(/[\\/]/).pop()
      }
      return {
        exports: { default: url },
        loader: 'object',
      }
    })
  },
})
