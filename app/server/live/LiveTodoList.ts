// LiveTodoList - Lista de tarefas colaborativa em tempo real
// Testa: state mutations, room events, multiple actions, arrays no state

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { TodoListDemo as _Client } from '@client/src/live/TodoListDemo'

interface TodoItem {
  id: string
  text: string
  done: boolean
  createdBy: string
  createdAt: number
}

export class LiveTodoList extends LiveComponent<typeof LiveTodoList.defaultState> {
  static componentName = 'LiveTodoList'
  static publicActions = ['addTodo', 'toggleTodo', 'removeTodo', 'clearCompleted'] as const
  static defaultState = {
    todos: [] as TodoItem[],
    totalCreated: 0,
    connectedUsers: 0
  }
  protected roomType = 'todo'

  constructor(initialState: Partial<typeof LiveTodoList.defaultState> = {}, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    super(initialState, ws, options)

    this.onRoomEvent<{ todos: TodoItem[]; totalCreated: number }>('TODOS_CHANGED', (data) => {
      this.setState({ todos: data.todos, totalCreated: data.totalCreated })
    })

    this.onRoomEvent<{ connectedUsers: number }>('USER_COUNT_CHANGED', (data) => {
      this.setState({ connectedUsers: data.connectedUsers })
    })

    const newCount = this.state.connectedUsers + 1
    this.emitRoomEventWithState('USER_COUNT_CHANGED', { connectedUsers: newCount }, { connectedUsers: newCount })
  }

  async addTodo(payload: { text: string }) {
    if (!payload.text?.trim()) {
      return { success: false, error: 'Text is required' }
    }

    const todo: TodoItem = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: payload.text.trim(),
      done: false,
      createdBy: this.userId || 'anonymous',
      createdAt: Date.now()
    }

    const nextTodos = [...this.state.todos, todo]
    const nextTotal = this.state.totalCreated + 1

    this.emitRoomEventWithState(
      'TODOS_CHANGED',
      { todos: nextTodos, totalCreated: nextTotal },
      { todos: nextTodos, totalCreated: nextTotal }
    )

    return { success: true, todo }
  }

  async toggleTodo(payload: { id: string }) {
    const nextTodos = this.state.todos.map(t =>
      t.id === payload.id ? { ...t, done: !t.done } : t
    )

    this.emitRoomEventWithState(
      'TODOS_CHANGED',
      { todos: nextTodos, totalCreated: this.state.totalCreated },
      { todos: nextTodos }
    )

    return { success: true }
  }

  async removeTodo(payload: { id: string }) {
    const nextTodos = this.state.todos.filter(t => t.id !== payload.id)

    this.emitRoomEventWithState(
      'TODOS_CHANGED',
      { todos: nextTodos, totalCreated: this.state.totalCreated },
      { todos: nextTodos }
    )

    return { success: true }
  }

  async clearCompleted() {
    const nextTodos = this.state.todos.filter(t => !t.done)

    this.emitRoomEventWithState(
      'TODOS_CHANGED',
      { todos: nextTodos, totalCreated: this.state.totalCreated },
      { todos: nextTodos }
    )

    return { success: true, removed: this.state.todos.length - nextTodos.length }
  }

  destroy() {
    const newCount = Math.max(0, this.state.connectedUsers - 1)
    this.emitRoomEvent('USER_COUNT_CHANGED', { connectedUsers: newCount })
    super.destroy()
  }
}
