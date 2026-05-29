// Página /counter (file-based). Demo Live — React normal.
// O CounterDemo usa Live.use(); no server vira placeholder (guarda SSR),
// no client monta e conecta. O LivePage cuida do Provider/ClientOnly.
import { LivePage } from '../framework/LivePage'
import { CounterDemo } from '../live/CounterDemo'

export const title = 'Counters'

export default function CounterPage() {
  return (
    <LivePage title="Counters" description="Estado local, sala isolada e sala compartilhada em tempo real.">
      <CounterDemo />
    </LivePage>
  )
}
