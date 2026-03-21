import { spawn } from "bun"
import { existsSync, mkdirSync } from "fs"
import { join } from "path"
import type { FluxStackConfig } from "../config"
import type { BundleResult, BundleOptions } from "../types/build"
import { buildLogger } from "../utils/build-logger"
import { generateLiveComponentsFile } from "@fluxstack/live/build"

export interface BundlerConfig {
  target: 'bun' | 'node' | 'docker'
  outDir: string
  sourceMaps: boolean
  minify?: boolean
  external?: string[]
}

export class Bundler {
  private config: BundlerConfig

  constructor(config: BundlerConfig) {
    this.config = config
  }

  async bundleClient(options: BundleOptions = {}): Promise<BundleResult> {
    buildLogger.section('Client Build', '⚡')
    buildLogger.step('Starting Vite build...')

    const startTime = Date.now()
    
    try {
      const buildProcess = spawn({
        cmd: ["bunx", "vite", "build", "--config", "vite.config.ts"],
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          NODE_ENV: 'production',  // Force production environment for builds
          VITE_BUILD_OUTDIR: this.config.outDir,
          VITE_BUILD_MINIFY: (this.config.minify || false).toString(),
          VITE_BUILD_SOURCEMAPS: this.config.sourceMaps.toString(),
          ...options.env
        }
      })

      const exitCode = await buildProcess.exited
      const duration = Date.now() - startTime

      if (exitCode === 0) {
        buildLogger.success(`Client bundle completed in ${buildLogger.formatDuration(duration)}`)
        return {
          success: true,
          duration,
          outputPath: this.config.outDir,
          assets: await this.getClientAssets()
        }
      } else {
        const stdout = await new Response(buildProcess.stdout).text()
        const stderr = await new Response(buildProcess.stderr).text()
        buildLogger.error("Client bundle failed")
        if (stdout.trim()) buildLogger.error(`stdout:\n${stdout.trim()}`)
        if (stderr.trim()) buildLogger.error(`stderr:\n${stderr.trim()}`)
        return {
          success: false,
          duration,
          error: stderr || stdout || "Client build failed"
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  async bundleServer(entryPoint: string, options: BundleOptions = {}): Promise<BundleResult> {
    buildLogger.section('Server Build', '⚡')

    const startTime = Date.now()

    try {
      // Run pre-build steps (component discovery + plugins generation)
      await this.runPreBuildSteps()

      // Ensure output directory exists
      this.ensureOutputDirectory()

      // Get external dependencies
      const external = this.getExternalDependencies(options)

      const buildArgs = [
        "bun", "build",
        entryPoint,
        "--outdir", this.config.outDir,
        "--target", this.config.target,
        ...external.flatMap(ext => ["--external", ext])
      ]

      if (this.config.sourceMaps) {
        buildArgs.push("--sourcemap")
      }

      // Bun bundling only - no minification for better compatibility

      const buildProcess = spawn({
        cmd: buildArgs,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          NODE_ENV: 'production',  // Force production environment for builds
          ...options.env
        }
      })

      const exitCode = await buildProcess.exited
      const duration = Date.now() - startTime

      if (exitCode === 0) {
        buildLogger.success(`Server bundle completed in ${buildLogger.formatDuration(duration)}`)

        // Run post-build cleanup
        await this.runPostBuildCleanup()

        return {
          success: true,
          duration,
          outputPath: this.config.outDir,
          entryPoint: join(this.config.outDir, "index.js")
        }
      } else {
        const stdout = await new Response(buildProcess.stdout).text()
        const stderr = await new Response(buildProcess.stderr).text()

        buildLogger.error("Server bundle failed")
        if (stdout.trim()) buildLogger.error(`stdout:\n${stdout.trim()}`)
        if (stderr.trim()) buildLogger.error(`stderr:\n${stderr.trim()}`)

        // Run post-build cleanup
        await this.runPostBuildCleanup()

        return {
          success: false,
          duration,
          error: stderr || stdout || "Server build failed"
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // 🧹 CLEANUP: Restore original files on error
      try {
        await this.runPostBuildCleanup()
      } catch (cleanupError) {
        buildLogger.warn(`Failed to cleanup generated files: ${cleanupError}`)
      }

      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  async compileToExecutable(entryPoint: string, outputName: string = "app", options: BundleOptions = {}): Promise<BundleResult> {
    buildLogger.section('Executable Build', '📦')

    const startTime = Date.now()

    try {
      // Run pre-build steps (component discovery + plugins generation)
      await this.runPreBuildSteps()

      // Ensure output directory exists
      this.ensureOutputDirectory()

      const outputPath = join(this.config.outDir, outputName)

      // Get external dependencies
      const external = this.getExternalDependencies(options)

      // Use target from options or fall back to config
      const target = options.target || this.config.target

      const buildArgs = [
        "bun", "build",
        entryPoint,
        "--compile",
        "--outfile", outputPath,
        "--target", target,
        ...external.flatMap(ext => ["--external", ext])
      ]

      if (this.config.sourceMaps) {
        buildArgs.push("--sourcemap")
      }

      if (this.config.minify) {
        buildArgs.push("--minify")
      }

      // Add Windows-specific options if provided
      if (options.executable?.windows) {
        const winOpts = options.executable.windows
        if (winOpts.hideConsole) {
          buildArgs.push("--windows-hide-console")
        }
        if (winOpts.icon) {
          buildArgs.push("--windows-icon", winOpts.icon)
        }
        if (winOpts.title) {
          buildArgs.push("--windows-title", winOpts.title)
        }
        if (winOpts.publisher) {
          buildArgs.push("--windows-publisher", winOpts.publisher)
        }
        if (winOpts.version) {
          buildArgs.push("--windows-version", winOpts.version)
        }
        if (winOpts.description) {
          buildArgs.push("--windows-description", winOpts.description)
        }
        if (winOpts.copyright) {
          buildArgs.push("--windows-copyright", winOpts.copyright)
        }
      }

      // Add custom build arguments if provided
      if (options.executable?.customArgs) {
        buildArgs.push(...options.executable.customArgs)
      }

      buildLogger.step(`Compiling ${entryPoint} to ${outputPath}...`)

      const buildProcess = spawn({
        cmd: buildArgs,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          NODE_ENV: 'production',
          ...options.env
        }
      })

      const exitCode = await buildProcess.exited
      const duration = Date.now() - startTime

      if (exitCode === 0) {
        buildLogger.success(`Executable compiled in ${buildLogger.formatDuration(duration)}`)

        // Run post-build cleanup
        await this.runPostBuildCleanup()

        return {
          success: true,
          duration,
          outputPath,
          entryPoint: outputPath
        }
      } else {
        buildLogger.error("Executable compilation failed")

        // Run post-build cleanup
        await this.runPostBuildCleanup()

        const stderr = await new Response(buildProcess.stderr).text()
        return {
          success: false,
          duration,
          error: stderr || "Executable compilation failed"
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // 🧹 CLEANUP: Restore original files on error
      try {
        await this.runPostBuildCleanup()
      } catch (cleanupError) {
        buildLogger.warn(`Failed to cleanup generated files: ${cleanupError}`)
      }

      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * Get list of external dependencies that should not be bundled
   */
  private getExternalDependencies(options: BundleOptions = {}): string[] {
    return [
      "@tailwindcss/vite",
      "tailwindcss",
      "lightningcss",
      "vite",
      "@vitejs/plugin-react",
      "rollup",
      ...(this.config.external || []),
      ...(options.external || [])
    ]
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outDir)) {
      mkdirSync(this.config.outDir, { recursive: true })
    }
  }

  /**
   * Run pre-build steps (component discovery + plugins generation)
   */
  private async runPreBuildSteps(): Promise<void> {
    // 🚀 PRE-BUILD: Auto-generate Live Components registration
    this.discoverLiveComponents()

    // 🔌 PRE-BUILD: Auto-generate FluxStack Plugins registration
    const pluginsGeneratorModule = await import('./flux-plugins-generator')
    const fluxPluginsGenerator = pluginsGeneratorModule.fluxPluginsGenerator
    await fluxPluginsGenerator.preBuild()
  }

  /**
   * Scan and generate the Live Components registration file.
   */
  private discoverLiveComponents(): void {
    const count = generateLiveComponentsFile({
      componentsDir: join(process.cwd(), 'app', 'server', 'live'),
      outFile: join(process.cwd(), 'core', 'server', 'live', 'auto-generated-components.ts'),
      importPrefix: '@app/server/live',
    })
    if (count >= 0) {
      buildLogger.success(`Discovered ${count} Live Components`)
    } else {
      buildLogger.warn('No app/server/live/ directory found, skipping component discovery')
    }
  }

  /**
   * Run post-build cleanup
   */
  private async runPostBuildCleanup(): Promise<void> {
    const pluginsGeneratorModule = await import('./flux-plugins-generator')
    const fluxPluginsGenerator = pluginsGeneratorModule.fluxPluginsGenerator
    await fluxPluginsGenerator.postBuild(false)
  }

  private async getClientAssets(): Promise<string[]> {
    // This would analyze the build output to get asset information
    // For now, return empty array - can be enhanced later
    return []
  }

  async bundle(clientEntry?: string, serverEntry?: string, options: BundleOptions = {}): Promise<{
    client: BundleResult
    server: BundleResult
  }> {
    const [clientResult, serverResult] = await Promise.all([
      clientEntry ? this.bundleClient(options) : Promise.resolve({ success: true, duration: 0 } as BundleResult),
      serverEntry ? this.bundleServer(serverEntry, options) : Promise.resolve({ success: true, duration: 0 } as BundleResult)
    ])

    return {
      client: clientResult,
      server: serverResult
    }
  }
}