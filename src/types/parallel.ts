/**
 * Parallel Test Generation Types
 * @packageDocumentation
 */

import type { GenerationResult, IterationTelemetry, ScoredFunction } from './index.js'
import type { QualityEvaluation } from './quality.js'

// ============================================================================
// Batch Types
// ============================================================================

/**
 * Batch group of functions to generate tests for
 */
export interface BatchGroup {
  /** Unique batch identifier */
  batchId: string
  
  /** File path this batch belongs to */
  file: string
  
  /** Functions in this batch */
  functions: ScoredFunction[]
  
  /** Batch size */
  size: number
  
  /** Batch priority (avg of function priorities) */
  priority: number
}

/**
 * Batch execution result
 */
export interface BatchResult {
  /** Batch identifier */
  batchId: string
  
  /** Success status */
  success: boolean
  
  /** Number of tests generated */
  generated: number
  
  /** Number of functions that failed */
  failed: number
  
  /** Execution duration in milliseconds */
  duration: number
  
  /** Individual generation results */
  results: GenerationResult[]
  
  /** Error messages (if any) */
  errors?: string[]
  
  /** Quality metrics (if collected) */
  quality?: QualityEvaluation
}

/**
 * Batch status
 */
export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * Batch with status tracking
 */
export interface BatchWithStatus extends BatchGroup {
  status: BatchStatus
  startTime?: number
  endTime?: number
  result?: BatchResult
}

// ============================================================================
// Parallel Generation Options
// ============================================================================

/**
 * Parallel generation configuration
 */
export interface ParallelGenerationConfig {
  /** Maximum concurrent batches (default: 3, max: 5) */
  concurrency: number
  
  /** Target batch size (default: auto-calculated) */
  batchSize?: number
  
  /** Timeout per batch in seconds */
  batchTimeout?: number
  
  /** Enable retry on batch failure */
  enableRetry?: boolean
  
  /** Maximum retries per batch */
  maxRetries?: number
  
  /** Collect quality metrics */
  collectQuality?: boolean
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Progress update
 */
export interface ProgressUpdate {
  /** Total batches */
  totalBatches: number
  
  /** Completed batches */
  completedBatches: number
  
  /** Running batches */
  runningBatches: number
  
  /** Failed batches */
  failedBatches: number
  
  /** Total functions processed */
  totalFunctions: number
  
  /** Successfully generated */
  successfulFunctions: number
  
  /** Failed functions */
  failedFunctions: number
  
  /** Elapsed time in milliseconds */
  elapsedTimeMs: number
  
  /** Estimated remaining time in milliseconds */
  estimatedRemainingMs?: number
}

/**
 * Progress callback
 */
export type ProgressCallback = (update: ProgressUpdate) => void

// ============================================================================
// Parallel Generation Result
// ============================================================================

/**
 * Parallel generation summary
 */
export interface ParallelGenerationSummary {
  /** Total number of batches */
  totalBatches: number
  
  /** Successful batches */
  successfulBatches: number
  
  /** Failed batches */
  failedBatches: number
  
  /** Total functions processed */
  totalFunctions: number
  
  /** Successfully generated tests */
  successfulTests: number
  
  /** Failed test generations */
  failedTests: number
  
  /** Total duration in milliseconds */
  totalDurationMs: number
  
  /** Average batch duration */
  avgBatchDurationMs: number
  
  /** Throughput (functions per minute) */
  throughput: number
  
  /** All batch results */
  batchResults: BatchResult[]
  
  /** Telemetry data (if collected) */
  telemetry?: IterationTelemetry[]
}

// ============================================================================
// Batch Strategy
// ============================================================================

/**
 * Batch grouping strategy
 */
export type BatchStrategy = 'by-file' | 'by-priority' | 'by-size' | 'round-robin'

/**
 * Batch optimizer configuration
 */
export interface BatchOptimizerConfig {
  /** Grouping strategy */
  strategy: BatchStrategy
  
  /** Minimum functions per batch */
  minBatchSize: number
  
  /** Maximum functions per batch */
  maxBatchSize: number
  
  /** Balance batches by execution time estimate */
  balanceByTime?: boolean
}

/**
 * Batch optimizer interface
 */
export interface BatchOptimizer {
  /**
   * Create optimized batches from scored functions
   */
  createBatches(
    functions: ScoredFunction[],
    config: BatchOptimizerConfig
  ): BatchGroup[]
  
  /**
   * Rebalance batches based on actual execution times
   */
  rebalance(
    batches: BatchWithStatus[],
    executionTimes: Map<string, number>
  ): BatchGroup[]
}

// ============================================================================
// Concurrency Control
// ============================================================================

/**
 * Limiter function type (from p-limit)
 */
export type LimitFunction = <T>(fn: () => Promise<T>) => Promise<T>

/**
 * Batch executor interface
 */
export interface BatchExecutor {
  /**
   * Execute a single batch
   */
  executeBatch(batch: BatchGroup): Promise<BatchResult>
  
  /**
   * Execute multiple batches with concurrency control
   */
  executeParallel(
    batches: BatchGroup[],
    config: ParallelGenerationConfig,
    onProgress?: ProgressCallback
  ): Promise<ParallelGenerationSummary>
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Re-export all types for convenience
}

