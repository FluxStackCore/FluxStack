// FluxStack Live Components Plugin — delegates to @fluxstack/live

import { LiveServer, RoomRegistry } from '@fluxstack/live'
import type { LiveAuthProvider, LiveRoomClass } from '@fluxstack/live'
import { ElysiaTransport } from '@fluxstack/live-elysia'
import type { Plugin, PluginContext } from '@core/plugins/types'
import { generateLiveComponentsFile } from '@fluxstack/live/build'
import path from 'path'
import { readdirSync, existsSync } from 'fs'

// Expose the LiveServer instance so other parts of FluxStack can access it
export let liveServer: LiveServer | null = null

// Queue for auth providers registered before LiveServer is created
export const pendingAuthProviders: LiveAuthProvider[] = []
// Queue for room classes registered before LiveServer is created
export const pendingRoomClasses: LiveRoomClass[] = []

export const liveComponentsPlugin: Plugin = {
  name: 'live-components',
  version: '2.0.0',
  description: 'Real-time Live Components powered by @fluxstack/live',
  author: 'FluxStack Team',
  priority: 'normal',
  category: 'core',
  tags: ['websocket', 'real-time', 'live-components'],

  setup: async (context: PluginContext) => {
    // Generate auto-generated-components.ts then import it dynamically
    const componentsPath = path.join(process.cwd(), 'app', 'server', 'live')
    generateLiveComponentsFile({
      componentsDir: componentsPath,
      outFile: path.join(__dirname, 'auto-generated-components.ts'),
      importPrefix: '@app/server/live',
    })
    const { liveComponentClasses } = await import('./auto-generated-components')

    const transport = new ElysiaTransport(context.app as import('elysia').Elysia)

    // Auto-discover LiveRoom classes from rooms/ directory
    const roomsPath = path.join(componentsPath, 'rooms')
    const discoveredRooms = await discoverRoomClasses(roomsPath)

    liveServer = new LiveServer({
      transport,
      componentsPath,
      wsPath: '/api/live/ws',
      httpPrefix: '/api/live',
      rooms: [...discoveredRooms, ...pendingRoomClasses],
      components: liveComponentClasses,
    })

    // Replay any auth providers that were registered before setup()
    for (const provider of pendingAuthProviders) {
      liveServer.useAuth(provider)
    }
    pendingAuthProviders.length = 0
    pendingRoomClasses.length = 0

    await liveServer.start()
    context.logger.debug('Live Components started via @fluxstack/live')
  },

  onServerStart: async (context: PluginContext) => {
    context.logger.debug('Live Components WebSocket ready on /api/live/ws')
  }
}

/**
 * Auto-discover LiveRoom classes from a directory.
 * Scans all .ts files, imports them, and checks for LiveRoom subclasses.
 */
async function discoverRoomClasses(dir: string): Promise<LiveRoomClass[]> {
  if (!existsSync(dir)) return []

  const rooms: LiveRoomClass[] = []
  const files = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))

  for (const file of files) {
    try {
      const mod = await import(path.join(dir, file))
      for (const exported of Object.values(mod)) {
        if (RoomRegistry.isLiveRoomClass(exported)) {
          rooms.push(exported as LiveRoomClass)
        }
      }
    } catch {
      // Skip files that fail to import
    }
  }

  return rooms
}
