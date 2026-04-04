// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '@/app/client/src/components/ErrorBoundary'
import { LiveErrorBoundary } from '@/app/client/src/components/LiveErrorBoundary'

// Suppress React error boundary console.error noise in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function ThrowingComponent({ message }: { message: string }): never {
  throw new Error(message)
}

function GoodComponent() {
  return <div>Working fine</div>
}

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Working fine')).toBeTruthy()
  })

  it('should render default fallback on error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test crash" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Try again')).toBeTruthy()
  })

  it('should render custom ReactNode fallback', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent message="Test crash" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeTruthy()
  })

  it('should render custom function fallback with error and reset', () => {
    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>Error: {error.message}</span>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ThrowingComponent message="Specific error" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Error: Specific error')).toBeTruthy()
    expect(screen.getByText('Reset')).toBeTruthy()
  })

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent message="Callback test" />
      </ErrorBoundary>
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toBe('Callback test')
  })

  it('should reset and re-render children on Try again click', () => {
    let shouldThrow = true
    function MaybeThrow() {
      if (shouldThrow) throw new Error('Temporary error')
      return <div>Recovered</div>
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()

    shouldThrow = false
    fireEvent.click(screen.getByText('Try again'))
    expect(screen.getByText('Recovered')).toBeTruthy()
  })
})

describe('LiveErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <LiveErrorBoundary>
        <GoodComponent />
      </LiveErrorBoundary>
    )
    expect(screen.getByText('Working fine')).toBeTruthy()
  })

  it('should render live-specific fallback on error', () => {
    render(
      <LiveErrorBoundary>
        <ThrowingComponent message="WS crash" />
      </LiveErrorBoundary>
    )
    expect(screen.getByText('Live Component Error')).toBeTruthy()
    expect(screen.getByText('Reconnect')).toBeTruthy()
  })

  it('should recover after clicking Reconnect', () => {
    let shouldThrow = true
    function MaybeLiveThrow() {
      if (shouldThrow) throw new Error('Connection lost')
      return <div>Reconnected</div>
    }

    render(
      <LiveErrorBoundary>
        <MaybeLiveThrow />
      </LiveErrorBoundary>
    )
    expect(screen.getByText('Live Component Error')).toBeTruthy()

    shouldThrow = false
    fireEvent.click(screen.getByText('Reconnect'))
    expect(screen.getByText('Reconnected')).toBeTruthy()
  })
})
