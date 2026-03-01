// TodoListDemo - Lista de tarefas colaborativa em tempo real

import { useState } from 'react'
import { Live } from '@/core/client'
import { LiveTodoList } from '@server/live/LiveTodoList'

export function TodoListDemo() {
  const [text, setText] = useState('')

  const todoList = Live.use(LiveTodoList, {
    room: 'global-todos'
  })

  const handleAdd = async () => {
    if (!text.trim()) return
    await todoList.addTodo({ text })
    setText('')
  }

  const todos = todoList.$state.todos ?? []
  const doneCount = todos.filter((t: any) => t.done).length
  const pendingCount = todos.length - doneCount

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 max-w-lg w-full mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">
        Todo List Colaborativo
      </h2>

      <p className="text-gray-400 text-xs sm:text-sm text-center mb-4">
        Abra em várias abas - todos compartilham a mesma lista!
      </p>

      {/* Status bar */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
          todoList.$connected
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-red-500/20 text-red-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            todoList.$connected ? 'bg-emerald-400' : 'bg-red-400'
          }`} />
          {todoList.$connected ? 'Conectado' : 'Desconectado'}
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">
          {todoList.$state.connectedUsers} online
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300">
          {todoList.$state.totalCreated} criadas
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Nova tarefa..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!todoList.$connected || !text.trim()}
          className="px-5 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-xl transition-all disabled:opacity-50 font-medium"
        >
          +
        </button>
      </div>

      {/* Stats */}
      {todos.length > 0 && (
        <div className="flex justify-between items-center mb-4 text-xs text-gray-500">
          <span>{pendingCount} pendente(s) / {doneCount} feita(s)</span>
          {doneCount > 0 && (
            <button
              onClick={() => todoList.clearCompleted()}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Limpar feitas
            </button>
          )}
        </div>
      )}

      {/* Todo list */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {todos.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Nenhuma tarefa ainda. Adicione uma acima!
          </p>
        ) : (
          todos.map((todo: any) => (
            <div
              key={todo.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                todo.done
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <button
                onClick={() => todoList.toggleTodo({ id: todo.id })}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  todo.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-gray-500 hover:border-purple-400'
                }`}
              >
                {todo.done && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <span className={`flex-1 text-sm ${
                todo.done ? 'text-gray-500 line-through' : 'text-white'
              }`}>
                {todo.text}
              </span>

              <span className="text-[10px] text-gray-600 flex-shrink-0">
                {todo.createdBy}
              </span>

              <button
                onClick={() => todoList.removeTodo({ id: todo.id })}
                className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Loading indicator */}
      {todoList.$loading && (
        <div className="flex justify-center mt-4">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-white/10">
        <p className="text-gray-500 text-xs text-center">
          Usando <code className="text-purple-400">Live.use()</code> + <code className="text-purple-400">Room Events</code>
        </p>
      </div>
    </div>
  )
}
