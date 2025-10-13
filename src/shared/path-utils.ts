/**
 * Path Utilities - 统一的路径处理函数
 * 
 * 提供路径规范化、相对化等功能
 * @packageDocumentation
 */

import { basename, dirname, extname, join, relative, resolve } from 'node:path'

/**
 * Normalize path separators to forward slashes
 * 
 * @param path - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * Convert absolute path to relative path from cwd
 * 
 * @param absolutePath - Absolute path
 * @param basePath - Base path (default: process.cwd())
 * @returns Relative path
 * 
 * @example
 * ```typescript
 * relativizePath('/Users/me/project/src/index.ts')
 * // → 'src/index.ts'
 * ```
 */
export function relativizePath(absolutePath: string, basePath?: string): string {
  const base = basePath || process.cwd()
  const normalized = normalizePath(absolutePath)
  const normalizedBase = normalizePath(base)
  
  if (normalized.startsWith(normalizedBase)) {
    return normalized.slice(normalizedBase.length + 1)
  }
  
  return relative(base, absolutePath)
}

/**
 * Extract top-level directory from src/ path
 * 
 * @param filePath - File path
 * @returns Top-level directory name
 * 
 * @example
 * ```typescript
 * getTopCategory('src/components/Button.tsx')
 * // → 'components'
 * ```
 */
export function getTopCategory(filePath: string): string {
  const normalized = normalizePath(filePath)
  const parts = normalized.split('/')
  const srcIndex = parts.indexOf('src')
  
  if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
    return parts[srcIndex + 1] || ''
  }
  
  return parts[0] || ''
}

/**
 * Check if path matches glob pattern (simple implementation)
 * 
 * Supports:
 * - `*` - matches any characters except /
 * - `**` - matches any characters including /
 * 
 * @param filePath - File path to test
 * @param pattern - Glob pattern
 * @returns True if path matches pattern
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
  
  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(normalizePath(filePath))
}

// Workaround for TypeScript strict mode
declare const _unused: typeof join | typeof resolve | typeof relative | typeof dirname | typeof basename | typeof extname

/**
 * Re-export Node.js path utilities
 */
export { join, resolve, relative, dirname, basename, extname }

