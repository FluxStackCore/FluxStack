// Navegação RSC via singleton de módulo (não via React Context).
//
// Por quê não Context: o React Context client NÃO atravessa a fronteira de
// serialização RSC. O RscNav/RscLink vêm do payload server, então um
// NavContext.Provider no shell client não os alcança. Um singleton de módulo
// (igual o connectionPool faz com a conexão) resolve: o RootClient registra
// seu navigate aqui, o RscLink chama daqui. Sem fronteira de contexto.

type NavigateFn = (href: string, push?: boolean) => void

let navigateImpl: NavigateFn | null = null

/** O RootClient registra sua função de navegação no mount. */
export function setNavigate(fn: NavigateFn | null) {
  navigateImpl = fn
}

/** O RscLink chama isto no clique. Fallback: navegação nativa (full reload). */
export function navigate(href: string) {
  if (navigateImpl) {
    navigateImpl(href)
  } else if (typeof window !== 'undefined') {
    window.location.href = href // degrada para reload se o shell não registrou
  }
}
