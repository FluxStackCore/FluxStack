import { describe, it, expect, beforeEach } from 'vitest'
import { UsersController } from '@app/server/controllers/users.controller'
import type { CreateUserRequest } from '@app/shared/types'

describe('UsersController', () => {
  beforeEach(() => {
    UsersController.resetForTesting()
  })

  describe('getUsers', () => {
    it('should return users list with metadata', async () => {
      const result = await UsersController.getUsers()

      expect(result.success).toBe(true)
      expect(typeof result.count).toBe('number')
      expect(Array.isArray(result.users)).toBe(true)
    })

    it('should return users with correct structure', async () => {
      const result = await UsersController.getUsers()

      if (result.users.length > 0) {
        const user = result.users[0]
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('name')
        expect(user).toHaveProperty('email')
        expect(user).toHaveProperty('createdAt')
      }
    })
  })

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData: CreateUserRequest = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const result = await UsersController.createUser(userData)

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.name).toBe(userData.name)
      expect(result.user?.email).toBe(userData.email)
      expect(result.user?.id).toBeDefined()
      expect(result.user?.createdAt).toBeDefined()
      expect(result.message).toBe('Usuario criado com sucesso')
    })

    it('should prevent duplicate email addresses', async () => {
      const userData: CreateUserRequest = {
        name: 'Test User',
        email: 'duplicate@example.com'
      }

      await UsersController.createUser(userData)

      const secondResult = await UsersController.createUser(userData)
      expect(secondResult.success).toBe(false)
      expect(secondResult.error).toBe('Email ja esta em uso')
      expect(secondResult.user).toBeUndefined()
    })

    it('should generate unique IDs for different users', async () => {
      const user1Data: CreateUserRequest = {
        name: 'User 1',
        email: 'user1@example.com'
      }

      const user2Data: CreateUserRequest = {
        name: 'User 2',
        email: 'user2@example.com'
      }

      const result1 = await UsersController.createUser(user1Data)
      await new Promise(resolve => setTimeout(resolve, 2))
      const result2 = await UsersController.createUser(user2Data)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.user?.id).not.toBe(result2.user?.id)
    })
  })

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userData: CreateUserRequest = {
        name: 'Findable User',
        email: 'findable@example.com'
      }

      const createResult = await UsersController.createUser(userData)
      const userId = createResult.user!.id
      const result = await UsersController.getUserById(userId)

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.id).toBe(userId)
      expect(result.user?.name).toBe(userData.name)
      expect(result.user?.email).toBe(userData.email)
    })

    it('should return failure when user not found', async () => {
      const result = await UsersController.getUserById(99999)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Usuario nao encontrado')
    })
  })

  describe('deleteUser', () => {
    it('should delete existing user successfully', async () => {
      const userData: CreateUserRequest = {
        name: 'Deletable User',
        email: 'deletable@example.com'
      }

      const createResult = await UsersController.createUser(userData)
      const userId = createResult.user!.id
      const deleteResult = await UsersController.deleteUser(userId)

      expect(deleteResult.success).toBe(true)
      expect(deleteResult.message).toBe('Usuario deletado com sucesso')

      const findResult = await UsersController.getUserById(userId)
      expect(findResult.success).toBe(false)
    })

    it('should return error when trying to delete non-existent user', async () => {
      const result = await UsersController.deleteUser(99999)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Usuario nao encontrado')
    })
  })
})
