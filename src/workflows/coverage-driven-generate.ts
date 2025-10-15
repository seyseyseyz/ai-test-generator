/**
 * Coverage-Driven Test Generation
 * 
 * Iteratively generates tests until target coverage is reached,
 * instead of using fixed iteration count.
 * 
 * Inspired by Keploy's coverage-driven approach
 * 
 * @module workflows/coverage-driven-generate
 */

import { TestValidator, type ValidationResult } from '../testing/validator.js'
import type { FunctionTarget } from '../types/index.js'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Coverage-driven generation options
 */
export interface CoverageDrivenOptions {
  targetCoverage?: number
  maxIterations?: number
  timeout?: number
  testCommand?: string
  onIteration?: (iteration: number, coverage: number, gap: number) => void
}

/**
 * Coverage iteration feedback
 */
export interface CoverageFeedback {
  currentCoverage: number
  targetCoverage: number
  gap: number
  iteration: number
  previousErrors?: string[]
}

/**
 * Coverage-driven result
 */
export interface CoverageDrivenResult {
  code: string
  coverage: number
  iterations: number
  targetReached: boolean
  allIterations: Array<{
    iteration: number
    coverage: number
    validation: ValidationResult
  }>
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate tests with coverage-driven iteration
 * 
 * Keeps generating and improving tests until target coverage is reached
 * or max iterations is hit.
 * 
 * @param target - Function to generate tests for
 * @param generateFn - Function that generates test code
 * @param options - Generation options
 * @returns Generation result with coverage info
 * 
 * @example
 * ```typescript
 * const result = await generateUntilCoverage(
 *   target,
 *   async (target, feedback) => {
 *     // Your test generation logic
 *     // Use feedback.currentCoverage and feedback.gap to improve
 *     return testCode
 *   },
 *   { targetCoverage: 80, maxIterations: 5 }
 * )
 * 
 * if (result.targetReached) {
 *   console.log(`✅ Reached ${result.coverage}% coverage in ${result.iterations} iterations`)
 * }
 * ```
 */
export async function generateUntilCoverage(
  target: FunctionTarget,
  generateFn: (target: FunctionTarget, feedback?: CoverageFeedback) => Promise<string>,
  options: CoverageDrivenOptions = {}
): Promise<CoverageDrivenResult> {
  const targetCoverage = options.targetCoverage ?? 80
  const maxIterations = options.maxIterations ?? 5
  const validator = new TestValidator({
    timeout: options.timeout,
    testCommand: options.testCommand
  })

  const allIterations: Array<{
    iteration: number
    coverage: number
    validation: ValidationResult
  }> = []

  let currentCoverage = 0
  let testCode = ''
  let feedback: CoverageFeedback | undefined

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n📊 Iteration ${iteration}/${maxIterations}`)
    console.log(`   Target: ${targetCoverage}%, Current: ${currentCoverage.toFixed(1)}%`)
    
    if (currentCoverage > 0) {
      const gap = targetCoverage - currentCoverage
      console.log(`   Gap: ${gap.toFixed(1)}%`)
    }

    // 1. Generate test code
    console.log(`\n🤖 Generating test code...`)
    testCode = await generateFn(target, feedback)

    // 2. Validate and get coverage
    console.log('✅ Running tests and measuring coverage...')
    const testFilePath = target.path.replace(/\.(ts|tsx|js|jsx)$/i, (m: string) => `.test${m}`)
    const validation = await validator.validate(testCode, testFilePath)

    currentCoverage = validation.coverage

    // Store iteration
    allIterations.push({
      iteration,
      coverage: currentCoverage,
      validation
    })

    // Call callback
    if (options.onIteration) {
      options.onIteration(iteration, currentCoverage, targetCoverage - currentCoverage)
    }

    // 3. Check if target reached
    if (currentCoverage >= targetCoverage) {
      console.log(`\n✅ Coverage target reached: ${currentCoverage.toFixed(1)}%`)
      console.log(`   Tests pass: ${validation.testsPass}`)
      console.log(`   Iterations: ${iteration}`)
      
      return {
        code: testCode,
        coverage: currentCoverage,
        iterations: iteration,
        targetReached: true,
        allIterations
      }
    }

    // 4. Prepare feedback for next iteration
    console.log(`\n📈 Coverage: ${currentCoverage.toFixed(1)}% (Gap: ${(targetCoverage - currentCoverage).toFixed(1)}%)`)
    
    if (iteration < maxIterations) {
      console.log('🔄 Continuing iteration to increase coverage...')
      feedback = {
        currentCoverage,
        targetCoverage,
        gap: targetCoverage - currentCoverage,
        iteration,
        previousErrors: validation.testsPass ? undefined : validation.errors
      }
    }
  }

  // Max iterations reached without hitting target
  console.log(`\n⚠️  Max iterations reached. Final coverage: ${currentCoverage.toFixed(1)}%`)
  console.log(`   Target: ${targetCoverage}%`)
  console.log(`   Gap: ${(targetCoverage - currentCoverage).toFixed(1)}%`)

  return {
    code: testCode,
    coverage: currentCoverage,
    iterations: maxIterations,
    targetReached: false,
    allIterations
  }
}

/**
 * Build coverage feedback prompt
 * 
 * @param feedback - Feedback from previous iteration
 * @returns Formatted feedback text for AI
 * 
 * @internal
 */
export function buildCoverageFeedbackPrompt(feedback: CoverageFeedback): string {
  let prompt = `## 📊 Coverage Progress (Iteration ${feedback.iteration})\n\n`

  prompt += `- **Target Coverage**: ${feedback.targetCoverage}%\n`
  prompt += `- **Current Coverage**: ${feedback.currentCoverage.toFixed(1)}%\n`
  prompt += `- **Gap**: ${feedback.gap.toFixed(1)}%\n`
  prompt += `- **Iteration**: ${feedback.iteration}\n\n`

  prompt += `**Instructions for Improvement**:\n`
  
  if (feedback.gap > 20) {
    prompt += `- 🎯 Large gap detected - focus on covering main code paths\n`
    prompt += `- Add tests for all major branches (if/else, switch cases)\n`
    prompt += `- Ensure all function parameters are tested with different values\n`
  } else if (feedback.gap > 10) {
    prompt += `- 🎯 Medium gap - add edge case tests\n`
    prompt += `- Test boundary conditions\n`
    prompt += `- Cover error handling paths\n`
  } else {
    prompt += `- 🎯 Small gap - add comprehensive edge cases\n`
    prompt += `- Test rare scenarios and corner cases\n`
    prompt += `- Ensure all code branches are covered\n`
  }

  if (feedback.previousErrors && feedback.previousErrors.length > 0) {
    prompt += `\n⚠️  **Previous Test Errors** (fix these first):\n`
    prompt += `\`\`\`\n${feedback.previousErrors[0]}\n\`\`\`\n`
  }

  return prompt
}

/**
 * Analyze coverage gap and suggest improvements
 * 
 * @param currentCoverage - Current coverage percentage
 * @param targetCoverage - Target coverage percentage
 * @returns Improvement suggestions
 * 
 * @example
 * ```typescript
 * const suggestions = analyzeCoverageGap(65, 80)
 * console.log(suggestions)
 * // ["Add tests for error handling paths", "Cover edge cases", ...]
 * ```
 */
export function analyzeCoverageGap(
  currentCoverage: number,
  targetCoverage: number
): string[] {
  const gap = targetCoverage - currentCoverage
  const suggestions: string[] = []

  if (gap <= 0) {
    suggestions.push('✅ Target coverage reached!')
    return suggestions
  }

  // Large gap (> 20%)
  if (gap > 20) {
    suggestions.push('🎯 Focus on main code paths and primary branches')
    suggestions.push('Add tests for all major if/else branches')
    suggestions.push('Test all function parameters with typical values')
    suggestions.push('Cover the happy path thoroughly')
  }
  // Medium gap (10-20%)
  else if (gap > 10) {
    suggestions.push('🎯 Add edge case tests')
    suggestions.push('Test boundary conditions (empty, null, max values)')
    suggestions.push('Cover error handling and exception paths')
    suggestions.push('Test less common but valid scenarios')
  }
  // Small gap (< 10%)
  else {
    suggestions.push('🎯 Add comprehensive corner cases')
    suggestions.push('Test rare but possible scenarios')
    suggestions.push('Ensure all switch cases are covered')
    suggestions.push('Test complex conditional combinations')
  }

  return suggestions
}


