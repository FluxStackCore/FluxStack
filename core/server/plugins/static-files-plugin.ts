// FluxStack Static Files Plugin - Serve Public Files & Uploads

import { existsSync, statSync, type Stats } from 'fs'
import { mkdir } from 'fs/promises'
import { resolve, extname } from 'path'
import type { Plugin, PluginContext } from '../../plugins/types'
import { pluginsConfig } from '@config'

/** MIME types that should force a download instead of rendering inline */
const DANGEROUS_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sharedlib',
  'application/x-mach-binary',
  'application/x-dosexec',
  'application/x-httpd-php',
  'application/java-archive',
  'application/x-sh',
  'application/x-csh',
  'application/x-bat',
])

/** File extensions that should always force a download */
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.msi',
  '.sh', '.csh', '.bash', '.ps1', '.vbs', '.wsf',
  '.php', '.jsp', '.asp', '.aspx', '.py', '.rb', '.pl',
  '.jar', '.war', '.class',
  '.scr', '.pif', '.hta',
  '.svg', // SVG can contain embedded scripts
])

/** Extensions that carry a content hash in their filename (immutable) */
const HASHED_EXT = /\.[0-9a-f]{8,}\.\w+$/

/** Generate an ETag from file stats (size + mtime) */
function generateETag(stat: Stats): string {
  return `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`
}

/** Check if a MIME type or extension should force download */
function shouldForceDownload(filePath: string, mimeType: string | undefined): boolean {
  const ext = extname(filePath).toLowerCase()
  if (DANGEROUS_EXTENSIONS.has(ext)) return true
  if (mimeType && DANGEROUS_MIME_TYPES.has(mimeType)) return true
  return false
}

export const staticFilesPlugin: Plugin = {
  name: 'static-files',
  description: 'Serve static files and uploads',
  author: 'FluxStack Team',
  priority: 'normal',
  category: 'core',
  tags: ['static', 'files', 'uploads'],

  setup: async (context: PluginContext) => {
    if (!pluginsConfig.staticFilesEnabled) {
      context.logger.debug('Static files plugin disabled')
      return
    }

    const projectRoot = process.cwd()
    const publicDir = resolve(projectRoot, pluginsConfig.staticPublicDir ?? 'public')
    const uploadsDir = resolve(projectRoot, pluginsConfig.staticUploadsDir ?? 'uploads')
    const cacheMaxAge = pluginsConfig.staticCacheMaxAge
    const enablePublic = pluginsConfig.staticEnablePublic
    const enableUploads = pluginsConfig.staticEnableUploads

    // Helper to serve files from a directory
    const serveFile = (baseDir: string, isUpload: boolean) => ({ params, set, request }: any) => {
      const requestedPath = params['*'] || ''
      const filePath = resolve(baseDir, requestedPath)

      // Path traversal protection
      if (!filePath.startsWith(baseDir)) {
        set.status = 400
        return { error: 'Invalid path' }
      }

      // Check if file exists
      if (!existsSync(filePath)) {
        set.status = 404
        return { error: 'File not found' }
      }

      // Check if it's a file (not directory)
      let stat: ReturnType<typeof statSync>
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

      // ETag-based conditional request handling
      const etag = generateETag(stat)
      const ifNoneMatch = request?.headers?.get?.('if-none-match')
      if (ifNoneMatch && ifNoneMatch === etag) {
        set.status = 304
        return ''
      }

      // Common security headers
      set.headers['x-content-type-options'] = 'nosniff'
      set.headers['etag'] = etag

      // Cache strategy: hashed assets are immutable, uploads get short cache
      if (!isUpload && HASHED_EXT.test(requestedPath)) {
        set.headers['cache-control'] = `public, max-age=${cacheMaxAge}, immutable`
      } else if (isUpload) {
        set.headers['cache-control'] = 'public, max-age=3600, must-revalidate'
      } else {
        set.headers['cache-control'] = `public, max-age=${cacheMaxAge}`
      }

      const file = Bun.file(filePath)

      // Force download for dangerous MIME types
      if (shouldForceDownload(filePath, file.type)) {
        const fileName = requestedPath.split('/').pop() || 'download'
        set.headers['content-disposition'] = `attachment; filename="${fileName}"`
      }

      return file
    }

    // Register routes based on config flags
    if (enablePublic) {
      await mkdir(publicDir, { recursive: true })
      context.app.get('/api/static/*', serveFile(publicDir, false))
      context.logger.debug('Static public files route registered: /api/static/*')
    }

    if (enableUploads) {
      await mkdir(uploadsDir, { recursive: true })
      await mkdir(resolve(uploadsDir, 'avatars'), { recursive: true })
      context.app.get('/api/uploads/*', serveFile(uploadsDir, true))
      context.logger.debug('Static uploads route registered: /api/uploads/*')
    }

    const routes = [
      ...(enablePublic ? ['/api/static/*'] : []),
      ...(enableUploads ? ['/api/uploads/*'] : [])
    ]

    if (routes.length > 0) {
      context.logger.debug('Static files plugin ready', { routes })
    }
  }
}
