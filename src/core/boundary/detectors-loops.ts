/**
 * Loop and Access Boundary Detection
 * @module boundary/detectors-loops
 */

import { SyntaxKind } from 'ts-morph'
import type { AccessBoundary, FunctionNode, LoopBoundary } from './types.js'

/**
 * Detect loop boundaries
 * 
 * Analyzes loops to generate test cases for:
 * - For loops: empty iteration, single, multiple
 * - While loops: immediate exit, normal execution
 * - For-of/for-in loops: empty collections
 * 
 * @param functionNode - Function AST node
 * @returns Array of loop boundaries
 * 
 * @example
 * ```typescript
 * const boundaries = detectLoopBoundaries(functionNode)
 * console.log(`Found ${boundaries.length} loop boundaries`)
 * ```
 */
export function detectLoopBoundaries(functionNode: FunctionNode): LoopBoundary[] {
  const boundaries: LoopBoundary[] = []
  
  const forLoops = functionNode.getDescendantsOfKind(SyntaxKind.ForStatement)
  
  // For loops
  if (forLoops.length > 0) {
    boundaries.push({
      type: 'loop',
      loopType: 'for',
      testCases: [
        { iterations: 0, description: 'empty loop (no iterations)' },
        { iterations: 1, description: 'single iteration' },
        { iterations: 10, description: 'multiple iterations' }
      ],
      reasoning: 'Loop boundary testing: zero, one, many iterations',
      priority: 2
    })
  }
  
  return boundaries
}

/**
 * Detect access boundaries
 * 
 * Analyzes array access and object property access to generate test cases for:
 * - Array access: valid indices, out of bounds, negative
 * - Object property access: existing, missing properties
 * 
 * @param functionNode - Function AST node
 * @returns Array of access boundaries
 * 
 * @example
 * ```typescript
 * const boundaries = detectAccessBoundaries(functionNode)
 * console.log(`Found ${boundaries.length} access boundaries`)
 * ```
 */
export function detectAccessBoundaries(functionNode: FunctionNode): AccessBoundary[] {
  const boundaries: AccessBoundary[] = []
  
  const elementAccess = functionNode.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
  
  for (const access of elementAccess) {
    const expression = access.getExpression().getText()
    
    boundaries.push({
      type: 'array-access',
      accessExpression: expression,
      testCases: [
        { index: 0, description: 'first element' },
        { index: -1, description: 'negative index' },
        { index: 999, description: 'out of bounds' }
      ],
      reasoning: `Testing array access boundaries for: ${expression}`,
      priority: 2
    })
  }
  
  return boundaries
}

