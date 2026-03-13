// DirectoryRoom - Shared room that tracks user-created chat rooms
//
// All LiveRoomChat components auto-join this room so they can
// see rooms created by other users in real-time.

import { LiveRoom } from '@fluxstack/live'

export interface DirectoryEntry {
  id: string
  name: string
  isPrivate: boolean
  createdBy: string
}

interface DirectoryState {
  rooms: DirectoryEntry[]
}

interface DirectoryEvents {
  'room:added': DirectoryEntry
  'room:removed': { id: string }
}

export class DirectoryRoom extends LiveRoom<DirectoryState, {}, DirectoryEvents> {
  static roomName = 'directory'
  static defaultState: DirectoryState = { rooms: [] }
  static defaultMeta = {}

  addRoom(entry: DirectoryEntry) {
    this.setState({
      rooms: [...this.state.rooms.filter(r => r.id !== entry.id), entry]
    })
    this.emit('room:added', entry)
  }

  removeRoom(id: string) {
    this.setState({
      rooms: this.state.rooms.filter(r => r.id !== id)
    })
    this.emit('room:removed', { id })
  }
}
