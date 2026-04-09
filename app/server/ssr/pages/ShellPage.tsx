/**
 * SSR Shell — renders only the layout (header, nav, footer).
 * The React SPA mounts inside <div id="spa-outlet">.
 *
 * Used for all SPA routes (/counter, /form, /room-chat, etc.)
 * so the layout loads instantly from the server and the interactive
 * content mounts client-side.
 */
import { SSRLayout } from '../components/Layout'

export function ShellPage({ activeRoute = '/' }: { activeRoute?: string }) {
  return (
    <SSRLayout activeRoute={activeRoute}>
      {/* No children — the SPA outlet in Layout.tsx handles client content */}
    </SSRLayout>
  )
}
