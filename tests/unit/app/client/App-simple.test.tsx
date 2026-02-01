// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getErrorMessage } from '@/app/client/src/lib/eden-api'

// Simple component test without full App complexity
function SimpleHeader({ title }: { title: string }) {
  return (
    <header>
      <div>{title}</div>
    </header>
  )
}

describe.skip('Simple App Components', () => {
  describe('Header Component', () => {
    it('should render header with title', () => {
      render(<SimpleHeader title="FluxStack v1.4.0" />)
      expect(screen.getByText('FluxStack v1.4.0')).toBeInTheDocument()
    })
  })

  describe('Error Handling Utilities', () => {
    it('should handle Eden Treaty style errors', () => {
      const apiError = { value: { message: 'Test error' } }
      const message = getErrorMessage(apiError)
      expect(message).toBe('Test error')
    })

    it('should handle regular errors', () => {
      const regularError = new Error('Regular error')
      const message = getErrorMessage(regularError)
      expect(message).toBe('Regular error')
    })

    it('should handle unknown errors', () => {
      const message = getErrorMessage('string error')
      expect(message).toBe('An unexpected error occurred')
    })
  })
})
