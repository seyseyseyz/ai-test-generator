/**
 * Test Validator
 * 
 * Validates generated test code by actually running it and checking:
 * - Build success (TypeScript compilation)
 * - Test execution (passes/fails)
 * - Coverage percentage
 * 
 * Inspired by Qodo's inline validation approach
 * 
 * @module testing/validator
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const execAsync = promisify(exec)

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean
  buildSuccess: boolean
  testsPass: boolean
  coverage: number
  errors: string[]
  stdout?: string
  stderr?: string
}

/**
 * Validation options
 */
export interface ValidationOptions {
  testCommand?: string
  timeout?: number
  tempDir?: string
}

// ============================================================================
// TestValidator Class
// ============================================================================

/**
 * Test code validator
 * 
 * @example
 * ```typescript
 * const validator = new TestValidator()
 * const result = await validator.validate(testCode, 'src/utils/helper.test.ts')
 * 
 * if (result.success) {
 *   console.log(`✅ Tests pass with ${result.coverage}% coverage`)
 * } else {
 *   console.log(`❌ Validation failed: ${result.errors[0]}`)
 * }
 * ```
 */
export class TestValidator {
  private options: Required<ValidationOptions>

  constructor(options: ValidationOptions = {}) {
    this.options = {
      testCommand: options.testCommand || 'npm test --',
      timeout: options.timeout || 30000,
      tempDir: options.tempDir || '.ai-test-temp'
    }
  }

  /**
   * Validate test code by running it
   * 
   * @param testCode - Generated test code
   * @param testFilePath - Path where test file should be created
   * @returns Validation result
   * 
   * @example
   * ```typescript
   * const result = await validator.validate(testCode, 'src/utils/helper.test.ts')
   * console.log(`Build: ${result.buildSuccess}, Tests: ${result.testsPass}`)
   * ```
   */
  async validate(testCode: string, testFilePath: string): Promise<ValidationResult> {
    const tempFile = this.getTempFilePath(testFilePath)
    
    try {
      // 1. Write test code to temp file
      this.writeTestFile(tempFile, testCode)

      // 2. Run tests
      const { stdout, stderr } = await execAsync(
        `${this.options.testCommand} ${tempFile} --coverage --json --silent`,
        { 
          cwd: process.cwd(), 
          timeout: this.options.timeout,
          env: { ...process.env, CI: 'true' }
        }
      )

      // 3. Parse results
      try {
        const result = JSON.parse(stdout)
        const coverage = this.extractCoverage(result)
        
        return {
          success: result.success === true,
          buildSuccess: true,
          testsPass: result.success === true,
          coverage,
          errors: result.success ? [] : this.extractErrors(result),
          stdout,
          stderr
        }
      } catch {
        // If JSON parsing fails, try to extract info from stderr
        return {
          success: !stderr.includes('FAIL') && !stderr.includes('Error'),
          buildSuccess: true,
          testsPass: !stderr.includes('FAIL'),
          coverage: 0,
          errors: stderr ? [stderr] : ['Unknown error'],
          stdout,
          stderr
        }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; stdout?: string; stderr?: string }
      
      // Check if it's a build error or test error
      const isBuildError = err.stderr?.includes('SyntaxError') || 
                          err.stderr?.includes('Cannot find module') ||
                          err.message?.includes('Command failed')
      
      return {
        success: false,
        buildSuccess: !isBuildError,
        testsPass: false,
        coverage: 0,
        errors: [err.message || String(error)],
        stdout: err.stdout,
        stderr: err.stderr
      }
    } finally {
      // 4. Cleanup temp file
      this.cleanup(tempFile)
    }
  }

  /**
   * Extract coverage percentage from test result
   */
  private extractCoverage(result: {
    coverageMap?: {
      getCoverageSummary?: () => {
        lines: { pct: number }
        statements: { pct: number }
        functions: { pct: number }
        branches: { pct: number }
      }
    }
  }): number {
    if (!result.coverageMap?.getCoverageSummary) return 0
    
    const summary = result.coverageMap.getCoverageSummary()
    return Math.round(
      (summary.lines.pct + summary.statements.pct + summary.functions.pct + summary.branches.pct) / 4
    )
  }

  /**
   * Extract error messages from test result
   */
  private extractErrors(result: {
    testResults?: Array<{
      assertionResults?: Array<{
        status: string
        failureMessages?: string[]
      }>
    }>
  }): string[] {
    if (!result.testResults) return ['Unknown test failure']
    
    return result.testResults
      .flatMap(r => r.assertionResults || [])
      .filter(a => a.status === 'failed')
      .flatMap(a => a.failureMessages || [])
      .slice(0, 3) // Limit to first 3 errors
  }

  /**
   * Get temp file path
   */
  private getTempFilePath(originalPath: string): string {
    const filename = originalPath.split('/').pop() || 'test.ts'
    return join(this.options.tempDir, filename)
  }

  /**
   * Write test file
   */
  private writeTestFile(filePath: string, content: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(filePath, content, 'utf8')
  }

  /**
   * Cleanup temp file
   */
  private cleanup(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}


