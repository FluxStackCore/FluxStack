// Navegação RSC via window (global verdadeiro), NÃO via singleton de módulo.
//
// Por quê window e não um let de módulo: no RSC, o mesmo módulo pode ser
// carregado em ambientes/grafos diferentes (o RscLink vem do grafo do payload;
// o entry.browser é o grafo client). Um `let` de módulo teria instâncias
// separadas — setNavigate no entry não seria visto pelo RscLink. window é o
// único estado compartilhado garantido entre eles no browser.

type NavigateFn = (href: string, push?: boolean) => void

declare global {
  interface Window { __rscNavigate?: NavigateFn }
}

/** O entry.browser registra a função de navegação. */
export function setNavigate(fn: NavigateFn | null) {
  if (typeof window !== 'undefined') {
    window.__rscNavigate = fn ?? undefined
  }
}

/** O RscLink chama isto no clique. Fallback: navegação nativa (full reload). */
export function navigate(href: string) {
  if (typeof window !== 'undefined' && window.__rscNavigate) {
    window.__rscNavigate(href)
  } else if (typeof window !== 'undefined') {
    window.location.href = href
  }
}
