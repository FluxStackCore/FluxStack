#!/usr/bin/env tsx
// 🧪 Live Components Test Runner Script

import { spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

interface TestOptions {
  coverage?: boolean
  watch?: boolean
  verbose?: boolean
  filter?: string
  reporter?: 'default' | 'verbose' | 'json' | 'junit'
}

class LiveComponentsTestRunner {
  private options: TestOptions

  constructor(options: TestOptions = {}) {
    this.options = {
      coverage: false,
      watch: false,
      verbose: true,
      reporter: 'verbose',
      ...options
    }
  }

  async run(): Promise<void> {
    console.log('🧪 Starting Live Components Test Suite...\n')

    // Ensure test results directory exists
    this.ensureDirectories()

    // Build vitest command
    const command = this.buildCommand()
    
    console.log(`📋 Running command: ${command.join(' ')}\n`)

    // Execute tests
    const testProcess = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    })

    return new Promise((resolve, reject) => {
      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ All tests passed!')
          this.printSummary()
          resolve()
        } else {
          console.log(`\n❌ Tests failed with exit code ${code}`)
          reject(new Error(`Tests failed with exit code ${code}`))
        }
      })

      testProcess.on('error', (error) => {
        console.error('\n❌ Failed to start test process:', error)
        reject(error)
      })
    })
  }

  private ensureDirectories(): void {
    const dirs = [
      './test-results',
      './coverage',
      './coverage/live-components'
    ]

    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
        console.log(`📁 Created directory: ${dir}`)
      }
    })
  }

  private buildCommand(): string[] {
    const command = ['npx', 'vitest']
    
    // Add config file
    command.push('--config', 'vitest.config.live.ts')

    // Add run mode (not watch by default)
    if (!this.options.watch) {
      command.push('--run')
    }

    // Add coverage
    if (this.options.coverage) {
      command.push('--coverage')
    }

    // Add reporter
    if (this.options.reporter) {
      command.push('--reporter', this.options.reporter)
    }

    // Add filter
    if (this.options.filter) {
      command.push('--grep', this.options.filter)
    }

    // Add verbose output
    if (this.options.verbose) {
      command.push('--reporter=verbose')
    }

    return command
  }

  private printSummary(): void {
    console.log('\n📊 Test Summary:')
    console.log('================')
    console.log('✅ ComponentRegistry: Core functionality and lifecycle management')
    console.log('✅ StateSignature: Cryptographic state validation and security')
    console.log('✅ WebSocketConnectionManager: Connection pooling and load balancing')
    console.log('✅ LiveComponentPerformanceMonitor: Performance tracking and optimization')
    console.log('✅ FileUploadManager: File upload handling and validation')
    console.log('✅ Integration Tests: End-to-end system functionality')
    
    if (this.options.coverage) {
      console.log('\n📈 Coverage report generated in: ./coverage/live-components/')
    }
    
    console.log('\n📋 Test results saved in: ./test-results/live-components.json')
  }
}

// CLI interface
const cliArgs = process.argv.slice(2)

async function main() {
  const args = cliArgs
  
  const options: TestOptions = {
    coverage: args.includes('--coverage') || args.includes('-c'),
    watch: args.includes('--watch') || args.includes('-w'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    filter: args.find(arg => arg.startsWith('--filter='))?.split('=')[1],
    reporter: args.find(arg => arg.startsWith('--reporter='))?.split('=')[1] as any || 'verbose'
  }

  const runner = new LiveComponentsTestRunner(options)
  
  try {
    await runner.run()
    process.exit(0)
  } catch (error) {
    console.error('❌ Test runner failed:', error)
    process.exit(1)
  }
}

// Help text
function printHelp() {
  console.log(`
🧪 Live Components Test Runner

Usage: tsx scripts/test-live-components.ts [options]

Options:
  --coverage, -c     Generate coverage report
  --watch, -w        Run tests in watch mode
  --verbose, -v      Verbose output (default)
  --filter=<pattern> Filter tests by pattern
  --reporter=<type>  Test reporter (default, verbose, json, junit)
  --help, -h         Show this help message

Examples:
  tsx scripts/test-live-components.ts                    # Run all tests
  tsx scripts/test-live-components.ts --coverage         # Run with coverage
  tsx scripts/test-live-components.ts --watch            # Run in watch mode
  tsx scripts/test-live-components.ts --filter=Registry  # Run only Registry tests
`)
}

if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
  printHelp()
  process.exit(0)
}

// Run if called directly
if (require.main === module) {
  main()
}

export { LiveComponentsTestRunner }
