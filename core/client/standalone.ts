/**
 * Standalone Frontend Development
 * Starts Vite dev server directly without Elysia backend
 */

import { clientConfig } from '@config'
import type { LogLevel } from 'vite'
import { buildLogger } from "../utils/build-logger"

type ViteDevServer = Awaited<ReturnType<typeof import('vite')['createServer']>>

let viteServer: ViteDevServer | null = null

export const startFrontendOnly = async (config: Record<string, unknown> = {}) => {
  const port = (config.vitePort ?? clientConfig.vite.port ?? 5173) as number
  const host = (config.viteHost ?? clientConfig.vite.host ?? 'localhost') as string
  const logLevel = (config.logLevel || clientConfig.vite.logLevel || 'info') as LogLevel

  buildLogger.info(`⚛️  FluxStack Frontend Only`)
  buildLogger.info(`🌐 http://${host}:${port}`)
  buildLogger.info('')

  try {
    // Dynamic import of vite
    const { createServer } = await import('vite')

    // Start Vite dev server programmatically
    viteServer = await createServer({
      configFile: './vite.config.ts',
      server: {
        port,
        host,
        strictPort: clientConfig.vite.strictPort as boolean | undefined
      },
      logLevel
    })

    await viteServer.listen()

    buildLogger.success(`✅ Frontend server ready!`)
    buildLogger.info('')

    // Setup cleanup on process exit
    const cleanup = async () => {
      if (viteServer) {
        buildLogger.info('\n🛑 Stopping frontend...')
        await viteServer.close()
        viteServer = null
        process.exit(0)
      }
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('exit', cleanup)

    return viteServer

  } catch (error) {
    // Check if error is related to port already in use
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isPortInUse = errorMessage.includes('EADDRINUSE') ||
      errorMessage.includes('address already in use') ||
      (errorMessage.includes('Port') && errorMessage.includes('is in use'))

    if (isPortInUse) {
      buildLogger.error(`❌ Failed to start Vite: Port ${port} is already in use`)
      buildLogger.info(`💡 Try one of these solutions:`)
      buildLogger.info(`   1. Stop the process using port ${port}`)
      buildLogger.info(`   2. Change VITE_PORT in your .env file`)
      buildLogger.info(`   3. Kill the process: ${process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -ti:${port} | xargs kill -9`}`)
      process.exit(1)
    } else {
      buildLogger.error('❌ Failed to start Vite server:', errorMessage)
      buildLogger.error('Full error:', error)
      process.exit(1)
    }
  }
}
