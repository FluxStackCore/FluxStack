/**
 * SSR About Page
 */
import { SSRLayout } from '../components/Layout'
import { FeatureCard } from '../components/FeatureCard'

export function AboutPage() {
  return (
    <SSRLayout activeRoute="/about">
      <div className="max-w-3xl mx-auto py-12">
        <h1 className="text-4xl font-extrabold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          About FluxStack
        </h1>

        <p className="text-gray-300 text-lg mb-8 leading-relaxed">
          FluxStack is a modern full-stack TypeScript framework that combines the power of{' '}
          <span className="text-purple-400 font-semibold">Bun</span>,{' '}
          <span className="text-indigo-400 font-semibold">Elysia</span>,{' '}
          <span className="text-cyan-400 font-semibold">React 19</span>, and real-time WebSocket
          components into a cohesive development experience.
        </p>

        <h2 className="text-2xl font-bold mb-4 text-white">Architecture</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <FeatureCard
            icon="🏗️"
            title="Backend: Elysia"
            description="Ultra-performant HTTP server with built-in validation, Swagger, and WebSocket support."
            color="purple"
          />
          <FeatureCard
            icon="⚛️"
            title="Frontend: React 19"
            description="Latest React with Vite 7 for instant HMR. Tailwind CSS 4 for styling."
            color="cyan"
          />
          <FeatureCard
            icon="🔄"
            title="Realtime: LiveComponents"
            description="Server-side components that auto-sync state to the client via WebSocket. Inspired by Phoenix LiveView."
            color="emerald"
          />
          <FeatureCard
            icon="📦"
            title="Config: @fluxstack/config"
            description="Standalone config package with schema validation, env var mapping, and extendConfig() for plugins."
            color="amber"
          />
        </div>

        <h2 className="text-2xl font-bold mb-4 text-white">Open Source</h2>

        <p className="text-gray-400 mb-6">
          FluxStack is open source and available on GitHub. Contributions are welcome!
        </p>

        <div className="flex gap-3">
          <a
            href="https://github.com/FluxStackCore/FluxStack"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] text-white text-sm font-medium transition-all"
          >
            GitHub Repository
          </a>
          <a
            href="https://www.npmjs.com/package/create-fluxstack"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] text-white text-sm font-medium transition-all"
          >
            npm Package
          </a>
        </div>
      </div>
    </SSRLayout>
  )
}
