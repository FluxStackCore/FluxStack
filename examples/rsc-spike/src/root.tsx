// SERVER COMPONENT (sem 'use client').
// Roda SÓ no server. Pode ser async e buscar dados (DB, arquivo, API).
// NÃO vai pro bundle do client — zero JS pra este componente.
// É o análogo de uma "página server-side" que o dev cria quando quer.

import { Counter } from './Counter'

// Simula um fetch server-side (DB/API). No FluxStack real seria Drizzle/Eden.
async function getServerData() {
  await new Promise((r) => setTimeout(r, 10))
  return {
    renderedAt: new Date().toISOString(),
    items: ['Server Component', 'Client Island', 'Live Component (futuro)'],
  }
}

export async function Root() {
  const data = await getServerData()

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <title>RSC Spike — FluxStack</title>
        <style>{`body{font-family:system-ui;background:#0a0a0a;color:#eee;padding:2rem}
          .card{border:1px solid #333;border-radius:.5rem;padding:1rem;margin:1rem 0}
          .badge{background:#16331f;color:#7fffa0;padding:.2rem .5rem;border-radius:.4rem;font-size:.8rem}`}</style>
      </head>
      <body>
        <h1>⚡ RSC Spike</h1>

        <div className="card">
          <p><span className="badge">SERVER COMPONENT</span> — renderizado no server, 0 JS no client</p>
          <p>Dados buscados no server em: <strong>{data.renderedAt}</strong></p>
          <ul>{data.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>

        <div className="card">
          <p><span className="badge" style={{ background: '#1f2937', color: '#93c5fd' }}>CLIENT ISLAND</span> — interativo, hidrata no client</p>
          {/* Counter é 'use client': vira ilha interativa DENTRO da árvore server.
              É exatamente o papel que um Live Component terá. */}
          <Counter />
        </div>
      </body>
    </html>
  )
}
