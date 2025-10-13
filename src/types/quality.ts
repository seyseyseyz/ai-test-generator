/**
 * Quality Assessment and Iterative Improvement Types
 * @packageDocumentation
 */

// ============================================================================
// Quality Standards (Meta TestGen-LLM)
// ============================================================================

/**
 * Quality standards for test generation
 * Reference: Meta TestGen-LLM (https://arxiv.org/pdf/2402.09171)
 */
export interface QualityStandards {
  /** Minimum build success rate (75% from Meta paper) */
  minBuildSuccess: number
  
  /** Minimum test pass rate (57% from Meta paper) */
  minTestPass: number
  
  /** Minimum coverage increase (25% from Meta paper) */
  minCoverageIncrease: number
  
  /** Maximum iterations allowed */
  maxIterations: number
  
  /** Temperature for AI generation (0.4 optimal from Meta paper) */
  temperature: number
  
  /** Samples per iteration (N-Sample strategy) */
  samplesPerIteration: number
}

// ============================================================================
// Quality Evaluation Types
// ============================================================================

/**
 * Quality evaluation result
 */
export interface QualityEvaluation {
  /** Build succeeded without errors */
  buildSuccess: boolean
  
  /** Tests passed successfully */
  testPass: boolean
  
  /** Coverage increase percentage */
  coverageIncrease: number
  
  /** Whether quality meets standards */
  passesStandard: boolean
  
  /** Feedback messages for improvement */
  feedback: string[]
  
  /** Telemetry data for analysis */
  telemetry: IterationTelemetry
}

/**
 * Iteration telemetry data
 */
export interface IterationTelemetry {
  /** Iteration number (1-based) */
  iteration: number
  
  /** Timestamp of evaluation */
  timestamp: string
  
  /** Build time in milliseconds */
  buildTimeMs: number
  
  /** Test execution time in milliseconds */
  testTimeMs: number
  
  /** Total time for iteration */
  totalTimeMs?: number
  
  /** Coverage before this iteration */
  coverageBefore: number
  
  /** Coverage after this iteration */
  coverageAfter: number
  
  /** Temperature used for generation */
  temperature: number
  
  /** Whether this iteration passed standards */
  passesStandard: boolean
  
  /** Issues detected during iteration */
  issues?: string[]
  
  /** Suggestions for next iteration */
  suggestions?: string[]
}

// ============================================================================
// Iterative Improvement Types
// ============================================================================

/**
 * Iterative improvement options
 */
export interface IterativeOptions {
  /** Path to the score report */
  reportPath: string
  
  /** Maximum iterations (default: 3) */
  maxIterations: number
  
  /** Samples per iteration (N-Sample) */
  samplesPerIteration: number
  
  /** Custom quality standards */
  qualityStandards?: Partial<QualityStandards>
  
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Iteration result
 */
export interface IterationResult {
  /** Iteration number */
  iteration: number
  
  /** Generated test code */
  testCode?: string
  
  /** Quality evaluation */
  quality: QualityEvaluation
  
  /** Whether to continue iterating */
  shouldContinue: boolean
  
  /** Reason for stopping (if stopped) */
  stopReason?: 'quality_met' | 'max_iterations' | 'fatal_error'
}

/**
 * Iterative improvement summary
 */
export interface IterativeImprovementSummary {
  /** Function name */
  functionName: string
  
  /** Total iterations performed */
  totalIterations: number
  
  /** Final result */
  finalResult: IterationResult
  
  /** All iteration results */
  iterations: IterationResult[]
  
  /** Total time spent */
  totalTimeMs: number
  
  /** Success status */
  success: boolean
}

// ============================================================================
// Sample Selection (N-Sample Strategy)
// ============================================================================

/**
 * Test candidate (for N-Sample selection)
 */
export interface TestCandidate {
  /** Candidate ID */
  id: number
  
  /** Generated test code */
  testCode: string
  
  /** Quality evaluation */
  quality: QualityEvaluation
  
  /** Composite score for selection */
  score: number
}

/**
 * Sample selection result
 */
export interface SampleSelectionResult {
  /** Selected best candidate */
  selected: TestCandidate
  
  /** All candidates */
  candidates: TestCandidate[]
  
  /** Selection reason */
  reason: string
}

/**
 * Sample scoring weights (for composite score)
 */
export interface SampleScoringWeights {
  /** Build success weight (default: 0.4) */
  build: number
  
  /** Test pass weight (default: 0.3) */
  testPass: number
  
  /** Coverage weight (default: 0.3) */
  coverage: number
}

// ============================================================================
// Feedback Collection
// ============================================================================

/**
 * Feedback type
 */
export type FeedbackType = 'build_error' | 'test_failure' | 'coverage_insufficient' | 'success'

/**
 * Feedback item
 */
export interface FeedbackItem {
  type: FeedbackType
  message: string
  details?: string
  suggestions?: string[]
}

/**
 * Feedback collection
 */
export interface FeedbackCollection {
  functionName: string
  iteration: number
  items: FeedbackItem[]
  timestamp: number
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Re-export all types for convenience
}

