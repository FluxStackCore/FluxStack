import { join } from "path"
import { statSync, existsSync } from "fs"

export interface StaticPathOptions {
  publicDir?: string
  indexFile?: string
  fallbackToIndex?: boolean
}

/**
 * Resolves the physical path for a static file request
 */
export function resolveStaticPath(pathname: string, options: StaticPathOptions = {}) {
  const {
    publicDir = 'dist/client',
    indexFile = 'index.html',
    fallbackToIndex = true
  } = options

  // Determine base directory
  let baseDir = publicDir
  if (existsSync('client')) {
    baseDir = 'client'
  } else if (existsSync('dist/client')) {
    baseDir = 'dist/client'
  }

  // Normalize pathname
  let targetPath = pathname
  if (targetPath === '/' || targetPath === '') {
    targetPath = `/${indexFile}`
  }

  const filePath = join(baseDir, targetPath)

  try {
    const info = statSync(filePath)
    if (info.isFile()) {
      return { filePath, isFile: true }
    }
  } catch (_) {}

  if (fallbackToIndex) {
    const indexPath = join(baseDir, indexFile)
    try {
      if (statSync(indexPath).isFile()) {
        return { filePath: indexPath, isFile: true, isFallback: true }
      }
    } catch (_) {}
  }

  return { filePath: null, isFile: false }
}
