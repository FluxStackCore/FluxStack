'use client'
import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

function LiveErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const isDev = import.meta.env.DEV

  return (
    <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-6 py-10">
      <style>{`
        @keyframes fluxstack-slow-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-r from-amber-500/18 to-orange-500/14 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-xl">
        <div className="absolute -inset-2 rounded-3xl bg-linear-to-r from-amber-500/16 via-orange-500/10 to-amber-500/16 blur-2xl" />

        <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <svg
              className="h-9 w-9 text-amber-300"
              style={{ animation: 'fluxstack-slow-pulse 3.6s ease-in-out infinite' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 8.5c5.25-5.25 13.75-5.25 19 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.75 11.75c3.45-3.45 9.05-3.45 12.5 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.25 15.25c1.52-1.52 3.98-1.52 5.5 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            </svg>
          </div>

          <h3 className="mb-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Live connection interrupted</h3>
          <p className="mx-auto mb-7 max-w-md text-sm leading-6 text-white/60 sm:text-base">
            This real-time FluxStack component lost its live connection or hit a transient runtime error.
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
            className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition-transform duration-200 hover:scale-[1.02] hover:from-amber-400 hover:to-orange-400"
          >
            Reconnect
          </button>

          <p className="mt-4 text-xs leading-5 text-white/45 sm:text-sm">
            Reconnecting usually restores live updates within a few seconds.
          </p>
        </div>
      </div>
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
