/**
 * FluxStack CLI - Dev Command
 * Start full-stack development server with hot reload
 */

import type { CLICommand } from '../command-registry'
import { serverConfig, clientConfig } from '@/config'
import { startGroup, endGroup, logInGroup } from '@/core/utils/logger/group-logger'

export const devCommand: CLICommand = {
  name: 'dev',
  description: 'Start full-stack development server',
  category: 'Development',
  usage: 'flux dev [options]',
  examples: [
    'flux dev                    # Start development server',
    'flux dev --port 4000        # Start on custom port'
  ],
  options: [
    {
      name: 'port',
      short: 'p',
      description: 'Port for backend server',
      type: 'number',
      default: serverConfig.server.port
    },
    {
      name: 'frontend-port',
      description: 'Port for frontend server',
      type: 'number',
      default: clientConfig.vite.port
    }
  ],
  handler: async (args, options, context) => {
    const { spawn } = await import("child_process")
    const devProcess = spawn("bun", ["--watch", "app/server/index.ts"], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: {
        ...process.env,
        FRONTEND_PORT: options['frontend-port'].toString(),
        BACKEND_PORT: options.port.toString()
      }
    })

    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down gracefully...')
      devProcess.kill('SIGTERM')
      setTimeout(() => {
        devProcess.kill('SIGKILL')
        process.exit(0)
      }, 5000)
    })

    devProcess.on('close', (code) => {
      process.exit(code || 0)
    })

    // Keep the CLI running until the child process exits
    return new Promise((resolve) => {
      devProcess.on('exit', resolve)
    })
  }
}
