/**
 * Coverage Parser Type Definitions (Cobertura & Jest)
 * @packageDocumentation
 */

// ============================================================================
// Coverage Formats
// ============================================================================

/**
 * Supported coverage formats
 */
export type CoverageFormat = 'cobertura' | 'jest' | 'lcov'

// ============================================================================
// Cobertura Coverage Types
// ============================================================================

/**
 * Cobertura line coverage information
 */
export interface CoberturaLine {
  lineNumber: number
  hits: number
  isBranch: boolean
  branchRate?: string
}

/**
 * Uncovered line detail
 */
export interface UncoveredLine {
  file: string
  lineNumber: number
  hits: number
  isBranch: boolean
}

/**
 * File coverage detail
 */
export interface FileCoverageDetail {
  totalLines: number
  coveredLines: number
  uncoveredLines: number[]
  branchPoints: number
  coveredBranches: number
  coverage: number
  branchCoverage: number
}

/**
 * Cobertura coverage data (complete structure)
 */
export interface CoberturaCoverageData {
  format: 'cobertura'
  lineRate: number
  branchRate: number
  linesCovered: number
  linesValid: number
  branchesCovered?: number
  branchesValid?: number
  uncoveredLines: UncoveredLine[]
  filesCoverage: Record<string, FileCoverageDetail>
  timestamp?: number
}

// ============================================================================
// Jest Coverage Types
// ============================================================================

/**
 * Jest statement coverage
 */
export interface JestStatementCoverage {
  total: number
  covered: number
  skipped: number
  pct: number
}

/**
 * Jest branch coverage
 */
export interface JestBranchCoverage {
  total: number
  covered: number
  skipped: number
  pct: number
}

/**
 * Jest function coverage
 */
export interface JestFunctionCoverage {
  total: number
  covered: number
  skipped: number
  pct: number
}

/**
 * Jest line coverage
 */
export interface JestLineCoverage {
  total: number
  covered: number
  skipped: number
  pct: number
}

/**
 * Jest file coverage data
 */
export interface JestFileCoverage {
  lines: JestLineCoverage
  statements: JestStatementCoverage
  functions: JestFunctionCoverage
  branches: JestBranchCoverage
  path: string
}

/**
 * Jest coverage summary
 */
export interface JestCoverageSummary {
  total: {
    lines: JestLineCoverage
    statements: JestStatementCoverage
    functions: JestFunctionCoverage
    branches: JestBranchCoverage
  }
  [filePath: string]: JestFileCoverage | JestCoverageSummary['total']
}

/**
 * Jest coverage data (complete structure)
 */
export interface JestCoverageData {
  format: 'jest'
  summary: JestCoverageSummary
  timestamp?: number
}

// ============================================================================
// Unified Coverage Types
// ============================================================================

/**
 * Unified coverage data (supports both formats)
 */
export type CoverageData = CoberturaCoverageData | JestCoverageData

/**
 * Coverage comparison result
 */
export interface CoverageComparison {
  before: number
  after: number
  increase: number
  increasePercent: number
}

/**
 * Coverage threshold
 */
export interface CoverageThreshold {
  lines?: number
  statements?: number
  branches?: number
  functions?: number
}

/**
 * Coverage options
 */
export interface CoverageOptions {
  format?: CoverageFormat
  outputPath?: string
  threshold?: CoverageThreshold
  failOnThreshold?: boolean
}

// ============================================================================
// Coverage Parser Interface
// ============================================================================

/**
 * Coverage parser interface
 */
export interface CoverageParser {
  /**
   * Parse Cobertura XML coverage report
   */
  parseCoberturaXml(xmlPath: string): Promise<CoberturaCoverageData>
  
  /**
   * Parse Jest JSON coverage report
   */
  parseJestJson(jsonPath: string): Promise<JestCoverageData>
  
  /**
   * Get coverage percentage
   */
  getCoveragePercent(coverage: CoverageData): number
  
  /**
   * Compare two coverage reports
   */
  compareCoverage(before: CoverageData, after: CoverageData): CoverageComparison
  
  /**
   * Check if coverage meets threshold
   */
  meetsThreshold(coverage: CoverageData, threshold: CoverageThreshold): boolean
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Re-export all types for convenience
}

