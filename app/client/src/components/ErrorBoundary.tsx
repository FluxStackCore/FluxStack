import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FluxStack] Component error:', error, errorInfo.componentStack)
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }
      return <DefaultErrorFallback error={this.state.error} onReset={this.reset} />
    }
    return this.props.children
  }
}

function DefaultErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const isDev = import.meta.env.DEV

  return (
    <div className="flex items-center justify-center p-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 sm:p-8 max-w-lg w-full text-center">
        <div className="text-4xl mb-4">!</div>
        <h2 className="text-xl font-bold text-red-300 mb-2">Something went wrong</h2>
        <p className="text-gray-400 text-sm mb-4">
          An unexpected error occurred while rendering this component.
        </p>
        {isDev && (
          <details className="text-left mb-4">
            <summary className="text-red-400 text-xs cursor-pointer hover:text-red-300 transition-colors">
              Error details
            </summary>
            <pre className="mt-2 p-3 bg-black/30 rounded-lg text-red-300 text-xs overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <button
          onClick={onReset}
          className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl text-sm transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
