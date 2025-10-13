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
export { analyzeHttpCall, extractHttpMethod, generateAxiosMockExample, generateMswExample } from './detectors-http.js'
export { analyzeRandomCall, analyzeTimeCall } from './detectors-time.js'
export { analyzeDatabaseCall, analyzeFileSystemCall, analyzeRedisCall, isDatabaseCall, isFileSystemCall, isRedisCall } from './detectors-io.js'
export { formatMocksForPrompt, getMockStats } from './formatter.js'

// Imports for main function
import { SyntaxKind, type CallExpression } from 'ts-morph'
import { analyzeImports } from './analyzer-imports.js'
import { analyzeDatabaseCall, analyzeFileSystemCall, analyzeRedisCall, isDatabaseCall, isFileSystemCall, isRedisCall } from './detectors-io.js'
import { analyzeRandomCall, analyzeTimeCall } from './detectors-time.js'
import { analyzeHttpCall } from './detectors-http.js'
import type { FunctionNode, ImportAnalysis, MockRequirement } from './types.js'

// ============================================================================
// Main Export
// ============================================================================

/**
 * Analyze mock requirements for a function
 * 
 * Identifies external dependencies and recommends mocking strategies:
 * - HTTP calls → axios-mock-adapter or MSW
 * - Database calls → in-memory databases or jest.mock
 * - File system → jest.mock
 * - Timers → jest.useFakeTimers
 * - Random → jest.spyOn
 * 
 * @param functionNode - Function AST node from ts-morph
 * @returns Array of mock requirements
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
 * console.log(`Found ${mocks.length} mock requirements`)
 * ```
 */
export function analyzeMockRequirements(functionNode: FunctionNode): MockRequirement[] {
  const mocks: MockRequirement[] = []
  const sourceFile = functionNode.getSourceFile()
  const imports = analyzeImports(sourceFile)
  
  // Find all function calls
  const calls = functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
  
  for (const call of calls) {
    try {
      const callee = call.getExpression().getText()
      const mock = analyzeFunctionCall(call, callee, imports)
      
      if (mock) {
        mocks.push(mock)
      }
    } catch {
      // Skip calls that can't be analyzed
      continue
    }
  }
  
  // Remove duplicates (by type + mockStrategy)
  return Array.from(
    new Map(mocks.map(m => [`${m.type}-${m.mockStrategy}`, m])).values()
  )
}

/**
 * Analyze a single function call to determine mock requirements
 * 
 * @param call - Function call expression
 * @param callee - Callee expression text
 * @param imports - Import analysis result
 * @returns Mock requirement or null
 * 
 * @internal
 */
function analyzeFunctionCall(
  call: CallExpression,
  callee: string,
  imports: ImportAnalysis
): MockRequirement | null {
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
    return analyzeHttpCall(callee, method, url)
  }
  
  // Time-related calls
  if (callee.includes('setTimeout') || callee.includes('setInterval') || callee.includes('new Date')) {
    return analyzeTimeCall(callee)
  }
  
  // Random calls
  if (callee.includes('Math.random')) {
    return analyzeRandomCall(callee)
  }
  
  // File system calls
  if (isFileSystemCall(callee)) {
    return analyzeFileSystemCall(callee)
  }
  
  // Database calls
  if (isDatabaseCall(callee)) {
    return analyzeDatabaseCall(callee, imports)
  }
  
  // Redis calls
  if (isRedisCall(callee)) {
    return analyzeRedisCall(callee)
  }
  
  return null
}

