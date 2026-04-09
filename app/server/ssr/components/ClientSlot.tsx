/**
 * ClientSlot — Placeholder for client-side components in SSR pages
 *
 * Renders a container div with data attributes that the client-side
 * React app can find and mount interactive components into.
 *
 * Usage in SSR:
 *   <ClientSlot name="counter" fallback="Loading counter..." />
 *
 * Client-side hydration finds these slots and mounts components:
 *   document.querySelectorAll('[data-client-slot]').forEach(...)
 */

export function ClientSlot({ name, fallback, className = '' }: {
  /** Component name — matches client-side registry */
  name: string
  /** Loading text shown before client hydrates */
  fallback?: string
  /** Extra CSS classes */
  className?: string
}) {
  return (
    <div
      data-client-slot={name}
      className={`${className}`}
    >
      {fallback && (
        <div className="flex items-center justify-center p-8 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <span>{fallback}</span>
          </div>
        </div>
      )}
    </div>
  )
}
