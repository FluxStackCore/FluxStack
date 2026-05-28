// Página /room-chat (file-based). Demo Live — React normal.
import { LivePage } from '../framework/LivePage'
import { RoomChatDemo } from '../live/RoomChatDemo'

export const title = 'Chat'

export default function RoomChatPage() {
  return (
    <LivePage title="Room Chat" description="Chat multi-sala usando o sistema $room.">
      <RoomChatDemo />
    </LivePage>
  )
}
