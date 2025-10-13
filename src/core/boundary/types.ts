/**
 * Boundary Detection Types and Interfaces
 * @module boundary/types
 */

import type { ArrowFunction, FunctionDeclaration, FunctionExpression } from 'ts-morph'

// ============================================================================
// Type Definitions
// ============================================================================

/** Test value with label */
export interface TestValue {
  value: unknown
  label: string
}

/** Test case specification */
export interface TestCase {
  [variable: string]: unknown
  expected?: boolean | unknown
  description: string
}

/** Parameter boundary analysis */
export interface ParameterBoundary {
  type: 'parameter'
  parameterName: string
  parameterType: string
  testValues: TestValue[]
  testCases: TestCase[]
  reasoning: string
  priority: number
}

/** Condition boundary analysis */
export interface ConditionBoundary {
  type: 'if-statement'
  condition: string
  testCases: TestCase[]
  reasoning: string
  priority: number
}

/** Loop boundary analysis */
export interface LoopBoundary {
  type: 'loop'
  loopType: 'for' | 'while' | 'for-of' | 'for-in'
  testCases: TestCase[]
  reasoning: string
  priority: number
}

/** Access boundary analysis */
export interface AccessBoundary {
  type: 'array-access' | 'object-property'
  accessExpression: string
  testCases: TestCase[]
  reasoning: string
  priority: number
}

/** Union type for all boundary types */
export type BoundaryValue = ParameterBoundary | ConditionBoundary | LoopBoundary | AccessBoundary

/** Function node type from ts-morph (internal use only, not exported to avoid conflicts) */
export type FunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression

/** Boundary group by parameter */
export interface BoundaryGroup {
  parameter: string
  boundaries: BoundaryValue[]
}

/** Boundary statistics */
export interface BoundaryStats {
  total: number
  byType: {
    parameter: number
    condition: number
    loop: number
    access: number
  }
  byPriority: {
    high: number
    medium: number
    low: number
  }
  complexity: 'low' | 'medium' | 'high' | 'very-high'
  recommendations: string[]
}

