/**
 * Behavior Classification System
 * 
 * Classifies test scenarios into behavior categories for comprehensive coverage.
 * 
 * Categories:
 * - Happy Path: Ideal and expected use cases
 * - Edge Case: Unusual or extreme scenarios
 * - Error Path: Exception and error handling
 * 
 * References:
 * - Qodo Cover Behavior-Driven Testing
 * - Google Testing Blog - Test Behaviors, Not Implementation
 * 
 * @module behavior
 */

// Re-export types and constants
export * from './types.js'

// Re-export detectors
export { detectEdgeCases, detectErrorPaths, detectHappyPath, generateHappyPathExample, getFunctionName } from './detectors.js'

// Re-export formatters
export { formatBehaviorsForPrompt, generateTestPlan, getBehaviorStats } from './formatter.js'

// Import for main function
import { detectEdgeCases, detectErrorPaths, detectHappyPath } from './detectors.js'
import type { Behavior, ClassifyOptions, FunctionNode } from './types.js'

// ============================================================================
// Main Export
// ============================================================================

/**
 * Classify function behaviors
 * 
 * Analyzes a function's code to identify different behavior categories:
 * - Happy Path: Normal execution with valid inputs
 * - Edge Cases: Boundary conditions and special values
 * - Error Paths: Exception handling and error cases
 * 
 * @param functionNode - Function AST node from ts-morph
 * @param options - Classification options
 * @returns Array of classified behaviors
 * 
 * @example
 * ```typescript
 * import { Project } from 'ts-morph'
 * import { classifyBehaviors } from './behavior/index.js'
 * 
 * const project = new Project()
 * const sourceFile = project.addSourceFileAtPath('example.ts')
 * const fn = sourceFile.getFunction('myFunction')
 * 
 * const behaviors = classifyBehaviors(fn)
 * console.log(`Found ${behaviors.length} behaviors`)
 * ```
 */
export function classifyBehaviors(
  functionNode: FunctionNode,
  _options: ClassifyOptions = {}
): Behavior[] {
  const behaviors: Behavior[] = []
  
  try {
    // 1. Detect Happy Path
    const happyPath = detectHappyPath(functionNode)
    if (happyPath) {
      behaviors.push(happyPath)
    }
    
    // 2. Detect Edge Cases
    const edgeCases = detectEdgeCases(functionNode)
    behaviors.push(...edgeCases)
    
    // 3. Detect Error Paths
    const errorPaths = detectErrorPaths(functionNode)
    behaviors.push(...errorPaths)
    
  } catch (error) {
    // If analysis fails, return empty array
    console.warn('Behavior classification failed:', error)
    return []
  }
  
  return behaviors
}

