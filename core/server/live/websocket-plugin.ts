// FluxStack Live Components Plugin — delegates to @fluxstack/live

import { LiveServer } from '@fluxstack/live'
import type { LiveAuthProvider } from '@fluxstack/live'
import { ElysiaTransport } from '@fluxstack/live-elysia'
import type { Plugin, PluginContext } from '@core/plugins/types'
import path from 'path'

// Expose the LiveServer instance so other parts of FluxStack can access it
export let liveServer: LiveServer | null = null

// Queue for auth providers registered before LiveServer is created
export const pendingAuthProviders: LiveAuthProvider[] = []

export const liveComponentsPlugin: Plugin = {
  name: 'live-components',
  version: '2.0.0',
  description: 'Real-time Live Components powered by @fluxstack/live',
  author: 'FluxStack Team',
  priority: 'normal',
  category: 'core',
  tags: ['websocket', 'real-time', 'live-components'],

  setup: async (context: PluginContext) => {
    const transport = new ElysiaTransport(context.app)
    const componentsPath = path.join(process.cwd(), 'app', 'server', 'live')

    liveServer = new LiveServer({
      transport,
      componentsPath,
      wsPath: '/api/live/ws',
      httpPrefix: '/api/live',
    })

    // Replay any auth providers that were registered before setup()
    for (const provider of pendingAuthProviders) {
      liveServer.useAuth(provider)
    }
    pendingAuthProviders.length = 0

    await liveServer.start()
    context.logger.debug('Live Components started via @fluxstack/live')
  },

  onServerStart: async (context: PluginContext) => {
    context.logger.debug('Live Components WebSocket ready on /api/live/ws')
  }
}
