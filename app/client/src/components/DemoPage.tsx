import type { ReactNode } from 'react'
import { BackButton } from './BackButton'

export function DemoPage({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <BackButton />
      </div>
      <div className="w-full max-w-6xl">
        {children}
      </div>
      {note && (
        <p className="mt-6 text-gray-400 text-sm max-w-md text-center">
          {note}
        </p>
      )}
    </div>
  )
}
