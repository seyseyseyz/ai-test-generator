/**
 * Test Generation with Real-time Validation
 * 
 * Generates test code and validates it by actually running the tests.
 * If validation fails, automatically retries with error feedback.
 * 
 * Inspired by Qodo's inline validation approach
 * 
 * @module workflows/generate-with-validation
 */

import { TestValidator, type ValidationResult } from '../testing/validator.js'
import type { FunctionTarget } from '../types/index.js'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Generation options with validation
 */
export interface GenerateWithValidationOptions {
  maxAttempts?: number
  timeout?: number
  testCommand?: string
  onAttempt?: (attempt: number, result: ValidationResult) => void
}

/**
 * Generation result with validation
 */
export interface GenerateWithValidationResult {
  code: string
  attempts: number
  validation: ValidationResult
  allAttempts: Array<{
    attempt: number
    validation: ValidationResult
  }>
}

/**
 * Feedback for retry
 */
export interface GenerationFeedback {
  errors: string[]
  attempt: number
  buildSuccess: boolean
  testsPass: boolean
  coverage?: number
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate test code with real-time validation and auto-retry
 * 
 * @param target - Function to generate tests for
 * @param generateFn - Function that generates test code
 * @param options - Generation options
 * @returns Generation result with validation
 * 
 * @example
 * ```typescript
 * const result = await generateWithValidation(
 *   target,
 *   async (target, feedback) => {
 *     // Your test generation logic
 *     return testCode
 *   },
 *   { maxAttempts: 3 }
 * )
 * 
 * if (result.validation.success) {
 *   console.log(`✅ Generated valid tests in ${result.attempts} attempt(s)`)
 *   console.log(`Coverage: ${result.validation.coverage}%`)
 * }
 * ```
 */
export async function generateWithValidation(
  target: FunctionTarget,
  generateFn: (target: FunctionTarget, feedback?: GenerationFeedback) => Promise<string>,
  options: GenerateWithValidationOptions = {}
): Promise<GenerateWithValidationResult> {
  const maxAttempts = options.maxAttempts ?? 3
  const validator = new TestValidator({
    timeout: options.timeout,
    testCommand: options.testCommand
  })

  const allAttempts: Array<{ attempt: number; validation: ValidationResult }> = []
  let feedback: GenerationFeedback | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n🤖 Generating test code (Attempt ${attempt}/${maxAttempts})...`)
    
    // 1. Generate test code
    const testCode = await generateFn(target, feedback)

    // 2. Validate
    console.log('✅ Validating generated code...')
    const testFilePath = target.path.replace(/\.(ts|tsx|js|jsx)$/i, (m: string) => `.test${m}`)
    const validation = await validator.validate(testCode, testFilePath)

    // Store attempt
    allAttempts.push({ attempt, validation })
    
    // Call callback
    if (options.onAttempt) {
      options.onAttempt(attempt, validation)
    }

    // 3. Success → return
    if (validation.success) {
      console.log(`✅ Test code validated successfully!`)
      console.log(`   Coverage: ${validation.coverage}%`)
      console.log(`   Tests pass: ${validation.testsPass}`)
      
      return {
        code: testCode,
        attempts: attempt,
        validation,
        allAttempts
      }
    }

    // 4. Failure → prepare feedback for next attempt
    console.log(`❌ Validation failed: ${validation.errors[0]}`)
    
    if (attempt < maxAttempts) {
      console.log('🔄 Retrying with error feedback...')
      feedback = {
        errors: validation.errors,
        attempt,
        buildSuccess: validation.buildSuccess,
        testsPass: validation.testsPass,
        coverage: validation.coverage
      }
    }
  }

  // All attempts failed
  const lastAttempt = allAttempts[allAttempts.length - 1]
  throw new Error(
    `Failed to generate valid tests after ${maxAttempts} attempts.\n` +
    `Last error: ${lastAttempt?.validation.errors[0] || 'Unknown error'}`
  )
}

/**
 * Build error feedback prompt
 * 
 * @param feedback - Feedback from previous attempt
 * @returns Formatted feedback text for AI
 * 
 * @internal
 */
export function buildFeedbackPrompt(feedback: GenerationFeedback): string {
  let prompt = `## ⚠️ Previous Attempt Failed (Attempt ${feedback.attempt})\n\n`

  if (!feedback.buildSuccess) {
    prompt += `**Build Errors**:\n\`\`\`\n${feedback.errors[0]}\n\`\`\`\n\n`
    prompt += `**Instructions**:\n`
    prompt += `- Fix syntax errors\n`
    prompt += `- Ensure all imports are correct\n`
    prompt += `- Check TypeScript types\n\n`
  } else if (!feedback.testsPass) {
    prompt += `**Test Failures**:\n\`\`\`\n${feedback.errors[0]}\n\`\`\`\n\n`
    prompt += `**Instructions**:\n`
    prompt += `- Fix test assertions\n`
    prompt += `- Check test setup and teardown\n`
    prompt += `- Ensure mocks are correct\n\n`
  }

  if (feedback.coverage !== undefined && feedback.coverage < 80) {
    prompt += `**Coverage**: ${feedback.coverage}% (target: 80%)\n`
    prompt += `- Add more test cases to increase coverage\n\n`
  }

  return prompt
}


