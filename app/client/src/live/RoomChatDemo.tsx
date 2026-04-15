import { useEffect, useMemo, useReducer, useRef } from 'react'
import { Live } from '@/core/client'
import { LiveRoomChat } from '@server/live/LiveRoomChat'
import { FaArrowLeft, FaLock, FaPlus, FaRightFromBracket } from 'react-icons/fa6'

const DEFAULT_ROOMS = [
  { id: 'general', name: 'General' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'support', name: 'Support' },
]

interface ChatUIState {
  text: string
  error: string
  createModal: { open: boolean; name: string; password: string }
  passwordPrompt: { roomId: string; roomName: string; input: string } | null
}

type ChatUIAction =
  | { type: 'SET_TEXT'; text: string }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'UPDATE_CREATE_FORM'; name?: string; password?: string }
  | { type: 'OPEN_PASSWORD_PROMPT'; roomId: string; roomName: string }
  | { type: 'CLOSE_PASSWORD_PROMPT' }
  | { type: 'SET_PASSWORD_INPUT'; input: string }

function chatUIReducer(state: ChatUIState, action: ChatUIAction): ChatUIState {
  switch (action.type) {
    case 'SET_TEXT':
      return { ...state, text: action.text }
    case 'SET_ERROR':
      return { ...state, error: action.error }
    case 'OPEN_CREATE_MODAL':
      return { ...state, createModal: { open: true, name: '', password: '' } }
    case 'CLOSE_CREATE_MODAL':
      return { ...state, createModal: { open: false, name: '', password: '' } }
    case 'UPDATE_CREATE_FORM':
      return {
        ...state,
        createModal: {
          ...state.createModal,
          name: action.name ?? state.createModal.name,
          password: action.password ?? state.createModal.password,
        },
      }
    case 'OPEN_PASSWORD_PROMPT':
      return { ...state, passwordPrompt: { roomId: action.roomId, roomName: action.roomName, input: '' } }
    case 'CLOSE_PASSWORD_PROMPT':
      return { ...state, passwordPrompt: null }
    case 'SET_PASSWORD_INPUT':
      return state.passwordPrompt
        ? { ...state, passwordPrompt: { ...state.passwordPrompt, input: action.input } }
        : state
    default:
      return state
  }
}

const initialUIState: ChatUIState = {
  text: '',
  error: '',
  createModal: { open: false, name: '', password: '' },
  passwordPrompt: null,
}

