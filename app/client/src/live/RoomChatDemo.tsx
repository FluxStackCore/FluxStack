// RoomChatDemo - Chat multi-salas with password-protected rooms

import { useEffect, useRef, useMemo, useReducer } from 'react'
import { Live } from '@/core/client'
import { LiveRoomChat } from '@server/live/LiveRoomChat'

const DEFAULT_ROOMS = [
  { id: 'geral', name: 'Geral' },
  { id: 'tech', name: 'Tecnologia' },
  { id: 'random', name: 'Random' },
]

// Consolidated UI state to avoid fragmented useState calls and ensure
// related modal states update atomically.
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
      return { ...state, createModal: { ...state.createModal, name: action.name ?? state.createModal.name, password: action.password ?? state.createModal.password } }
    case 'OPEN_PASSWORD_PROMPT':
      return { ...state, passwordPrompt: { roomId: action.roomId, roomName: action.roomName, input: '' } }
    case 'CLOSE_PASSWORD_PROMPT':
      return { ...state, passwordPrompt: null }
    case 'SET_PASSWORD_INPUT':
      return state.passwordPrompt ? { ...state, passwordPrompt: { ...state.passwordPrompt, input: action.input } } : state
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
    const adj = ['Happy', 'Cool', 'Fast', 'Smart', 'Brave'][Math.floor(Math.random() * 5)]
    const noun = ['Panda', 'Tiger', 'Eagle', 'Wolf', 'Bear'][Math.floor(Math.random() * 5)]
    return `${adj}${noun}${Math.floor(Math.random() * 100)}`
  }, [])

  const chat = Live.use(LiveRoomChat, {
    initialState: { ...LiveRoomChat.defaultState, username: defaultUsername }
  })

  const activeRoom = chat.$state.activeRoom
  const activeMessages = activeRoom ? (chat.$state.messages[activeRoom] || []) : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length])

  useEffect(() => {
    if (ui.error) {
      const t = setTimeout(() => dispatch({ type: 'SET_ERROR', error: '' }), 3000)
      return () => clearTimeout(t)
    }
  }, [ui.error])

  const joinedRoomIds = chat.$state.rooms.map(r => r.id)
  const joinedRoomsMap = new Map(chat.$state.rooms.map(r => [r.id, r]))

  const handleJoinRoom = async (roomId: string, roomName: string, isPrivate?: boolean) => {
    if (joinedRoomIds.includes(roomId)) {
      await chat.switchRoom({ roomId })
      return
    }

    // If the room is known to be private, prompt for password
    if (isPrivate) {
      dispatch({ type: 'OPEN_PASSWORD_PROMPT', roomId, roomName })
      return
    }

    // Try joining without password
    const result = await chat.joinRoom({ roomId, roomName })
    if (result && !result.success) {
      // If rejected, might be password-protected — prompt
      dispatch({ type: 'OPEN_PASSWORD_PROMPT', roomId, roomName })
    }
  }

  const handlePasswordSubmit = async () => {
    if (!ui.passwordPrompt) return
    const result = await chat.joinRoom({
      roomId: ui.passwordPrompt.roomId,
      roomName: ui.passwordPrompt.roomName,
      password: ui.passwordPrompt.input
    })
    if (result && !result.success) {
      dispatch({ type: 'SET_ERROR', error: result.error || 'Senha incorreta' })
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
      password: ui.createModal.password || undefined
    })
    if (result && !result.success) {
      dispatch({ type: 'SET_ERROR', error: result.error || 'Falha ao criar sala' })
    } else {
      dispatch({ type: 'CLOSE_CREATE_MODAL' })
    }
  }

  const handleSendMessage = async () => {
    if (!ui.text.trim() || !activeRoom) return
    await chat.sendMessage({ text: ui.text })
    dispatch({ type: 'SET_TEXT', text: '' })
  }

  // Combine default rooms + custom rooms from shared directory (visible to all users)
  const customRooms = chat.$state.customRooms || []
  const allRooms = [
    ...DEFAULT_ROOMS.map(r => ({ ...r, isPrivate: joinedRoomsMap.get(r.id)?.isPrivate ?? false, createdBy: '' })),
    ...customRooms
      .filter(r => !DEFAULT_ROOMS.some(d => d.id === r.id))
      .map(r => ({ id: r.id, name: r.name, isPrivate: r.isPrivate, createdBy: r.createdBy }))
  ]

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] md:h-[600px] w-full max-w-4xl mx-auto bg-gray-900 rounded-2xl overflow-hidden border border-white/10">
      {/* Sidebar */}
      <div className={`${activeRoom ? 'hidden md:flex' : 'flex'} w-full md:w-64 bg-gray-800/50 md:border-r border-white/10 flex-col ${!activeRoom ? 'flex-1 md:flex-initial' : ''}`}>
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white mb-2">Room Chat</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${chat.$connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-400">{chat.$state.username}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs text-gray-500">SALAS</p>
            <button
              onClick={() => dispatch({ type: 'OPEN_CREATE_MODAL' })}
              className="text-xs text-theme hover:text-theme"
            >+ Criar</button>
          </div>
          {allRooms.map(room => {
            const isJoined = joinedRoomIds.includes(room.id)
            const isActive = activeRoom === room.id

            return (
              <div
                key={room.id}
                onClick={() => handleJoinRoom(room.id, room.name, room.isPrivate && !isJoined ? true : undefined)}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1 transition-all group
                  ${isActive ? 'bg-theme-muted text-theme' : isJoined ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'text-gray-500 hover:bg-white/5'}
                `}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {room.isPrivate && <span className="text-xs shrink-0">&#128274;</span>}
                  <span className="truncate">
                    {room.name}
                    {room.createdBy && <span className="text-xs text-gray-600 ml-1">by {room.createdBy}</span>}
                  </span>
                  {isJoined && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </span>
                {isJoined && !isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); chat.leaveRoom({ roomId: room.id }) }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs"
                  >&#10005;</button>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t border-white/10">
          <p className="text-xs text-gray-500">Em {joinedRoomIds.length} sala(s)</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!activeRoom ? 'hidden md:flex' : 'flex'} flex-1 flex-col`}>
        {activeRoom ? (
          <>
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => chat.switchRoom({ roomId: '' })}
                  className="md:hidden px-2 py-1 text-sm text-gray-400 hover:text-white"
                >
                  &#8592;
                </button>
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    {joinedRoomsMap.get(activeRoom)?.isPrivate && <span className="text-xs">&#128274;</span>}
                    {joinedRoomsMap.get(activeRoom)?.name || activeRoom}
                  </h3>
                  <p className="text-xs text-gray-500">{activeMessages.length} mensagens</p>
                </div>
              </div>
              <button
                onClick={() => chat.leaveRoom({ roomId: activeRoom })}
                className="px-3 py-1 text-sm bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
              >Sair</button>
            </div>

            <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3">
              {activeMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Seja o primeiro a enviar!</p>
                </div>
              ) : (
                activeMessages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.user === chat.$state.username ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 ${msg.user === chat.$state.username ? 'bg-theme-muted text-white' : 'bg-white/10 text-gray-200'}`}>
                      <p className="text-xs text-gray-400 mb-1">{msg.user}</p>
                      <p className="text-sm sm:text-base">{msg.text}</p>
                    </div>
                    <span className="text-xs text-gray-600 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 sm:p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  value={ui.text}
                  onChange={(e) => dispatch({ type: 'SET_TEXT', text: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-3 sm:px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-glow)] text-sm sm:text-base"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!ui.text.trim()}
                  className="px-4 sm:px-6 py-2 rounded-xl bg-theme-muted text-theme hover:bg-theme-muted disabled:opacity-50 text-sm sm:text-base"
                >Enviar</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-4xl mb-4">&#8592;</p>
              <p>Selecione uma sala para começar</p>
            </div>
          </div>
        )}
      </div>

      {/* Error toast */}
      {ui.error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/90 text-white text-sm rounded-lg shadow-lg z-50">
          {ui.error}
        </div>
      )}

      {/* Create Room Modal */}
      {ui.createModal.open && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40" onClick={() => dispatch({ type: 'CLOSE_CREATE_MODAL' })}>
          <div className="bg-gray-800 rounded-2xl p-6 w-80 border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4">Criar Sala</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome da sala</label>
                <input
                  value={ui.createModal.name}
                  onChange={e => dispatch({ type: 'UPDATE_CREATE_FORM', name: e.target.value })}
                  placeholder="Minha Sala"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-glow)] text-sm"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateRoom() }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Senha (opcional)</label>
                <input
                  type="password"
                  value={ui.createModal.password}
                  onChange={e => dispatch({ type: 'UPDATE_CREATE_FORM', password: e.target.value })}
                  placeholder="Deixe vazio para sala publica"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-glow)] text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateRoom() }}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => dispatch({ type: 'CLOSE_CREATE_MODAL' })}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-sm"
                >Cancelar</button>
                <button
                  onClick={handleCreateRoom}
                  disabled={!ui.createModal.name.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-theme-muted text-theme hover:bg-theme-muted disabled:opacity-50 text-sm"
                >Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {ui.passwordPrompt && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40" onClick={() => dispatch({ type: 'CLOSE_PASSWORD_PROMPT' })}>
          <div className="bg-gray-800 rounded-2xl p-6 w-80 border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-1">Sala Protegida</h3>
            <p className="text-sm text-gray-400 mb-4">
              A sala "{ui.passwordPrompt.roomName}" requer senha.
            </p>
            <input
              type="password"
              value={ui.passwordPrompt.input}
              onChange={e => dispatch({ type: 'SET_PASSWORD_INPUT', input: e.target.value })}
              placeholder="Digite a senha..."
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-glow)] text-sm mb-3"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: 'CLOSE_PASSWORD_PROMPT' })}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-sm"
              >Cancelar</button>
              <button
                onClick={handlePasswordSubmit}
                disabled={!ui.passwordPrompt.input}
                className="flex-1 px-4 py-2 rounded-lg bg-theme-muted text-theme hover:bg-theme-muted disabled:opacity-50 text-sm"
              >Entrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
