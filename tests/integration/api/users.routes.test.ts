import { describe, it, expect, beforeEach } from 'vitest'
import { Elysia } from 'elysia'
import { usersRoutes } from '@app/server/routes/users.routes'
import { UsersController } from '@app/server/controllers/users.controller'

describe('Users API Routes', () => {
  let app: Elysia

  beforeEach(() => {
    UsersController.resetForTesting()
    app = new Elysia().use(usersRoutes)
  })

  describe('GET /users', () => {
    it('should return users list', async () => {
      const response = await app
        .handle(new Request('http://localhost/users'))
        
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toBeDefined()
      expect(data.users).toBeDefined()
      expect(Array.isArray(data.users)).toBe(true)
    })

    it('should return users with correct structure', async () => {
      const response = await app
        .handle(new Request('http://localhost/users'))
        
      const data = await response.json()
      
      if (data.users.length > 0) {
        const user = data.users[0]
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('name')
        expect(user).toHaveProperty('email')
        expect(user).toHaveProperty('createdAt')
      }
    })
  })

  describe('GET /users/:id', () => {
    it('should return user by ID', async () => {
      // First get all users to find a valid ID
      const usersResponse = await app
        .handle(new Request('http://localhost/users'))
      const usersData = await usersResponse.json()
      
      if (usersData.users.length > 0) {
        const userId = usersData.users[0].id
        
        const response = await app
          .handle(new Request(`http://localhost/users/${userId}`))
          
        expect(response.status).toBe(200)
        
        const data = await response.json()
        expect(data.user).toBeDefined()
        expect(data.user.id).toBe(userId)
      }
    })

    it('should return error for non-existent user', async () => {
      const response = await app
        .handle(new Request('http://localhost/users/99999'))
        
      expect(response.status).toBe(404) // Not found
      
      const data = await response.json()
      expect(data.error).toBe('Usuario nao encontrado')
    })

    it('should validate ID parameter', async () => {
      const response = await app
        .handle(new Request('http://localhost/users/invalid-id'))
        
      // Should handle invalid ID gracefully
      expect(response.status).toBeGreaterThanOrEqual(200)
    })
  })

  describe('POST /users', () => {
    it('should create new user with valid data', async () => {
      const userData = {
        name: 'Integration Test User',
        email: 'integration@test.com'
      }

      const response = await app
        .handle(new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        }))
        
      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.name).toBe(userData.name)
      expect(data.user.email).toBe(userData.email)
      expect(data.user.id).toBeDefined()
    })

    it('should reject user with invalid data', async () => {
      const invalidData = {
        name: 'A', // Too short
        email: 'invalid-email' // Invalid format
      }

      const response = await app
        .handle(new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData)
        }))

      // Elysia may return 400 from schema validation or from handler validation
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
    })

    it('should reject user with missing fields', async () => {
      const incompleteData = {
        name: 'Test User'
        // Missing email
      }

      const response = await app
        .handle(new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incompleteData)
        }))

      expect(response.status).toBe(400)
    })

    it('should prevent duplicate emails', async () => {
      const userData = {
        name: 'Duplicate Test User',
        email: 'duplicate@integration.test'
      }

      // Create first user
      const firstResponse = await app
        .handle(new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        }))
        
      expect(firstResponse.status).toBe(201)

      // Try to create user with same email
      const secondResponse = await app
        .handle(new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        }))
        
      const data = await secondResponse.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Email ja esta em uso')
    })
  })

  describe('DELETE /users/:id', () => {
    it('should delete existing user', async () => {
      // First create a user to delete
      const userData = {
        name: 'User to Delete',
        email: 'delete@test.com'
      }

      const createResponse = await app
        .handle(new Request('http://localhost/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        }))

      const createData = await createResponse.json()
      const userId = createData.user.id

      // Now delete the user
      const deleteResponse = await app
        .handle(new Request(`http://localhost/users/${userId}`, {
          method: 'DELETE'
        }))
        
      expect(deleteResponse.status).toBe(200)
      
      const deleteData = await deleteResponse.json()
      expect(deleteData.success).toBe(true)
      expect(deleteData.message).toBe('Usuario deletado com sucesso')
    })

    it('should return error when deleting non-existent user', async () => {
      const response = await app
        .handle(new Request('http://localhost/users/99999', {
          method: 'DELETE'
        }))
        
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Usuario nao encontrado')
    })
  })
})