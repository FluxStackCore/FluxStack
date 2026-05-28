'use client'
// useParams() — conveniência CLIENT para acessar os params da rota.
//
// A fonte da verdade é o `params` PROP (passado pelo roteador, funciona em server
// E client component, 0 JS preservado). Este hook é açúcar opcional para client
// components que preferem o estilo react-router. Só funciona dentro de um
// <ParamsProvider> (provido automaticamente por client boundaries como LivePage).
//
// Regra: `params` prop em qualquer página; useParams() só em 'use client'.
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { RouteParams } from './routes'

const ParamsContext = createContext<RouteParams>({})

export function ParamsProvider({ params, children }: { params: RouteParams; children: ReactNode }) {
  return <ParamsContext.Provider value={params}>{children}</ParamsContext.Provider>
}

export function useParams<T extends RouteParams = RouteParams>(): T {
  return useContext(ParamsContext) as T
}
