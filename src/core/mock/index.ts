/**
 * Mock Analysis System
 * 
 * Automatically identifies dependencies that need mocking and recommends
 * the best mock strategies.
 * 
 * Supports detection of:
 * - HTTP requests (fetch, axios, request)
 * - Time-related (Date, setTimeout, setInterval)
 * - Random numbers (Math.random)
 * - File system (fs)
 * - Database operations (mongoose, typeorm, sequelize)
 * - External module imports
 * 
 * References:
 * - Keploy ut-gen: https://github.com/keploy/keploy/blob/main/README-UnitGen.md
 * 
 * @module mock
 */

// Re-export types (excluding FunctionNode to avoid conflicts)
export type { HttpMethod, ImportAnalysis, MockRequirement, MockStats, MockStrategy } from './types.js'

// Re-export functions
export { analyzeImports } from './analyzer-imports.js'
export { extractHttpMethod, formatHttpCall } from './detectors-http.js'
export { formatRandomCall, formatTimeCall } from './detectors-time.js'
export { formatDatabaseCall, formatFileSystemCall, formatRedisCall, isDatabaseCall, isFileSystemCall, isRedisCall } from './detectors-io.js'
export { formatMocksForPrompt, getMockStats } from './formatter.js'

// Imports for main function
import { SyntaxKind, type CallExpression } from 'ts-morph'
import { analyzeImports } from './analyzer-imports.js'
import { formatDatabaseCall, formatFileSystemCall, formatRedisCall, isDatabaseCall, isFileSystemCall, isRedisCall } from './detectors-io.js'
import { formatRandomCall, formatTimeCall } from './detectors-time.js'
import { formatHttpCall } from './detectors-http.js'
import type { FunctionNode, ImportAnalysis, MockRequirement } from './types.js'

// ============================================================================
// Main Export
// ============================================================================

/**
 * Analyze mock requirements for a function (simplified)
 * 
 * Identifies external dependencies that may need mocking:
 * - HTTP calls (fetch, axios)
 * - Database calls (mongoose, typeorm, sequelize)
 * - File system (fs)
 * - Timers (setTimeout, setInterval, Date)
 * - Random (Math.random)
 * 
 * @param functionNode - Function AST node from ts-morph
 * @returns Array of mock requirements grouped by type
 * 
 * @example
 * ```typescript
 * import { Project } from 'ts-morph'
 * import { analyzeMockRequirements } from './mock/index.js'
 * 
 * const project = new Project()
 * const sourceFile = project.addSourceFileAtPath('example.ts')
 * const fn = sourceFile.getFunction('myFunction')
 * 
 * const mocks = analyzeMockRequirements(fn)
 * console.log(`Found ${mocks.length} mock types`)
 * ```
 */
export function analyzeMockRequirements(functionNode: FunctionNode): MockRequirement[] {
  const callsByType: Map<string, Set<string>> = new Map()
  const sourceFile = functionNode.getSourceFile()
  const imports = analyzeImports(sourceFile)
  
  // Find all function calls
  const calls = functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
  
  for (const call of calls) {
    try {
      const callee = call.getExpression().getText()
      const result = detectMockType(call, callee, imports)
      
      if (result) {
        const { type, formattedCall } = result
        if (!callsByType.has(type)) {
          callsByType.set(type, new Set())
        }
        callsByType.get(type)?.add(formattedCall)
      }
    } catch {
      // Skip calls that can't be analyzed
      continue
    }
  }
  
  // Convert to MockRequirement array
  return Array.from(callsByType.entries()).map(([type, calls]) => ({
    type,
    calls: Array.from(calls)
  }))
}

/**
 * Detect mock type for a function call
 * 
 * @param call - Function call expression
 * @param callee - Callee expression text
 * @param imports - Import analysis result
 * @returns Detection result or null
 * 
 * @internal
 */
function detectMockType(
  call: CallExpression,
  callee: string,
  imports: ImportAnalysis
): { type: string; formattedCall: string } | null {
  // HTTP calls
  if (callee.includes('axios') || callee.includes('fetch') || callee.includes('.get(') || callee.includes('.post(')) {
    const args = call.getArguments()
    let url = 'unknown'
    if (args.length > 0) {
      const urlArg = args[0]
      if (urlArg) {
        url = urlArg.getText().replace(/['"]/g, '')
      }
    }
    const method = callee.includes('.post') ? 'post' : 
                   callee.includes('.put') ? 'put' :
                   callee.includes('.delete') ? 'delete' : 'get'
    return { type: 'http', formattedCall: formatHttpCall(callee, method, url) }
  }
  
  // Time-related calls
  if (callee.includes('setTimeout') || callee.includes('setInterval') || callee.includes('new Date')) {
    return { type: 'timer', formattedCall: formatTimeCall(callee) }
  }
  
  // Random calls
  if (callee.includes('Math.random')) {
    return { type: 'random', formattedCall: formatRandomCall() }
  }
  
  // File system calls
  if (isFileSystemCall(callee)) {
    return { type: 'filesystem', formattedCall: formatFileSystemCall(callee) }
  }
  
  // Database calls
  if (isDatabaseCall(callee)) {
    return { type: 'database', formattedCall: formatDatabaseCall(callee, imports) }
  }
  
  // Redis calls
  if (isRedisCall(callee)) {
    return { type: 'database', formattedCall: formatRedisCall(callee) }
  }
  
  return null
}

