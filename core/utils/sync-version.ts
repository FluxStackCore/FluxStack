#!/usr/bin/env bun

/**
 * Version Synchronization Utility
 * Ensures version consistency between package.json and version.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { buildLogger } from "./build-logger"

interface PackageJson {
  version: string
  [key: string]: unknown
}

/**
 * Read version from package.json
 */
function getPackageVersion(): string {
  const packagePath = join(process.cwd(), 'package.json')
  const packageContent = readFileSync(packagePath, 'utf-8')
  const packageJson: PackageJson = JSON.parse(packageContent)
  return packageJson.version
}

/**
 * Update version.ts with the version from package.json
 */
function updateVersionFile(version: string, silent = false): void {
  const versionPath = join(process.cwd(), 'core/utils/version.ts')
  const versionContent = `/**
 * FluxStack Framework Version
 * Single source of truth for version number
 * Auto-synced with package.json
 */
export const FLUXSTACK_VERSION = '${version}'
`
  writeFileSync(versionPath, versionContent)
  if (!silent) {
    buildLogger.success(`✅ Updated version.ts to v${version}`)
  }
}

/**
 * Main sync function
 */
function syncVersion(silent = false): void {
  try {
    const packageVersion = getPackageVersion()
    updateVersionFile(packageVersion, silent)
    if (!silent) {
      buildLogger.info(`🔄 Version synchronized: v${packageVersion}`)
    }
  } catch (error) {
    if (!silent) {
      buildLogger.error('❌ Failed to sync version:', error)
    }
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.main) {
  syncVersion()
}

export { syncVersion, getPackageVersion }