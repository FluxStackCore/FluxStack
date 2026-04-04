import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

function LiveErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const isDev = import.meta.env.DEV

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 sm:p-8 max-w-md w-full text-center">
      <div className="text-3xl mb-3">~</div>
      <h3 className="text-lg font-bold text-amber-300 mb-2">Live Component Error</h3>
      <p className="text-gray-400 text-sm mb-4">
        This real-time component encountered an error. The connection may have been lost.
      </p>
      {isDev && (
        <pre className="mb-4 p-3 bg-black/30 rounded-lg text-amber-300 text-xs overflow-auto max-h-32 text-left">
          {error.message}
        </pre>
      )}
      <button
        onClick={onReset}
        className="px-5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-sm transition-all"
      >
        Reconnect
      </button>
    </div>
  )
}

export function LiveErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <LiveErrorFallback error={error} onReset={reset} />}
    >
      {children}
    </ErrorBoundary>
  )
}
