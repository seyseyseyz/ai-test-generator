/**
 * CLI Command Options Type Definitions
 * @packageDocumentation
 */

import type { Priority } from './index.js'

// ============================================================================
// Common CLI Options
// ============================================================================

/**
 * Base options available to all commands
 */
export interface BaseCommandOptions {
  config?: string
  output?: string
  verbose?: boolean
}

// ============================================================================
// Init Command Options
// ============================================================================

/**
 * Options for 'init' command
 */
export interface InitOptions extends BaseCommandOptions {
  force?: boolean
  template?: 'default' | 'minimal' | 'advanced'
}

// ============================================================================
// Analyze Command Options
// ============================================================================

/**
 * Options for 'analyze' command
 */
export interface AnalyzeOptions extends BaseCommandOptions {
  samples?: number
  skipCache?: boolean
  interactive?: boolean
}

// ============================================================================
// Scan Command Options
// ============================================================================

/**
 * Options for 'scan' command
 */
export interface ScanCommandOptions extends BaseCommandOptions {
  skipGit?: boolean
  includeInternal?: boolean
  excludeDirs?: string[]
  minLoc?: number
}

// ============================================================================
// Generate Command Options
// ============================================================================

/**
 * Options for 'generate' command
 */
export interface GenerateOptions extends BaseCommandOptions {
  /** Number of functions to generate tests for */
  count?: number
  
  /** Priority filter (P0, P1, P2, P3) */
  priority?: Priority
  
  /** Generate all remaining TODO functions */
  all?: boolean
  
  /** Enable iterative improvement mode (default: true) */
  iterative?: boolean
  
  /** Maximum iterations for iterative mode */
  maxIterations?: number
  
  /** Number of samples per iteration (N-Sample Generation) */
  samples?: number
  
  /** Dry run mode: preview actions without executing */
  dryRun?: boolean
  
  /** Report file path */
  report?: string
  
  /** Temperature for AI generation (0.0 - 1.0) */
  temperature?: number
  
  /** Timeout for AI generation in seconds */
  timeout?: number
  
  /** Skip test execution after generation */
  skipTests?: boolean
}

// ============================================================================
// Parallel Command Options
// ============================================================================

/**
 * Options for 'parallel' command
 */
export interface ParallelOptions extends BaseCommandOptions {
  /** Number of functions to generate tests for */
  count?: number
  
  /** Priority filter (P0, P1, P2, P3) */
  priority?: Priority
  
  /** Concurrent batches (default: 3, max: 5) */
  concurrency?: number
  
  /** Report file path */
  report?: string
  
  /** Batch size (number of functions per batch) */
  batchSize?: number
  
  /** Timeout for each batch in seconds */
  batchTimeout?: number
}

// ============================================================================
// Batch Command Options (Internal)
// ============================================================================

/**
 * Options for internal 'batch' command
 */
export interface BatchOptions {
  priority?: Priority
  count: number
  skip: number
  report: string
  dryRun?: boolean
}

// ============================================================================
// Command Arguments
// ============================================================================

/**
 * Parsed command arguments
 */
export interface CommandArguments {
  command?: string
  subcommand?: string
  args: string[]
}

// ============================================================================
// CLI Context
// ============================================================================

/**
 * CLI execution context
 */
export interface CLIContext {
  cwd: string
  configPath?: string
  outputDir: string
  verbose: boolean
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Re-export all types for convenience
}

