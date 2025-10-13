/**
 * Boundary Detection System
 * 
 * Automatically identifies boundary values for function parameters and conditions,
 * generating comprehensive test cases.
 * 
 * References:
 * - Keploy ut-gen: https://github.com/keploy/keploy/blob/main/README-UnitGen.md
 * - IEEE 754 Floating Point Standard
 * 
 * @module boundary
 */

// Re-export types (excluding FunctionNode to avoid conflicts with behavior module)
export type { AccessBoundary, BoundaryGroup, BoundaryStats, BoundaryValue, ConditionBoundary, LoopBoundary, ParameterBoundary, TestCase, TestValue } from './types.js'

// Re-export detectors
export { detectParameterBoundaries } from './detectors-params.js'
export { detectConditionBoundaries, extractConditionBoundaries } from './detectors-conditions.js'
export { detectAccessBoundaries, detectLoopBoundaries } from './detectors-loops.js'

// Re-export formatters
export { formatBoundariesForPrompt, getBoundaryStats, groupBoundariesByParameter } from './formatter.js'

// Import for main function
import { detectAccessBoundaries, detectLoopBoundaries } from './detectors-loops.js'
import { detectConditionBoundaries } from './detectors-conditions.js'
import { detectParameterBoundaries } from './detectors-params.js'
import type { BoundaryValue, FunctionNode } from './types.js'

// ============================================================================
// Main Export
// ============================================================================

/**
 * Detect all boundary conditions for a function
 * 
 * Analyzes a function's code to identify boundary values for:
 * - Parameters: type-specific boundaries (numbers, strings, arrays, etc.)
 * - Conditions: if-statement boundary values
 * - Loops: iteration boundaries
 * - Access: array/object access boundaries
 * 
 * @param functionNode - Function AST node from ts-morph
 * @returns Array of all detected boundaries
 * 
 * @example
 * ```typescript
 * import { Project } from 'ts-morph'
 * import { detectBoundaries } from './boundary/index.js'
 * 
 * const project = new Project()
 * const sourceFile = project.addSourceFileAtPath('example.ts')
 * const fn = sourceFile.getFunction('myFunction')
 * 
 * const boundaries = detectBoundaries(fn)
 * console.log(`Found ${boundaries.length} boundaries`)
 * ```
 */
export function detectBoundaries(functionNode: FunctionNode): BoundaryValue[] {
  const boundaries: BoundaryValue[] = []
  
  try {
    // 1. Detect parameter boundaries
    const paramBoundaries = detectParameterBoundaries(functionNode)
    boundaries.push(...paramBoundaries)
    
    // 2. Detect condition boundaries
    const conditionBoundaries = detectConditionBoundaries(functionNode)
    boundaries.push(...conditionBoundaries)
    
    // 3. Detect loop boundaries
    const loopBoundaries = detectLoopBoundaries(functionNode)
    boundaries.push(...loopBoundaries)
    
    // 4. Detect access boundaries
    const accessBoundaries = detectAccessBoundaries(functionNode)
    boundaries.push(...accessBoundaries)
    
  } catch (error) {
    // If analysis fails, return whatever we collected so far
    console.warn('Boundary detection failed:', error)
  }
  
  return boundaries
}

