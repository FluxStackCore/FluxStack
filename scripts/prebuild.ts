#!/usr/bin/env bun

/**
 * Pre-build script
 * Ensures version synchronization before building
 */

import { syncVersion } from '@core/utils/sync-version'

console.log('🔄 Running pre-build checks...')

// Sync version from package.json to version.ts
syncVersion()

console.log('✅ Pre-build checks completed')