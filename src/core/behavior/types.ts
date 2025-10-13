/**
 * Behavior Classification Types and Constants
 * @module behavior/types
 */

import type { ArrowFunction, FunctionDeclaration, FunctionExpression } from 'ts-morph'

// ============================================================================
// Type Definitions
// ============================================================================

/** Behavior category definition */
export interface BehaviorCategory {
  id: string
  name: string
  emoji: string
  description: string
  priority: number
  color: string
}

/** Test case specification for behavior */
export interface BehaviorTestCase {
  scenario: string
  inputs?: Array<{ name: string; value: string }>
  expectedOutcome: string
  importance?: string
}

/** Behavior classification result */
export interface Behavior {
  category: BehaviorCategory
  description: string
  testCase: BehaviorTestCase
  reasoning: string
  exampleTest: string
}

/** Classification options */
export interface ClassifyOptions {
  includeExamples?: boolean
  verbosity?: 'minimal' | 'normal' | 'verbose'
}

/** Behavior statistics */
export interface BehaviorStats {
  total: number
  byCategory: Record<string, number>
  byImportance: {
    critical: number
    important: number
    optional: number
  }
}

/** Test plan */
export interface TestPlan {
  totalTests: number
  estimatedTime: string
  coverage: {
    happyPath: number
    edgeCases: number
    errorPaths: number
  }
  recommendations: string[]
}

/** Function node type from ts-morph */
export type FunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression

// ============================================================================
// Constants
// ============================================================================

/**
 * Behavior category definitions
 */
export const BEHAVIOR_CATEGORIES = {
  HAPPY_PATH: {
    id: 'happy-path',
    name: 'Happy Path',
    emoji: '✅',
    description: '理想和预期的用例 - 一切正常工作的场景',
    priority: 1,
    color: '#22c55e'
  } as BehaviorCategory,
  EDGE_CASE: {
    id: 'edge-case',
    name: 'Edge Case',
    emoji: '⚠️',
    description: '异常或极端的场景 - 需要防御性编程',
    priority: 2,
    color: '#f59e0b'
  } as BehaviorCategory,
  ERROR_PATH: {
    id: 'error-path',
    name: 'Error Path',
    emoji: '❌',
    description: '异常和错误处理 - 确保系统健壮性',
    priority: 3,
    color: '#ef4444'
  } as BehaviorCategory
} as const