export function RoomChatDemo() {
  const [ui, dispatch] = useReducer(chatUIReducer, initialUIState)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const defaultUsername = useMemo(() => {
    const prefix = ['Edge', 'Core', 'Live', 'Flux', 'Node'][Math.floor(Math.random() * 5)]
    return `${prefix}-${Math.floor(Math.random() * 100)}`
  }, [])

  const chat = Live.use(LiveRoomChat, {
    initialState: { ...LiveRoomChat.defaultState, username: defaultUsername },
  })

  const activeRoom = chat.$state.activeRoom
  const activeMessages = activeRoom ? (chat.$state.messages[activeRoom] || []) : []
  const joinedRoomIds = chat.$state.rooms.map(r => r.id)
  const joinedRoomsMap = new Map(chat.$state.rooms.map(r => [r.id, r]))
  const customRooms = chat.$state.customRooms || []
  const allRooms = [
    ...DEFAULT_ROOMS.map(r => ({ ...r, isPrivate: joinedRoomsMap.get(r.id)?.isPrivate ?? false, createdBy: '' })),
    ...customRooms
      .filter(r => !DEFAULT_ROOMS.some(d => d.id === r.id))
      .map(r => ({ id: r.id, name: r.name, isPrivate: r.isPrivate, createdBy: r.createdBy })),
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length])

  useEffect(() => {
    if (!ui.error) return
    const timeout = setTimeout(() => dispatch({ type: 'SET_ERROR', error: '' }), 3000)
    return () => clearTimeout(timeout)
  }, [ui.error])

  const handleJoinRoom = async (roomId: string, roomName: string, isPrivate?: boolean) => {
    if (joinedRoomIds.includes(roomId)) {
      await chat.switchRoom({ roomId })
      return
    }

    if (isPrivate) {
      dispatch({ type: 'OPEN_PASSWORD_PROMPT', roomId, roomName })
      return
    }

    const result = await chat.joinRoom({ roomId, roomName })
    if (result && !result.success) {
      dispatch({ type: 'OPEN_PASSWORD_PROMPT', roomId, roomName })
    }
  }

  const handlePasswordSubmit = async () => {
    if (!ui.passwordPrompt) return
    const result = await chat.joinRoom({
      roomId: ui.passwordPrompt.roomId,
      roomName: ui.passwordPrompt.roomName,
      password: ui.passwordPrompt.input,
    })
    if (result && !result.success) {
      dispatch({ type: 'SET_ERROR', error: result.error || 'Invalid password' })
    } else {
      dispatch({ type: 'CLOSE_PASSWORD_PROMPT' })
    }
  }

  const handleCreateRoom = async () => {
    const name = ui.createModal.name.trim()
    if (!name) return
    const roomId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!roomId) return

    const result = await chat.createRoom({
      roomId,
      roomName: name,
      password: ui.createModal.password || undefined,
    })
    if (result && !result.success) {
      dispatch({ type: 'SET_ERROR', error: result.error || 'Could not create room' })
    } else {
      dispatch({ type: 'CLOSE_CREATE_MODAL' })
    }
  }

  const handleSendMessage = async () => {
    if (!ui.text.trim() || !activeRoom) return
    await chat.sendMessage({ text: ui.text })
    dispatch({ type: 'SET_TEXT', text: '' })
  }

  return (
    <div className="relative flex h-[720px] w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-[#07070b]/90 shadow-2xl shadow-black/20">
      <aside className={`${activeRoom ? 'hidden md:flex' : 'flex'} w-full flex-col border-white/10 bg-black/25 md:w-72 md:border-r`}>
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Rooms</h2>
              <p className="mt-1 text-xs text-gray-500">{joinedRoomIds.length} joined rooms</p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
              chat.$connected
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                : 'border-red-400/25 bg-red-400/10 text-red-200'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${chat.$connected ? 'bg-emerald-300' : 'bg-red-300'}`} />
              Live
            </span>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
            <p className="text-xs text-gray-500">Current client</p>
            <p className="mt-1 font-mono text-sm text-gray-200">{chat.$state.username}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <button
            onClick={() => dispatch({ type: 'OPEN_CREATE_MODAL' })}
            className="mb-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-theme-active bg-theme-muted text-sm font-semibold text-theme transition hover:shadow-theme"
          >
            <FaPlus className="h-3.5 w-3.5" />
            Create room
          </button>

          <div className="space-y-1">
            {allRooms.map(room => {
              const isJoined = joinedRoomIds.includes(room.id)
              const isActive = activeRoom === room.id

              return (
                <button
                  key={room.id}
                  onClick={() => handleJoinRoom(room.id, room.name, room.isPrivate && !isJoined ? true : undefined)}
                  className={`group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                    isActive
                      ? 'bg-white text-black'
                      : isJoined
                        ? 'bg-white/[0.055] text-gray-200 hover:bg-white/[0.08]'
                        : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      {room.isPrivate && <FaLock className="h-3 w-3 shrink-0" />}
                      <span className="truncate text-sm font-medium">{room.name}</span>
                    </span>
                    {room.createdBy && <span className="mt-0.5 block truncate text-xs opacity-60">by {room.createdBy}</span>}
                  </span>
                  {isJoined && !isActive && (
                    <span
                      onClick={(e) => { e.stopPropagation(); chat.leaveRoom({ roomId: room.id }) }}
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <FaRightFromBracket className="h-3 w-3 text-red-300" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <section className={`${!activeRoom ? 'hidden md:flex' : 'flex'} min-w-0 flex-1 flex-col`}>
        {activeRoom ? (
          <>
            <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => chat.switchRoom({ roomId: '' })}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-300 md:hidden"
                  aria-label="Back to rooms"
                >
                  <FaArrowLeft className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                    {joinedRoomsMap.get(activeRoom)?.isPrivate && <FaLock className="h-3 w-3 text-theme" />}
                    {joinedRoomsMap.get(activeRoom)?.name || activeRoom}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">{activeMessages.length} messages</p>
                </div>
              </div>
              <button
                onClick={() => chat.leaveRoom({ roomId: activeRoom })}
                className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/15"
              >
                Leave
              </button>
            </header>

            <div className="flex-1 overflow-auto p-4">
              {activeMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <p className="text-lg font-medium text-white">No messages yet</p>
                    <p className="mt-2 text-sm text-gray-500">Start the room conversation from this client.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeMessages.map(msg => {
                    const mine = msg.user === chat.$state.username
                    return (
                      <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-lg border px-4 py-2 ${
                          mine
                            ? 'border-theme-active bg-theme-muted text-white'
                            : 'border-white/10 bg-white/[0.055] text-gray-200'
                        }`}>
                          <p className="mb-1 text-xs text-gray-400">{msg.user}</p>
                          <p className="text-sm leading-6">{msg.text}</p>
                        </div>
                        <span className="mt-1 text-xs text-gray-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <footer className="border-t border-white/10 p-3">
              <div className="flex gap-2">
                <input
                  value={ui.text}
                  onChange={(e) => dispatch({ type: 'SET_TEXT', text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Write a message..."
                  className="min-w-0 flex-1 input-theme"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!ui.text.trim()}
                  className="h-11 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <p className="text-lg font-medium text-white">Select a room</p>
              <p className="mt-2 text-sm text-gray-500">Join a default room or create a password-protected one.</p>
            </div>
          </div>
        )}
      </section>

      {ui.error && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-red-400/20 bg-red-500/90 px-4 py-2 text-sm text-white shadow-lg">
          {ui.error}
        </div>
      )}

      {ui.createModal.open && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={() => dispatch({ type: 'CLOSE_CREATE_MODAL' })}>
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#0b0b10] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">Create room</h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-gray-400">Room name</span>
                <input
                  value={ui.createModal.name}
                  onChange={e => dispatch({ type: 'UPDATE_CREATE_FORM', name: e.target.value })}
                  placeholder="Product team"
                  className="w-full input-theme"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateRoom() }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-gray-400">Password optional</span>
                <input
                  type="password"
                  value={ui.createModal.password}
                  onChange={e => dispatch({ type: 'UPDATE_CREATE_FORM', password: e.target.value })}
                  placeholder="Leave empty for a public room"
                  className="w-full input-theme"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateRoom() }}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => dispatch({ type: 'CLOSE_CREATE_MODAL' })} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-gray-300">
                  Cancel
                </button>
                <button onClick={handleCreateRoom} disabled={!ui.createModal.name.trim()} className="h-10 rounded-lg bg-white text-sm font-semibold text-black disabled:opacity-50">
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ui.passwordPrompt && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={() => dispatch({ type: 'CLOSE_PASSWORD_PROMPT' })}>
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#0b0b10] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">Protected room</h3>
            <p className="mt-1 text-sm text-gray-400">{ui.passwordPrompt.roomName} requires a password.</p>
            <input
              type="password"
              value={ui.passwordPrompt.input}
              onChange={e => dispatch({ type: 'SET_PASSWORD_INPUT', input: e.target.value })}
              placeholder="Password"
              className="mt-4 w-full input-theme"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => dispatch({ type: 'CLOSE_PASSWORD_PROMPT' })} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-gray-300">
                Cancel
              </button>
              <button onClick={handlePasswordSubmit} disabled={!ui.passwordPrompt.input} className="h-10 rounded-lg bg-white text-sm font-semibold text-black disabled:opacity-50">
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
