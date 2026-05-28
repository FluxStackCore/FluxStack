// Tipos da extensão `import.meta.viteRsc` do @vitejs/plugin-rsc.
// O plugin injeta essas APIs em build/dev, mas os tipos nem sempre são
// captados pelo tsconfig do app — declaramos aqui para o type-check passar.
import type { ReactNode } from 'react'

declare global {
  interface ImportMeta {
    readonly viteRsc: {
      /** Carrega um módulo de outro ambiente (ex: 'ssr', 'index'). */
      loadModule<T = unknown>(environment: string, entry: string): Promise<T>
      /** Conteúdo JS do bootstrap do client entry (para renderToReadableStream). */
      loadBootstrapScriptContent(entry: string): Promise<string>
    }
  }
}

// createFromReadableStream / createFromFetch retornam a árvore React desserializada
// tipada como unknown; usamos este alias quando precisamos de ReactNode.
export type RscNode = ReactNode

export {}
