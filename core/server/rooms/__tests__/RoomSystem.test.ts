// 🧪 Tests for RoomSystem

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRoomSystem, Room, RoomSystem } from '../RoomSystem'

// Tipos de teste
type TestRoom = {
  state: {
    count: number
    users: string[]
    settings: { enabled: boolean }
  }
  events: {
    'user:join': { userId: string; timestamp: number }
    'user:leave': { userId: string }
    'count:update': { value: number }
  }
}

describe('RoomSystem', () => {
  let roomSystem: RoomSystem<TestRoom['state'], TestRoom['events']>

  beforeEach(() => {
    roomSystem = createRoomSystem<TestRoom>('test')
  })

  describe('room creation', () => {
    it('should create a new room with initial state', () => {
      const initialState = { count: 0, users: [], settings: { enabled: true } }
      const room = roomSystem.room('room-1', initialState)

      expect(room).toBeDefined()
      expect(room.id).toBe('room-1')
      expect(room.state).toEqual(initialState)
    })

    it('should return existing room if already exists', () => {
      const initialState = { count: 0, users: [], settings: { enabled: true } }
      const room1 = roomSystem.room('room-1', initialState)
      room1.setState({ count: 5 })

      const room2 = roomSystem.room('room-1', initialState)

      expect(room2).toBe(room1)
      expect(room2.state.count).toBe(5)
    })

    it('should check if room exists', () => {
      expect(roomSystem.has('room-1')).toBe(false)

      roomSystem.room('room-1', { count: 0, users: [], settings: { enabled: true } })

      expect(roomSystem.has('room-1')).toBe(true)
    })

    it('should get room by id', () => {
      expect(roomSystem.get('room-1')).toBeUndefined()

      const room = roomSystem.room('room-1', { count: 0, users: [], settings: { enabled: true } })

      expect(roomSystem.get('room-1')).toBe(room)
    })

    it('should get or create room', () => {
      const initialState = { count: 0, users: [], settings: { enabled: true } }

      const room1 = roomSystem.getOrCreate('room-1', initialState)
      expect(room1.state).toEqual(initialState)

      room1.setState({ count: 10 })

      const room2 = roomSystem.getOrCreate('room-1', initialState)
      expect(room2.state.count).toBe(10)
    })
  })

  describe('room state', () => {
    let room: Room<TestRoom['state'], TestRoom['events']>

    beforeEach(() => {
      room = roomSystem.room('room-1', {
        count: 0,
        users: [],
        settings: { enabled: true }
      })
    })

    it('should get state', () => {
      expect(room.state.count).toBe(0)
      expect(room.state.users).toEqual([])
    })

    it('should set partial state', () => {
      room.setState({ count: 5 })

      expect(room.state.count).toBe(5)
      expect(room.state.users).toEqual([])
    })

    it('should update state with function', () => {
      room.updateState(prev => ({
        count: prev.count + 1,
        users: [...prev.users, 'user-1']
      }))

      expect(room.state.count).toBe(1)
      expect(room.state.users).toEqual(['user-1'])
    })

    it('should reset state', () => {
      room.setState({ count: 100, users: ['a', 'b', 'c'] })

      room.resetState({
        count: 0,
        users: [],
        settings: { enabled: false }
      })

      expect(room.state.count).toBe(0)
      expect(room.state.users).toEqual([])
      expect(room.state.settings.enabled).toBe(false)
    })

    it('should emit $state:change on setState', () => {
      const handler = vi.fn()
      room.on('$state:change', handler)

      room.setState({ count: 5 })

      expect(handler).toHaveBeenCalledWith({
        path: 'count',
        oldValue: 0,
        newValue: 5
      })
    })

    it('should emit $state:reset on resetState', () => {
      const handler = vi.fn()
      room.on('$state:reset', handler)

      const oldState = room.state
      const newState = { count: 99, users: ['x'], settings: { enabled: false } }

      room.resetState(newState)

      expect(handler).toHaveBeenCalledWith({
        oldState,
        newState
      })
    })
  })

  describe('room events', () => {
    let room: Room<TestRoom['state'], TestRoom['events']>

    beforeEach(() => {
      room = roomSystem.room('room-1', {
        count: 0,
        users: [],
        settings: { enabled: true }
      })
    })

    it('should subscribe to events', () => {
      const handler = vi.fn()
      room.on('user:join', handler)

      room.emit('user:join', { userId: 'user-1', timestamp: Date.now() })

      expect(handler).toHaveBeenCalledWith({ userId: 'user-1', timestamp: expect.any(Number) })
    })

    it('should unsubscribe from events', () => {
      const handler = vi.fn()
      const unsub = room.on('user:join', handler)

      room.emit('user:join', { userId: 'user-1', timestamp: Date.now() })
      expect(handler).toHaveBeenCalledTimes(1)

      unsub()

      room.emit('user:join', { userId: 'user-2', timestamp: Date.now() })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      room.on('user:join', handler1)
      room.on('user:join', handler2)

      room.emit('user:join', { userId: 'user-1', timestamp: Date.now() })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should return count of notified handlers', () => {
      room.on('user:join', () => {})
      room.on('user:join', () => {})
      room.on('user:join', () => {})

      const count = room.emit('user:join', { userId: 'user-1', timestamp: Date.now() })

      expect(count).toBe(3)
    })

    it('should emit $sub:join when subscribing', () => {
      const handler = vi.fn()
      room.on('$sub:join', handler)

      room.on('user:join', () => {})

      expect(handler).toHaveBeenCalledWith({
        subscriberId: expect.stringMatching(/^sub-/),
        event: 'user:join',
        count: 1
      })
    })

    it('should emit $sub:leave when unsubscribing', () => {
      const handler = vi.fn()
      room.on('$sub:leave', handler)

      const unsub = room.on('user:join', () => {})
      unsub()

      expect(handler).toHaveBeenCalledWith({
        subscriberId: expect.stringMatching(/^sub-/),
        event: 'user:join',
        count: 0
      })
    })
  })

  describe('room destruction', () => {
    it('should destroy room', () => {
      const room = roomSystem.room('room-1', {
        count: 0,
        users: [],
        settings: { enabled: true }
      })

      const result = roomSystem.destroyRoom('room-1')

      expect(result).toBe(true)
      expect(roomSystem.has('room-1')).toBe(false)
      expect(room.isDestroyed()).toBe(true)
    })

    it('should emit $room:destroyed on destroy', () => {
      const room = roomSystem.room('room-1', {
        count: 0,
        users: [],
        settings: { enabled: true }
      })

      const handler = vi.fn()
      room.on('$room:destroyed', handler)

      roomSystem.destroyRoom('room-1', 'manual')

      expect(handler).toHaveBeenCalledWith({
        roomId: 'room-1',
        reason: 'manual',
        finalState: expect.any(Object)
      })
    })

    it('should throw when using destroyed room', () => {
      const room = roomSystem.room('room-1', {
        count: 0,
        users: [],
        settings: { enabled: true }
      })

      roomSystem.destroyRoom('room-1')

      expect(() => room.setState({ count: 1 })).toThrow("Room 'room-1' has been destroyed")
      expect(() => room.on('user:join', () => {})).toThrow("Room 'room-1' has been destroyed")
    })
  })

  describe('global events', () => {
    it('should emit $room:created globally', () => {
      const handler = vi.fn()
      roomSystem.on('$room:created', handler)

      roomSystem.room('room-1', { count: 0, users: [], settings: { enabled: true } })

      expect(handler).toHaveBeenCalledWith({
        roomId: 'room-1',
        createdAt: expect.any(Number),
        initialState: { count: 0, users: [], settings: { enabled: true } }
      })
    })

    it('should emit $room:destroyed globally', () => {
      const handler = vi.fn()
      roomSystem.on('$room:destroyed', handler)

      roomSystem.room('room-1', { count: 0, users: [], settings: { enabled: true } })
      roomSystem.destroyRoom('room-1', 'ttl')

      expect(handler).toHaveBeenCalledWith({
        roomId: 'room-1',
        reason: 'ttl',
        finalState: expect.any(Object)
      })
    })
  })

  describe('stats', () => {
    it('should return room stats', () => {
      const room1 = roomSystem.room('room-1', { count: 0, users: [], settings: { enabled: true } })
      const room2 = roomSystem.room('room-2', { count: 0, users: [], settings: { enabled: true } })

      room1.on('user:join', () => {})
      room1.on('user:join', () => {})
      room2.on('count:update', () => {})

      const stats = roomSystem.getStats()

      expect(stats.name).toBe('test')
      expect(stats.roomCount).toBe(2)
      expect(stats.rooms['room-1'].subscriberCount).toBe(2)
      expect(stats.rooms['room-2'].subscriberCount).toBe(1)
    })

    it('should return room subscriber count', () => {
      const room = roomSystem.room('room-1', { count: 0, users: [], settings: { enabled: true } })

      expect(room.getSubscriberCount()).toBe(0)

      room.on('user:join', () => {})
      room.on('user:join', () => {})
      room.on('count:update', () => {})

      expect(room.getSubscriberCount()).toBe(3)
      expect(room.getSubscriberCount('user:join')).toBe(2)
      expect(room.getSubscriberCount('count:update')).toBe(1)
    })

    it('should return event list', () => {
      const room = roomSystem.room('room-1', { count: 0, users: [], settings: { enabled: true } })

      room.on('user:join', () => {})
      room.on('count:update', () => {})
      room.on('$state:change', () => {}) // Sistema, não deve aparecer

      const events = room.getEvents()

      expect(events).toContain('user:join')
      expect(events).toContain('count:update')
      expect(events).not.toContain('$state:change')
    })
  })
})
