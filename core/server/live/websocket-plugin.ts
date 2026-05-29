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
    const isProd = process.env.NODE_ENV === 'production'
    const componentsPath = path.join(process.cwd(), 'app', 'server', 'live')

    // Em DEV: (re)gera o auto-generated-components.ts varrendo o disco.
    // Em PROD: o app/server/live não existe no dist — o registro estático já
    // foi gerado no build e bundlado. Pular a geração (evita erro de FS).
    if (!isProd) {
      generateLiveComponentsFile({
        componentsDir: componentsPath,
        outFile: path.join(__dirname, 'auto-generated-components.ts'),
        importPrefix: '@app/server/live',
      })
    }
    const { liveComponentClasses } = await import('./auto-generated-components')

    // dual-Elysia: FluxStack tem elysia@1.4.7, @fluxstack/live-elysia (monorepo
    // linkado) tem elysia@1.4.28 — tipos de instâncias DIFERENTES, mesma API em
    // runtime. `as never` neutraliza o mismatch de tipo no argumento.
    const transport = new ElysiaTransport(context.app as never)

    // Rooms: em DEV, auto-descobre varrendo rooms/ (import do disco). Em PROD,
    // usa o registro ESTÁTICO (@app/server/live/rooms) — import do disco em prod
    // carregaria uma instância separada do @fluxstack/live (context null). O
    // registro estático entra no bundle com o context único do LiveServer.
    const roomsPath = path.join(componentsPath, 'rooms')
    const discoveredRooms = isProd
      ? (await import('@app/server/live/rooms')).liveRoomClasses as LiveRoomClass[]
      : await discoverRoomClasses(roomsPath)

    liveServer = new LiveServer({
      transport,
      // SÓ em dev: componentsPath dispara o auto-discover dinâmico (import() do
      // disco). Em PROD isso carrega os componentes de uma instância SEPARADA do
      // @fluxstack/live (source linkado), com _ctx null → "LiveServer.start() must
      // be called". Em prod usamos APENAS o registro estático (components), que
      // está no mesmo bundle onde start() setou o context.
      ...(isProd ? {} : { componentsPath }),
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
