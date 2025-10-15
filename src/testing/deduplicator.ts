/**
 * Test Deduplication
 * 
 * Detects and removes duplicate test cases using similarity analysis.
 * Inspired by Keploy's deduplication approach.
 * 
 * @module testing/deduplicator
 */

import { Project, SyntaxKind, type CallExpression } from 'ts-morph'
import levenshtein from 'fast-levenshtein'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Duplicate test pair
 */
export interface DuplicatePair {
  test1: string
  test2: string
  similarity: number
  line1: number
  line2: number
  code1: string
  code2: string
}

/**
 * Test case information
 */
interface TestCase {
  name: string
  code: string
  line: number
}

/**
 * Deduplication options
 */
export interface DeduplicationOptions {
  threshold?: number
  ignoreWhitespace?: boolean
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  totalTests: number
  duplicates: DuplicatePair[]
  uniqueTests: number
}

// ============================================================================
// TestDeduplicator Class
// ============================================================================

/**
 * Test deduplicator
 * 
 * @example
 * ```typescript
 * const dedup = new TestDeduplicator()
 * const result = await dedup.findDuplicates('src/utils/helper.test.ts')
 * 
 * console.log(`Found ${result.duplicates.length} duplicate(s)`)
 * result.duplicates.forEach(dup => {
 *   console.log(`${dup.test1} ≈ ${dup.test2} (${(dup.similarity * 100).toFixed(1)}%)`)
 * })
 * ```
 */
export class TestDeduplicator {
  private options: Required<DeduplicationOptions>

  constructor(options: DeduplicationOptions = {}) {
    this.options = {
      threshold: options.threshold ?? 0.85,
      ignoreWhitespace: options.ignoreWhitespace ?? true
    }
  }

  /**
   * Find duplicate tests in a test file
   * 
   * @param testFile - Path to test file
   * @param threshold - Similarity threshold (0-1), defaults to instance threshold
   * @returns Duplicate pairs
   * 
   * @example
   * ```typescript
   * const duplicates = await dedup.findDuplicates('src/utils/helper.test.ts', 0.9)
   * ```
   */
  async findDuplicates(
    testFile: string,
    threshold?: number
  ): Promise<DeduplicationResult> {
    const actualThreshold = threshold ?? this.options.threshold
    const project = new Project()
    const sourceFile = project.addSourceFileAtPath(testFile)

    // Extract all test cases
    const testCases = this.extractTestCases(sourceFile)
    const duplicates: DuplicatePair[] = []

    // Compare all pairs
    for (let i = 0; i < testCases.length; i++) {
      for (let j = i + 1; j < testCases.length; j++) {
        const test1 = testCases[i]
        const test2 = testCases[j]
        
        if (!test1 || !test2) continue

        const similarity = this.calculateSimilarity(test1.code, test2.code)

        if (similarity >= actualThreshold) {
          duplicates.push({
            test1: test1.name,
            test2: test2.name,
            similarity,
            line1: test1.line,
            line2: test2.line,
            code1: test1.code,
            code2: test2.code
          })
        }
      }
    }

    return {
      totalTests: testCases.length,
      duplicates,
      uniqueTests: testCases.length - duplicates.length
    }
  }

  /**
   * Extract test cases from source file
   */
  private extractTestCases(sourceFile: ReturnType<Project['addSourceFileAtPath']>): TestCase[] {
    const testCases: TestCase[] = []

    // Find all test() or it() calls
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      if (this.isTestCall(call)) {
        const name = this.extractTestName(call)
        const code = call.getText()
        const line = call.getStartLineNumber()

        testCases.push({ name, code, line })
      }
    }

    return testCases
  }

  /**
   * Check if call expression is a test call
   */
  private isTestCall(call: CallExpression): boolean {
    const expr = call.getExpression()
    const text = expr.getText()
    return text === 'test' || text === 'it' || text.endsWith('.test') || text.endsWith('.it')
  }

  /**
   * Extract test name from call expression
   */
  private extractTestName(call: CallExpression): string {
    const args = call.getArguments()
    if (args.length === 0) return 'unnamed'

    const firstArg = args[0]
    if (!firstArg) return 'unnamed'

    const text = firstArg.getText()
    // Remove quotes
    return text.replace(/^['"`](.*)['"`]$/, '$1')
  }

  /**
   * Calculate similarity between two code strings
   * 
   * Uses Levenshtein distance normalized by max length
   */
  private calculateSimilarity(code1: string, code2: string): number {
    let str1 = code1
    let str2 = code2

    // Optionally ignore whitespace
    if (this.options.ignoreWhitespace) {
      str1 = str1.replace(/\s+/g, ' ').trim()
      str2 = str2.replace(/\s+/g, ' ').trim()
    }

    const distance = levenshtein.get(str1, str2)
    const maxLen = Math.max(str1.length, str2.length)

    if (maxLen === 0) return 1.0

    return 1 - (distance / maxLen)
  }
}

/**
 * Remove a test case from file by line number
 * 
 * @param testFile - Path to test file
 * @param lineNumber - Line number of test to remove
 * 
 * @example
 * ```typescript
 * await removeTestCase('src/utils/helper.test.ts', 42)
 * ```
 */
export async function removeTestCase(testFile: string, lineNumber: number): Promise<void> {
  const project = new Project()
  const sourceFile = project.addSourceFileAtPath(testFile)

  // Find the test call at the specified line
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExpressions) {
    if (call.getStartLineNumber() === lineNumber) {
      const expr = call.getExpression()
      const text = expr.getText()

      if (text === 'test' || text === 'it' || text.endsWith('.test') || text.endsWith('.it')) {
        // Remove the entire statement containing the test call
        const statement = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement)
        if (statement) {
          statement.remove()
          await sourceFile.save()
          return
        }
      }
    }
  }

  throw new Error(`No test found at line ${lineNumber} in ${testFile}`)
}


