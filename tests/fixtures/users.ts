import type { User, CreateUserRequest } from '@app/shared/types'

export const mockUsers: User[] = [
  {
    id: 1,
    name: 'João Silva',
    email: 'joao@example.com',
    createdAt: new Date('2024-01-01T10:00:00Z')
  },
  {
    id: 2,
    name: 'Maria Santos',
    email: 'maria@example.com',
    createdAt: new Date('2024-01-02T11:00:00Z')
  },
  {
    id: 3,
    name: 'Pedro Costa',
    email: 'pedro@example.com',
    createdAt: new Date('2024-01-03T12:00:00Z')
  }
]

export const validUserRequests: CreateUserRequest[] = [
  {
    name: 'Ana Lima',
    email: 'ana@example.com'
  },
  {
    name: 'Carlos Oliveira',
    email: 'carlos@example.com'
  },
  {
    name: 'Teste User',
    email: 'teste@example.com'
  }
]

export const invalidUserRequests = [
  {
    name: 'A', // Too short
    email: 'valid@example.com'
  },
  {
    name: 'Valid Name',
    email: 'invalid-email' // Invalid format
  },
  {
    name: '', // Empty name
    email: 'empty@example.com'
  },
  {
    name: 'Valid Name',
    email: '' // Empty email
  },
  {
    name: 'Valid Name'
    // Missing email
  },
  {
    email: 'missing@example.com'
    // Missing name
  }
]

export const duplicateEmailRequest: CreateUserRequest = {
  name: 'Duplicate User',
  email: 'joao@example.com' // Same as first mock user
}