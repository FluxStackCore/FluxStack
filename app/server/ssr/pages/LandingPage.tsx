/**
 * SSR Landing Page — server-rendered with client slots for interactive parts
 */
import { SSRLayout } from '../components/Layout'
import { FeatureCard } from '../components/FeatureCard'
import { CodeBlock } from '../components/CodeBlock'
import { ClientSlot } from '../components/ClientSlot'

export function LandingPage() {
  return (
    <SSRLayout activeRoute="/">
      {/* Hero */}
      <div className="text-center py-16 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-black shadow-lg shadow-purple-500/20">
            F
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
            FluxStack
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Build <span className="text-white font-semibold">real-time web apps</span> with
            end-to-end type safety. Powered by{' '}
            <span className="text-purple-400">Bun</span>,{' '}
            <span className="text-indigo-400">Elysia</span>, and{' '}
            <span className="text-cyan-400">React 19</span>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="/counter"
              className="px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-medium transition-all shadow-lg shadow-purple-500/20"
            >
              Try Demo
            </a>
            <a
              href="https://github.com/FluxStackCore/FluxStack"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] text-white font-medium transition-all"
            >
              GitHub ⭐
            </a>
          </div>
        </div>
      </div>

      {/* Live Counter — client-side component slot */}
      <div className="max-w-md mx-auto mb-16">
        <h2 className="text-center text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Live Demo — Real-time Counter
        </h2>
        <ClientSlot name="LiveCounter" fallback="Connecting to server..." className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6" />
      </div>

      {/* Features */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">
          Why <span className="text-purple-400">FluxStack</span>?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon="⚡"
            title="Bun Runtime"
            description="3x faster than Node.js. Native TypeScript, built-in bundler, ultra-fast package manager."
            color="purple"
          />
          <FeatureCard
            icon="🔒"
            title="Type Safe End-to-End"
            description="Eden Treaty infers API types automatically. Zero manual DTOs, zero unknown types."
            color="indigo"
          />
          <FeatureCard
            icon="🔥"
            title="LiveComponents"
            description="Server-side state with auto-sync via WebSocket. this.state.count++ just works."
            color="cyan"
          />
          <FeatureCard
            icon="🔌"
            title="Plugin System"
            description="Extensible with security. Auto-discovery with npm whitelist protection."
            color="emerald"
          />
          <FeatureCard
            icon="🛡️"
            title="CSRF Protection"
            description="Built-in Double-Submit Cookie pattern. Auto-injects tokens on every request."
            color="pink"
          />
          <FeatureCard
            icon="⚙️"
            title="Declarative Config"
            description="Laravel-inspired schema-based configuration. Type-safe, validated at boot."
            color="amber"
          />
        </div>
      </div>

      {/* Get Started */}
      <div className="max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-center mb-6">Get Started</h2>
        <CodeBlock code={`bun create fluxstack my-app
cd my-app
bun run dev`} />
        <p className="text-center text-gray-500 text-sm mt-4">
          Ready in seconds. Hot reload, type safety, real-time — out of the box.
        </p>
      </div>
    </SSRLayout>
  )
}
