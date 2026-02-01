import type { CreateUserRequest } from '@/app/shared/types'

export interface User {
  id: number
  name: string
  email: string
  createdAt: Date
}

let users: User[] = []
let nextId = 1

export class UsersController {
  static async getUsers() {
    return {
      success: true as const,
      users,
      count: users.length
    }
  }

  static async getUserById(id: number) {
    const user = users.find(u => u.id === id)
    if (!user) {
      return {
        success: false as const,
        error: 'Usuario nao encontrado'
      }
    }
    return {
      success: true as const,
      user
    }
  }

  static async createUser(data: CreateUserRequest) {
    const existingUser = users.find(u => u.email === data.email)
    if (existingUser) {
      return {
        success: false as const,
        error: 'Email ja esta em uso'
      }
    }

    const newUser: User = {
      id: nextId++,
      name: data.name,
      email: data.email,
      createdAt: new Date()
    }

    users.push(newUser)

    return {
      success: true as const,
      user: newUser,
      message: 'Usuario criado com sucesso'
    }
  }

  static async deleteUser(id: number) {
    const userIndex = users.findIndex(u => u.id === id)

    if (userIndex === -1) {
      return {
        success: false as const,
        message: 'Usuario nao encontrado'
      }
    }

    users.splice(userIndex, 1)

    return {
      success: true as const,
      message: 'Usuario deletado com sucesso'
    }
  }

  static resetForTesting() {
    users = []
    nextId = 1
  }
}
