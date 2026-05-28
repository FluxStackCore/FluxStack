'use client'
// Client island do spike RSC. 'use client' marca a fronteira: vai pro bundle
// do browser e hidrata. É o papel que um Live Component ocupa (client + WS).
import { useState } from 'react'

export function RscCounter() {
  const [n, setN] = useState(0)
  return (
    <p>
      Contador (client): <strong>{n}</strong>{' '}
      <button onClick={() => setN((c) => c + 1)}>+1</button>
    </p>
  )
}
