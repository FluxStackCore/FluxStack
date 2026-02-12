// 🔥 FluxStack Live Room Manager - Gerencia salas para LiveComponents

import { roomEvents } from './RoomEventBus'
import type { FluxStackWebSocket } from '@core/types/types'
import { liveLog } from './LiveLogger'

export interface RoomMessage {
  type: 'ROOM_JOIN' | 'ROOM_LEAVE' | 'ROOM_EMIT' | 'ROOM_STATE_SET' | 'ROOM_STATE_GET'
  componentId: string
  roomId: string
  event?: string
  data?: any
  requestId?: string
  timestamp: number
}

interface RoomMember {
  componentId: string
  ws: FluxStackWebSocket
  joinedAt: number
}

interface Room<TState = any> {
  id: string
  state: TState
  members: Map<string, RoomMember>
  createdAt: number
  lastActivity: number
}

class LiveRoomManager {
  private rooms = new Map<string, Room>()
  private componentRooms = new Map<string, Set<string>>() // componentId -> roomIds

  /**
   * Componente entra em uma sala
   */
  joinRoom<TState = any>(componentId: string, roomId: string, ws: FluxStackWebSocket, initialState?: TState): { state: TState } {
    // Criar sala se não existir
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        state: initialState || {},
        members: new Map(),
        createdAt: Date.now(),
        lastActivity: Date.now()
      })
      liveLog('rooms', componentId, `🏠 Room '${roomId}' created`)
    }

    const room = this.rooms.get(roomId)!

    // Adicionar membro
    room.members.set(componentId, {
      componentId,
      ws,
      joinedAt: Date.now()
    })
    room.lastActivity = Date.now()

    // Rastrear salas do componente
    if (!this.componentRooms.has(componentId)) {
      this.componentRooms.set(componentId, new Set())
    }
    this.componentRooms.get(componentId)!.add(roomId)

    liveLog('rooms', componentId, `👋 Component '${componentId}' joined room '${roomId}' (${room.members.size} members)`)

    // Notificar outros membros
    this.broadcastToRoom(roomId, {
      type: 'ROOM_SYSTEM',
      componentId,
      roomId,
      event: '$sub:join',
      data: {
        subscriberId: componentId,
        count: room.members.size
      },
      timestamp: Date.now()
    }, componentId)

    return { state: room.state }
  }

  /**
   * Componente sai de uma sala
   */
  leaveRoom(componentId: string, roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    // Remover membro
    room.members.delete(componentId)
    room.lastActivity = Date.now()

    // Remover do rastreamento
    this.componentRooms.get(componentId)?.delete(roomId)

    liveLog('rooms', componentId, `🚶 Component '${componentId}' left room '${roomId}' (${room.members.size} members)`)

    // Notificar outros membros
    this.broadcastToRoom(roomId, {
      type: 'ROOM_SYSTEM',
      componentId,
      roomId,
      event: '$sub:leave',
      data: {
        subscriberId: componentId,
        count: room.members.size
      },
      timestamp: Date.now()
    })

    // Cleanup sala vazia após delay
    if (room.members.size === 0) {
      setTimeout(() => {
        const currentRoom = this.rooms.get(roomId)
        if (currentRoom && currentRoom.members.size === 0) {
          this.rooms.delete(roomId)
          liveLog('rooms', null, `🗑️ Room '${roomId}' destroyed (empty)`)
        }
      }, 5 * 60 * 1000) // 5 minutos
    }
  }

  /**
   * Componente desconecta - sai de todas as salas
   */
  cleanupComponent(componentId: string): void {
    const rooms = this.componentRooms.get(componentId)
    if (!rooms) return

    for (const roomId of rooms) {
      this.leaveRoom(componentId, roomId)
    }

    this.componentRooms.delete(componentId)
  }

  /**
   * Emitir evento para todos na sala
   * - Envia via WebSocket para frontends dos outros membros
   * - Também dispara eventos no RoomEventBus para handlers server-side
   */
  emitToRoom(roomId: string, event: string, data: any, excludeComponentId?: string): number {
    const room = this.rooms.get(roomId)
    if (!room) return 0

    room.lastActivity = Date.now()

    // 1. Emitir no RoomEventBus para handlers server-side (outros LiveComponents)
    // Isso permite que componentes do servidor reajam a eventos de outros componentes
    // Usa 'room' como tipo genérico (mesmo usado em $room.on)
    roomEvents.emit('room', roomId, event, data, excludeComponentId)

    // 2. Broadcast via WebSocket para frontends
    return this.broadcastToRoom(roomId, {
      type: 'ROOM_EVENT',
      componentId: '',
      roomId,
      event,
      data,
      timestamp: Date.now()
    }, excludeComponentId)
  }

  /**
   * Atualizar estado da sala
   */
  setRoomState(roomId: string, updates: any, excludeComponentId?: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    // Merge estado
    room.state = { ...room.state, ...updates }
    room.lastActivity = Date.now()

    // Notificar todos os membros
    this.broadcastToRoom(roomId, {
      type: 'ROOM_STATE',
      componentId: '',
      roomId,
      event: '$state:update',
      data: { state: updates },
      timestamp: Date.now()
    }, excludeComponentId)
  }

  /**
   * Obter estado da sala
   */
  getRoomState<TState = any>(roomId: string): TState {
    return (this.rooms.get(roomId)?.state || {}) as TState
  }

  /**
   * Broadcast para todos os membros da sala
   */
  private broadcastToRoom(roomId: string, message: any, excludeComponentId?: string): number {
    const room = this.rooms.get(roomId)
    if (!room) return 0

    let sent = 0
    for (const [componentId, member] of room.members) {
      if (excludeComponentId && componentId === excludeComponentId) continue

      try {
        if (member.ws && member.ws.readyState === 1) {
          member.ws.send(JSON.stringify({
            ...message,
            componentId
          }))
          sent++
        }
      } catch (error) {
        console.error(`Failed to send to ${componentId}:`, error)
      }
    }

    return sent
  }

  /**
   * Verificar se componente está em uma sala
   */
  isInRoom(componentId: string, roomId: string): boolean {
    return this.rooms.get(roomId)?.members.has(componentId) ?? false
  }

  /**
   * Obter salas de um componente
   */
  getComponentRooms(componentId: string): string[] {
    return Array.from(this.componentRooms.get(componentId) || [])
  }

  /**
   * Estatísticas
   */
  getStats(): {
    totalRooms: number
    rooms: Record<string, { members: number; createdAt: number; lastActivity: number }>
  } {
    const rooms: Record<string, { members: number; createdAt: number; lastActivity: number }> = {}

    for (const [id, room] of this.rooms) {
      rooms[id] = {
        members: room.members.size,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      }
    }

    return {
      totalRooms: this.rooms.size,
      rooms
    }
  }
}

export const liveRoomManager = new LiveRoomManager()
export type { Room, RoomMember }
