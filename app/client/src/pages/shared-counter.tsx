// Página /shared-counter (file-based). Demo Live — React normal.
import { LivePage } from '../framework/LivePage'
import { SharedCounterDemo } from '../live/SharedCounterDemo'

export const title = 'Shared'

export default function SharedCounterPage() {
  return (
    <LivePage title="Shared Counter" description="Sala global sincroniza usuários e estado entre abas.">
      <SharedCounterDemo />
    </LivePage>
  )
}
