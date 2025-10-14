/**
 * IO and Database Mock Detection
 * @module mock/detectors-io
 */

import type { ImportAnalysis } from './types.js'

// ============================================================================
// File System Detection
// ============================================================================

/**
 * Check if function call is filesystem related
 */
export function isFileSystemCall(callee: string): boolean {
  return callee.includes('fs.') || callee.includes('readFile') || callee.includes('writeFile') || 
         callee.includes('existsSync') || callee.includes('mkdir')
}

/**
 * Format filesystem call for detection (simplified)
 */
export function formatFileSystemCall(callee: string): string {
  return callee
}

// ============================================================================
// Database Detection
// ============================================================================

/**
 * Check if function call is database related
 */
export function isDatabaseCall(callee: string): boolean {
  const dbKeywords = ['find', 'create', 'update', 'delete', 'save', 'insert', 'query', 
                      'execute', 'transaction', 'connect', 'collection', 'model']
  return dbKeywords.some(kw => callee.toLowerCase().includes(kw))
}

/**
 * Format database call for detection (simplified)
 */
export function formatDatabaseCall(callee: string, imports: ImportAnalysis): string {
  if (imports.mongoose) return `mongoose.${callee}`
  if (imports.typeorm) return `typeorm.${callee}`
  if (imports.sequelize) return `sequelize.${callee}`
  return callee
}

// ============================================================================
// Redis Detection
// ============================================================================

/**
 * Check if function call is Redis related
 */
export function isRedisCall(callee: string): boolean {
  return callee.includes('redis') || callee.includes('get') || callee.includes('set') ||
         callee.includes('del') || callee.includes('expire')
}

/**
 * Format Redis call for detection (simplified)
 */
export function formatRedisCall(callee: string): string {
  return `redis.${callee}`
}

