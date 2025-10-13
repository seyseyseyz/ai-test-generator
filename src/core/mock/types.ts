/**
 * Mock Analysis Types
 * @module mock/types
 */

import type { ArrowFunction, FunctionDeclaration, FunctionExpression, SourceFile } from 'ts-morph'

// ============================================================================
// Type Definitions
// ============================================================================

/** Function node type from ts-morph (internal use only) */
export type FunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression

/** HTTP method types */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/** Mock strategy types */
export type MockStrategy = 'jest.fn' | 'jest.mock' | 'sinon.stub' | 'msw' | 'nock' | 'manual'

/** Import analysis result */
export interface ImportAnalysis {
  modules: Set<string>
  axios: boolean
  fetch: boolean
  mongoose: boolean
  typeorm: boolean
  sequelize: boolean
  redis: boolean
  fs: boolean
}

/** Mock requirement specification */
export interface MockRequirement {
  type: string
  mockStrategy: string
  reason: string
  setupExample: string
  testExample?: string
  priority?: number
}

/** Mock statistics */
export interface MockStats {
  total: number
  byType: Record<string, number>
  byStrategy: Record<string, number>
  complexity: 'low' | 'medium' | 'high' | 'very-high'
  recommendations: string[]
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

/** Re-export SourceFile for analyzer functions */
export type { SourceFile }

