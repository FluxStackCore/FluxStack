import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/app/client/src/App'

// Mock the eden-api module properly for hoisting
vi.mock('@/app/client/src/lib/eden-api', () => ({
  api: {
    health: {
      get: vi.fn(() => Promise.resolve({
        status: "🚀 Hot Reload ativo!",
        timestamp: new Date().toISOString(),
        uptime: "120s",
        version: "1.4.0",
        environment: "development"
      }))
    },
    users: {
      get: vi.fn(() => Promise.resolve({
        users: [
          { id: 1, name: 'Test User 1', email: 'test1@example.com', createdAt: '2024-01-01' },
          { id: 2, name: 'Test User 2', email: 'test2@example.com', createdAt: '2024-01-02' }
        ]
      })),
      post: vi.fn(() => Promise.resolve({
        success: true,
        user: { id: 3, name: 'New User', email: 'new@example.com', createdAt: '2024-01-03' }
      }))
    }
  },
  apiCall: vi.fn((promise) => promise),
  getErrorMessage: vi.fn((error) => error?.message || 'Unknown error')
}))

// TODO: Fix test - needs jsdom environment and updated mocks
describe.skip('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Header and Navigation', () => {
    it('should render header with logo and tabs', () => {
      render(<App />)
      
      const logo = screen.getByText('🔥 FluxStack v1.4.0')
      const overviewTab = screen.getByText('📋 Visão Geral')
      const demoTab = screen.getByText('🚀 Demo')
      const apiDocsTab = screen.getByText('📚 API Docs')
      
      expect(logo).toBeInTheDocument()
      expect(overviewTab).toBeInTheDocument()
      expect(demoTab).toBeInTheDocument()
      expect(apiDocsTab).toBeInTheDocument()
    })

    it('should switch tabs correctly', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      // Initially on overview tab
      expect(screen.getByText('🔥 FluxStack - Hot Reload Ativo! ⚡')).toBeInTheDocument()
      
      // Click demo tab
      await user.click(screen.getByText('🚀 Demo'))
      expect(screen.getByText('🔥 Demo Interativo - Hot Reload Testando!')).toBeInTheDocument()
      
      // Click API docs tab
      await user.click(screen.getByText('📚 API Docs'))
      expect(screen.getByText('Documentação da API')).toBeInTheDocument()
    })

    it('should show API status indicator', () => {
      render(<App />)
      
      const statusBadge = screen.getByText(/API (Online|Offline)/)
      expect(statusBadge).toBeInTheDocument()
    })
  })

  describe('Overview Tab', () => {
    it('should render overview content with features', () => {
      render(<App />)
      
      expect(screen.getByText('🔥 FluxStack - Hot Reload Ativo! ⚡')).toBeInTheDocument()
      expect(screen.getByText('Framework full-stack TypeScript moderno com hot reload coordenado! 🚀')).toBeInTheDocument()
      
      // Check features
      expect(screen.getByText('Elysia.js')).toBeInTheDocument()
      expect(screen.getByText('React + Vite')).toBeInTheDocument()
      expect(screen.getByText('Eden Treaty')).toBeInTheDocument()
      expect(screen.getByText('Docker Ready')).toBeInTheDocument()
    })

    it('should render tech stack information', () => {
      render(<App />)
      
      expect(screen.getByText('Stack Tecnológica')).toBeInTheDocument()
      expect(screen.getByText('Backend')).toBeInTheDocument()
      expect(screen.getByText('Frontend')).toBeInTheDocument()
      expect(screen.getByText('Comunicação')).toBeInTheDocument()
    })
  })

  describe('Demo Tab - User Management', () => {
    it('should render user form in demo tab', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('🚀 Demo'))
      
      expect(screen.getByLabelText('Nome')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /adicionar/i })).toBeInTheDocument()
    })

    it('should handle user form submission', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('🚀 Demo'))
      
      const nameInput = screen.getByLabelText('Nome')
      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: /adicionar/i })
      
      await user.type(nameInput, 'Test User')
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)
      
      // Form should be cleared after submission
      await waitFor(() => {
        expect(nameInput).toHaveValue('')
        expect(emailInput).toHaveValue('')
      })
    })

    it('should display users list in demo tab', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('🚀 Demo'))
      
      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument()
        expect(screen.getByText('test1@example.com')).toBeInTheDocument()
        expect(screen.getByText('Test User 2')).toBeInTheDocument()
        expect(screen.getByText('test2@example.com')).toBeInTheDocument()
      })
    })

    it('should show stats cards in demo tab', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('🚀 Demo'))
      
      expect(screen.getByText('Usuários')).toBeInTheDocument()
      expect(screen.getByText('API Status')).toBeInTheDocument()
      expect(screen.getByText('Eden Treaty')).toBeInTheDocument()
    })

    it('should not submit form with empty fields', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('🚀 Demo'))
      
      const submitButton = screen.getByRole('button', { name: /adicionar/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('API Docs Tab', () => {
    it('should render API documentation content', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('📚 API Docs'))
      
      expect(screen.getByText('Documentação da API')).toBeInTheDocument()
      expect(screen.getByText('Documentação interativa gerada automaticamente com Swagger')).toBeInTheDocument()
    })

    it('should have swagger links in API docs tab', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('📚 API Docs'))
      
      const swaggerLink = screen.getByText('🚀 Abrir em Nova Aba')
      const jsonLink = screen.getByText('📋 Ver JSON')
      
      expect(swaggerLink.closest('a')).toHaveAttribute('href', '/swagger')
      expect(jsonLink.closest('a')).toHaveAttribute('href', '/swagger/json')
    })

    it('should render Eden Treaty code examples', async () => {
      const user = userEvent.setup()
      render(<App />)
      
      await user.click(screen.getByText('📚 API Docs'))
      
      expect(screen.getByText('🔧 Como usar Eden Treaty')).toBeInTheDocument()
      expect(screen.getByText('Configuração do Cliente:')).toBeInTheDocument()
      expect(screen.getByText('Exemplos de Uso:')).toBeInTheDocument()
    })
  })

  describe('API Integration', () => {
    it('should check API status on mount', async () => {
      const { api } = await import('@/app/client/src/lib/eden-api')
      render(<App />)
      
      await waitFor(() => {
        expect(api.health.get).toHaveBeenCalled()
      })
    })

    it('should load users on mount', async () => {
      const { api } = await import('@/app/client/src/lib/eden-api')
      render(<App />)
      
      await waitFor(() => {
        expect(api.users.get).toHaveBeenCalled()
      })
    })
  })

  describe('Toast Messages', () => {
    it('should not show toast initially', () => {
      render(<App />)
      
      const toast = screen.queryByRole('alert')
      expect(toast).not.toBeInTheDocument()
    })
  })
})