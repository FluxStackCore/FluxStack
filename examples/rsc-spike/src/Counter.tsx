'use client'
// CLIENT ISLAND. A diretiva 'use client' marca a fronteira: este componente
// (e o que ele importa) VAI pro bundle do client e hidrata. useState/onClick
// só funcionam aqui. É o modelo que os Live Components do FluxStack seguem —
// um Live é um client component que, além de hidratar, conecta no WebSocket.

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <p>
      Contador (client): <strong>{count}</strong>{' '}
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </p>
  )
}
