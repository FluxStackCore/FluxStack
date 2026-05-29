'use client'
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 bg-gradient-to-br from-slate-900 via-purple-900/80 to-slate-900">
      <style>{`
        @keyframes fluxstack-slow-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-r from-purple-500/18 to-indigo-500/14 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="absolute -inset-2 rounded-3xl bg-linear-to-r from-purple-500/16 via-fuchsia-500/10 to-indigo-500/16 blur-2xl" />

        <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <svg
              className="h-9 w-9 text-purple-300"
              style={{ animation: 'fluxstack-slow-pulse 3.6s ease-in-out infinite' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v4.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5h.008v.008H12V16.5Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.252 3.942 1.93 18.002A1.5 1.5 0 0 0 3.22 20.25h17.56a1.5 1.5 0 0 0 1.29-2.248L13.748 3.942a2 2 0 0 0-3.496 0Z" />
            </svg>
          </div>

          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Something went wrong</h2>
          <p className="mx-auto mb-7 max-w-md text-sm leading-6 text-white/60 sm:text-base">
            FluxStack hit an unexpected rendering error in this view. You can safely retry and continue working.
          </p>

          {isDev && (
            <details className="mb-7 overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20 text-left group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white/75 transition-colors hover:text-white">
                <span>Error details</span>
                <svg className="h-4 w-4 text-white/45 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
                </svg>
              </summary>
              <div className="border-t border-white/[0.06] px-4 py-4">
                <pre className="max-h-56 overflow-auto rounded-xl border border-white/[0.06] bg-black/35 p-4 font-mono text-xs leading-6 text-white/70 whitespace-pre-wrap break-words">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </div>
            </details>
          )}

          <button
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-950/30 transition-transform duration-200 hover:scale-[1.02] hover:from-purple-400 hover:to-indigo-400"
          >
            Try again
          </button>

          <p className="mt-4 text-xs leading-5 text-white/45 sm:text-sm">
            If the issue persists, refresh the page or check the console for more context.
          </p>
        </div>
      </div>
    </div>
  )
}

