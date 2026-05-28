// Página /sobre — PROVA do file-based routing. Só criar este arquivo já cria a
// rota /sobre e o link na navbar. React normal, server component (0 JS).
export const title = 'Sobre'

export default function SobrePage() {
  return (
    <div className="relative min-h-[calc(100vh-57px)] px-4 py-10">
      <div className="absolute inset-0 app-grid-bg opacity-70" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold text-white">Sobre</h1>
        <p className="mt-4 text-gray-400">
          Esta página foi criada só adicionando <code className="text-theme">app/client/src/pages/sobre.tsx</code>.
          Sem editar router, sem registrar rota, sem tocar em nada. É React normal — e roda
          como Server Component (zero JS no client).
        </p>
      </div>
    </div>
  )
}
