/**
 * Shared TypeScript type definitions for ai-unit-test-generator
 * @packageDocumentation
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Supported priority levels for test generation
 */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

/**
 * Code layers in the architecture
 */
export type Layer = 'foundation' | 'business' | 'state' | 'ui'

/**
 * Function types that can be tested
 */
export type FunctionType = 'function' | 'component' | 'hook' | 'atom'

/**
 * Test generation status
 */
export type TestStatus = 'TODO' | 'DONE' | 'SKIP' | 'FAIL'

// ============================================================================
// Scanner Types
// ============================================================================

/**
 * Function metadata extracted during scanning
 */
export interface FunctionMetadata {
  criticalImports: string[]
  businessEntities: string[]
  hasDocumentation: boolean
  documentation: string
  errorHandling: number
  externalCalls: number
  paramCount: number
  returnType: string
}

/**
 * Scanned function metadata
 */
export interface FunctionTarget {
  name: string
  path: string
  type: FunctionType
  layer: Layer
  internal: boolean
  loc: number
  exported: boolean
  params?: number
  hasJSDoc?: boolean
  hasErrorHandling?: boolean
  hasApiCalls?: boolean
  metadata?: FunctionMetadata
}

/**
 * Scan configuration
 */
export interface ScanConfig {
  rootDir: string
  excludeDirs?: string[]
  includeInternal?: boolean
  minLoc?: number
}

// ============================================================================
// Scorer Types
// ============================================================================

/**
 * Scoring weights for different layers
 */
export interface LayerWeights {
  testability: number
  dependencyCount: number
  complexity: number
  businessCriticality: number
  errorRisk: number
  coverage?: number
}

/**
 * Score thresholds for priority levels
 */
export interface PriorityThresholds {
  P0: number
  P1: number
  P2: number
}

/**
 * Scored function with all metrics
 */
export interface ScoredFunction extends FunctionTarget {
  score: number
  priority: Priority
  testability: number
  dependencyCount: number
  complexity: number
  businessCriticality: number
  errorRisk: number
  coverage?: number
  boundaries?: number
  mocks?: number
  behaviors?: number
}

// ============================================================================
// Boundary Detection Types
// ============================================================================

/**
 * Boundary condition pattern
 */
export interface BoundaryPattern {
  category: string
  description: string
  testCases: Array<{
    input: string
    expectedBehavior: string
  }>
}

/**
 * Detected boundary conditions for a function
 */
export interface BoundaryAnalysis {
  functionName: string
  boundaries: BoundaryPattern[]
  count: number
}

// ============================================================================
// Mock Analysis Types
// ============================================================================

// Mock types moved to core/mock-analyzer.ts (more complete definitions)
// Re-export them from core module instead

// ============================================================================
// Behavior Classification Types
// ============================================================================

// Behavior types moved to core/behavior-classifier.ts (more complete definitions)
// Re-export them from core module instead

// ============================================================================
// Coverage Types
// ============================================================================

/**
 * Cobertura coverage data
 */
export interface CoverageData {
  filePath: string
  lineRate: number
  branchRate: number
  lines: {
    total: number
    covered: number
    uncovered: number
  }
  branches: {
    total: number
    covered: number
    uncovered: number
  }
  uncoveredLines?: number[]
}

/**
 * Coverage summary
 */
export interface CoverageSummary {
  total: CoverageData
  files: Map<string, CoverageData>
}

// ============================================================================
// AI Types
// ============================================================================

/**
 * AI client configuration
 */
