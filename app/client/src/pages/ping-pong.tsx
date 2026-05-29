// Página /ping-pong (file-based). Demo Live — React normal.
import { LivePage } from '../framework/LivePage'
import { PingPongDemo } from '../live/PingPongDemo'

export const title = 'Ping-Pong'

export default function PingPongPage() {
  return (
    <LivePage title="Ping-Pong" description="Latency demo com codec binário msgpack no WebSocket.">
      <PingPongDemo />
    </LivePage>
  )
}
