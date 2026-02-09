// 🔥 RoomChatDemo - Demo do chat com múltiplas salas
//
// Demonstra o uso do sistema $room para:
// - Entrar/sair de múltiplas salas
// - Enviar mensagens para sala ativa
// - Ver quem está digitando
// - Trocar entre salas

import { useState, useEffect, useRef, useMemo } from 'react'
import { Live } from '@/core/client'
import { LiveRoomChat } from '@server/live/LiveRoomChat'

// Salas disponíveis
const AVAILABLE_ROOMS = [
  { id: 'geral', name: '💬 Geral' },
  { id: 'tech', name: '💻 Tecnologia' },
  { id: 'random', name: '🎲 Random' },
  { id: 'vip', name: '⭐ VIP' }
]

export function RoomChatDemo() {
  const [text, setText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Username aleatório
  const defaultUsername = useMemo(() => {
    const adjectives = ['Happy', 'Cool', 'Fast', 'Smart', 'Brave']
    const nouns = ['Panda', 'Tiger', 'Eagle', 'Wolf', 'Bear']
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 100)
    return `${adj}${noun}${num}`
  }, [])

  // Live component - estado sincronizado automaticamente
  const chat = Live.use(LiveRoomChat, {
    initialState: { ...LiveRoomChat.defaultState, username: defaultUsername }
  })

  // Mensagens e typing vêm diretamente do estado sincronizado
  const activeRoom = chat.$state.activeRoom
  const activeMessages = activeRoom ? (chat.$state.messages[activeRoom] || []) : []
  const activeTyping = activeRoom ? (chat.$state.typingUsers[activeRoom] || []) : []

  // Auto scroll quando mensagens mudam
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length])

  // Handlers
  const handleJoinRoom = async (roomId: string, roomName: string) => {
    if (chat.$rooms.includes(roomId)) {
      await chat.switchRoom({ roomId })
    } else {
      await chat.joinRoom({ roomId, roomName })
    }
  }

  const handleLeaveRoom = async (roomId: string) => {
    await chat.leaveRoom({ roomId })
  }

  const handleSendMessage = async () => {
    if (!text.trim() || !chat.$state.activeRoom) return
    await chat.sendMessage({ text })
    setText('')
  }

  const handleTyping = () => {
    chat.startTyping({})
  }

  return (
    <div className="flex h-[600px] bg-gray-900 rounded-2xl overflow-hidden border border-white/10">
      {/* Sidebar - Lista de Salas */}
      <div className="w-64 bg-gray-800/50 border-r border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white mb-2">💬 Room Chat</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${chat.$connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-400">{chat.$state.username}</span>
          </div>
        </div>

        {/* Salas Disponíveis */}
        <div className="flex-1 overflow-auto p-2">
          <p className="text-xs text-gray-500 px-2 py-1">SALAS</p>
          {AVAILABLE_ROOMS.map(room => {
            const isJoined = chat.$rooms.includes(room.id)
            const isActive = chat.$state.activeRoom === room.id
            const unreadCount = 0 // TODO: implementar contagem

            return (
              <div
                key={room.id}
                onClick={() => handleJoinRoom(room.id, room.name)}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1
                  transition-all group
                  ${isActive
                    ? 'bg-purple-500/20 text-purple-300'
                    : isJoined
                      ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                      : 'text-gray-500 hover:bg-white/5 hover:text-gray-400'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {room.name}
                  {isJoined && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </span>

                {isJoined && !isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLeaveRoom(room.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Salas ativas */}
        <div className="p-3 border-t border-white/10">
          <p className="text-xs text-gray-500 mb-1">
            Em {chat.$rooms.length} sala(s)
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeRoom ? (
          <>
            {/* Header da sala */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">
                  {chat.$state.rooms.find(r => r.id === activeRoom)?.name || activeRoom}
                </h3>
                <p className="text-xs text-gray-500">
                  {activeMessages.length} mensagens
                </p>
              </div>
              <button
                onClick={() => handleLeaveRoom(activeRoom)}
                className="px-3 py-1 text-sm bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-all"
              >
                Sair
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {activeMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Seja o primeiro a enviar!</p>
                </div>
              ) : (
                activeMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.user === chat.$state.username ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`
                        max-w-[80%] rounded-2xl px-4 py-2
                        ${msg.user === chat.$state.username
                          ? 'bg-purple-500/30 text-purple-100'
                          : 'bg-white/10 text-gray-200'
                        }
                      `}
                    >
                      <p className="text-xs text-gray-400 mb-1">{msg.user}</p>
                      <p>{msg.text}</p>
                    </div>
                    <span className="text-xs text-gray-600 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {activeTyping.length > 0 && (
              <div className="px-4 py-1 text-xs text-gray-500">
                {activeTyping.filter(u => u !== chat.$state.username).join(', ')} está digitando...
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    handleTyping()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!text.trim()}
                  className="px-6 py-2 rounded-xl bg-purple-500/30 text-purple-200 hover:bg-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-4xl mb-4">👈</p>
              <p>Selecione uma sala para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
