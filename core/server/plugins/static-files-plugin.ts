// FluxStack Static Files Plugin - Serve Public Files & Uploads

import { existsSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import { resolve } from 'path'
import { pluginsConfig } from '@config'
import type { Plugin, PluginContext } from '../../plugins/types'

/** MIME types that should never be executed inline (security) */
const FORCE_DOWNLOAD_TYPES = new Set([
  'application/x-executable',
  'application/x-sharedlib',
  'application/x-msdos-program',
])

/** Extensions that carry a content hash in their filename (immutable) */
const HASHED_EXT = /\.[0-9a-f]{8,}\.\w+$/

export const staticFilesPlugin: Plugin = {
  name: 'static-files',
  description: 'Serve static files and uploads',
  author: 'FluxStack Team',
  priority: 'normal',
  category: 'core',
  tags: ['static', 'files', 'uploads'],

  setup: async (context: PluginContext) => {
    const projectRoot = process.cwd()
    const publicDirName = pluginsConfig.staticPublicDir || 'public'
    const uploadsDirName = pluginsConfig.staticUploadsDir || 'uploads'
    const cacheMaxAge = pluginsConfig.staticCacheMaxAge ?? 31536000
    const enablePublic = pluginsConfig.staticEnablePublic !== false
    const enableUploads = pluginsConfig.staticEnableUploads !== false

    const publicDir = resolve(projectRoot, publicDirName)
    const uploadsDir = resolve(projectRoot, uploadsDirName)

    // Create directories if they don't exist
    if (enablePublic) await mkdir(publicDir, { recursive: true })
    if (enableUploads) {
      await mkdir(uploadsDir, { recursive: true })
      await mkdir(resolve(uploadsDir, 'avatars'), { recursive: true })
    }

    // Helper to serve files from a directory
    const serveFile = (baseDir: string, isUpload: boolean) => ({ params, set }: any) => {
      const requestedPath = params['*'] || ''
      const filePath = resolve(baseDir, requestedPath)

      // Path traversal protection
      if (!filePath.startsWith(baseDir)) {
        set.status = 400
        return { error: 'Invalid path' }
      }

      // Check if file exists and is a file (not directory)
      let stat
      try {
        stat = statSync(filePath)
        if (!stat.isFile()) {
          set.status = 404
          return { error: 'Not a file' }
        }
      } catch {
        set.status = 404
        return { error: 'File not found' }
      }

      // Security headers for all served files
      set.headers['x-content-type-options'] = 'nosniff'

      // Cache strategy: hashed filenames get immutable cache, uploads get short cache
      if (HASHED_EXT.test(requestedPath)) {
        set.headers['cache-control'] = `public, max-age=${cacheMaxAge}, immutable`
      } else if (isUpload) {
        // Uploads change frequently — short cache with revalidation
        set.headers['cache-control'] = 'public, max-age=3600, must-revalidate'
      } else {
        set.headers['cache-control'] = `public, max-age=${cacheMaxAge}`
      }

      // ETag based on mtime + size for conditional requests
      const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`
      set.headers['etag'] = etag

      // Bun.file() handles: content-type, content-length, streaming
      const file = Bun.file(filePath)

      // Force download for dangerous MIME types on uploads
      if (isUpload && FORCE_DOWNLOAD_TYPES.has(file.type)) {
        set.headers['content-disposition'] = 'attachment'
      }

      return file
    }

    // Register routes based on config
    const routes: string[] = []

    if (enablePublic) {
      context.app.get('/api/static/*', serveFile(publicDir, false))
      routes.push('/api/static/*')
    }

    if (enableUploads) {
      context.app.get('/api/uploads/*', serveFile(uploadsDir, true))
      routes.push('/api/uploads/*')
    }

    context.logger.debug('📁 Static files plugin ready', { routes })
  }
}
