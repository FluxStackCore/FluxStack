/**
 * FluxStack CLI - Dev Command
 * Start full-stack development server with hot reload
 */

import type { CLICommand } from '../command-registry'
import { serverConfig, clientConfig } from '@config'

export const devCommand: CLICommand = {
  name: 'dev',
  description: 'Start full-stack development server',
  category: 'Development',
  usage: 'flux dev [options]',
  examples: [
    'flux dev                    # Start full-stack development',
    'flux dev --port 4000        # Start on custom port',
    'flux dev --frontend-only    # Start only frontend (Vite)',
    'flux dev --backend-only     # Start only backend (Elysia)'
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
    },
    {
      name: 'frontend-only',
      short: 'f',
      description: 'Start only the frontend (Vite dev server)',
      type: 'boolean',
      default: false
    },
    {
      name: 'backend-only',
      short: 'b',
      description: 'Start only the backend (Elysia server)',
      type: 'boolean',
      default: false
    }
  ],
  handler: async (args, options, context) => {
    const { spawn } = await import("child_process")

    const frontendOnly = options['frontend-only'] === true
    const backendOnly = options['backend-only'] === true

    // Determine which entry point to use
    let entryPoint: string
    let mode: string

    if (frontendOnly && backendOnly) {
      console.error('❌ Cannot use --frontend-only and --backend-only together')
      process.exit(1)
    }

    if (frontendOnly) {
      entryPoint = 'app/client/frontend-only.ts'
      mode = 'Frontend only'
    } else if (backendOnly) {
      entryPoint = 'app/server/backend-only.ts'
      mode = 'Backend only'
    } else {
      entryPoint = 'app/server/index.ts'
      mode = 'Full-stack'
    }

    console.log(`⚡ Starting ${mode} development server...`)

    const devProcess = spawn("bun", ["--watch", entryPoint], {
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
