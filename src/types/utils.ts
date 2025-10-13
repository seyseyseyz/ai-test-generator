/**
 * Utility Functions Type Definitions
 * @packageDocumentation
 */

import type { AITestConfig } from './index.js'

// ============================================================================
// Config Manager Types
// ============================================================================

/**
 * Config detection result
 */
export interface ConfigDetectionResult {
  path: string | null
  exists: boolean
  format?: 'jsonc' | 'json'
}

/**
 * Config validation error
 */
export interface ConfigValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * Config file operations
 */
export interface ConfigManager {
  detectConfig(providedPath?: string): string | null
  ensureConfig(configPath?: string): string
  readConfig(configPath: string): AITestConfig
  writeConfig(configPath: string, config: AITestConfig): void
  isAnalyzed(config: AITestConfig): boolean
  validateConfig(config: AITestConfig): string[]
}

// ============================================================================
// Marker Types (Test Status Management)
// ============================================================================

/**
 * Test status marker
 */
export type TestStatusMarker = 'TODO' | 'DONE' | 'SKIP' | 'FAIL'

/**
 * Marker update operation
 */
export interface MarkerUpdate {
  functionName: string
  filePath: string
  oldStatus: TestStatusMarker
  newStatus: TestStatusMarker
  timestamp: number
}

/**
 * Marker operations result
 */
export interface MarkerOperationResult {
  success: boolean
  updated: number
  errors?: string[]
}

// ============================================================================
// Action Logger Types
// ============================================================================

/**
 * Action log entry
 */
export interface ActionLogEntry {
  timestamp: number
  action: 'generate' | 'skip' | 'fail' | 'retry' | 'complete'
  functionName: string
  filePath?: string
  reason?: string
  metadata?: Record<string, unknown>
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  logDir: string
  logFile: string
  maxSize?: number
  verbose?: boolean
}

/**
 * Action logger interface
 */
export interface ActionLogger {
  log(entry: Omit<ActionLogEntry, 'timestamp'>): void
  flush(): Promise<void>
  getHistory(functionName?: string): ActionLogEntry[]
}

// ============================================================================
// Backup Manager Types
// ============================================================================

/**
 * Backup metadata
 */
export interface BackupMetadata {
  originalPath: string
  backupPath: string
  timestamp: number
  size: number
  hash?: string
}

/**
 * Backup options
 */
export interface BackupOptions {
  backupDir?: string
  keepHistory?: number
  includeTimestamp?: boolean
}

/**
 * Backup manager interface
 */
export interface BackupManager {
  createBackup(filePath: string, options?: BackupOptions): Promise<BackupMetadata>
  restoreBackup(backupPath: string): Promise<void>
  listBackups(originalPath: string): BackupMetadata[]
  cleanup(maxAge?: number): Promise<number>
}

// ============================================================================
// File Guard Types
// ============================================================================

/**
 * File guard result
 */
export interface FileGuardResult {
  allowed: boolean
  reason?: string
  category?: 'protected' | 'node_modules' | 'generated' | 'test'
}

/**
 * File guard rules
 */
export interface FileGuardRules {
  protectedPaths: string[]
  excludePatterns: RegExp[]
  allowOverwrite?: boolean
}

/**
 * File guard interface
 */
export interface FileGuard {
  canWrite(filePath: string): FileGuardResult
  canRead(filePath: string): FileGuardResult
  canDelete(filePath: string): FileGuardResult
}

// ============================================================================
// Scan Manager Types
// ============================================================================

/**
 * Scan manager options
 */
export interface ScanManagerOptions {
  rootDir?: string
  excludeDirs?: string[]
  includeInternal?: boolean
  minLoc?: number
  excludePatterns?: string[]
}

/**
 * Scan result
 */
export interface ScanResult {
  targets: Array<{
    name: string
    path: string
    type: string
    layer: string
    internal: boolean
    loc: number
  }>
  summary: {
    totalFiles: number
    totalFunctions: number
    exportedFunctions: number
    internalFunctions: number
  }
}

/**
 * Scan manager interface
 */
export interface ScanManager {
  scan(options: ScanManagerOptions): Promise<ScanResult>
  rescan(): Promise<ScanResult>
  getCached(): ScanResult | null
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Re-export all types for convenience
}