export interface AIClientConfig {
  provider: 'cursor' | 'openai' | 'claude' | 'custom'
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * AI prompt context
 */
export interface PromptContext {
  functionName: string
  functionCode: string
  filePath: string
  layer: Layer
  type: FunctionType
  dependencies?: string
  boundaries?: BoundaryAnalysis
  mocks?: any  // MockAnalysis removed - use MockRequirement[] from core/mock-analyzer.ts
  behaviors?: any  // BehaviorAnalysis removed - use Behavior[] from core/behavior-classifier.ts
  coverage?: CoverageData
  examples?: string
}

/**
 * AI generation result
 */
export interface GenerationResult {
  functionName: string
  testCode: string
  success: boolean
  error?: string
  metadata?: {
    tokensUsed?: number
    duration?: number
    iteration?: number
  }
}

// ============================================================================
// Workflow Types
// ============================================================================

/**
 * Generation options
 */
export interface GenerateOptions {
  count?: number
  priority?: Priority
  concurrency?: number
  samples?: number
  maxIterations?: number
  dryRun?: boolean
  reportPath?: string
}

/**
 * Iterative improvement options
 */
export interface IterativeOptions extends GenerateOptions {
  maxIterations: number
  temperature: number
  qualityStandards: {
    minBuildSuccess: number
    minTestPass: number
    minCoverageIncrease: number
  }
}

/**
 * Parallel generation options
 */
export interface ParallelOptions extends GenerateOptions {
  concurrency: number
  batchSize?: number
}

/**
 * Test execution result
 */
export interface TestResult {
  success: boolean
  buildSuccess: boolean
  testPass: boolean
  coverage?: {
    before: number
    after: number
    increase: number
  }
  errors?: string[]
  duration?: number
}

/**
 * Iteration telemetry
 */
export interface IterationTelemetry {
  iteration: number
  buildTimeMs: number
  testTimeMs: number
  coverageBefore: number
  coverageAfter: number
  coverageIncrease: number
  passesStandard: boolean
  issues?: string[]
  suggestions?: string[]
}

// ============================================================================
// Config Types
// ============================================================================

/**
 * Main configuration file structure
 */
export interface AITestConfig {
  version: string
  rootDir: string
  scanConfig: ScanConfig
  scoringConfig: {
    mode: 'layered' | 'unified'
    layers: Record<Layer, {
      patterns: string[]
      weights: LayerWeights
      thresholds: PriorityThresholds
    }>
  }
  crossModuleCategories?: string[]
  aiConfig?: AIClientConfig
  testConfig: {
    framework: 'jest' | 'vitest'
    testPattern: string
    coverageThreshold?: number
  }
}

/**
 * AI enhancement suggestions
 */
export interface AISuggestion {
  category: 'business-path' | 'high-risk' | 'testability'
  type: 'add-keyword' | 'adjust-weight' | 'add-pattern'
  confidence: number
  target: string
  suggestion: string
  reasoning: string
  evidence: string[]
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  suggestions: AISuggestion[]
  summary: {
    totalFunctions: number
    categoriesAnalyzed: number
    highConfidenceSuggestions: number
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * File guard result
 */
export interface FileGuardResult {
  allowed: boolean
  reason?: string
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  originalPath: string
  backupPath: string
  timestamp: number
  size: number
}

/**
 * Action log entry
 */
export interface ActionLogEntry {
  timestamp: number
  action: 'generate' | 'skip' | 'fail'
  functionName: string
  reason?: string
  metadata?: Record<string, unknown>
}

/**
 * Custom error for AI test generation
 */
export class AITestError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AITestError'
  }
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * Marker update
 */
export interface MarkerUpdate {
  functionName: string
  oldStatus: TestStatus
  newStatus: TestStatus
  filePath: string
}

// ============================================================================
// Git Analysis Types
// ============================================================================

/**
 * Git signal data for a file
 */
export interface GitSignals {
  commits30d: number
  commits90d: number
  commits180d: number
  authors30d: number
  inCategory: boolean
  multiPlatform: boolean
}

/**
 * Git analysis result
 */
export interface GitAnalysisResult {
  signals: Record<string, GitSignals>
  summary: {
    totalFiles: number
    hotspotFiles: number
    multiPlatformFiles: number
  }
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Score report entry
 */
export interface ScoreReportEntry {
  status: TestStatus
  score: number
  priority: Priority
  name: string
  path: string
  layer: Layer
  type: FunctionType
  testability: number
  dependencyCount: number
  complexity: number
  businessCriticality: number
  errorRisk: number
  coverage?: number
  boundaries?: number
  mocks?: number
  behaviors?: number
}

/**
 * Generation report
 */
export interface GenerationReport {
  timestamp: number
  options: GenerateOptions
  results: GenerationResult[]
  summary: {
    total: number
    success: number
    failed: number
    skipped: number
    duration: number
  }
  telemetry?: IterationTelemetry[]
}

// ============================================================================
// Export all types from other modules
// ============================================================================

export * from './utils.js'
export * from './cli.js'
export * from './coverage.js'
export * from './quality.js'
export * from './parallel.js'

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Re-export all types for convenience
}

