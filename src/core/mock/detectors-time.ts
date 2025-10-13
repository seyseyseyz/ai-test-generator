/**
 * Time and Random Mock Detection
 * @module mock/detectors-time
 */

import type { MockRequirement } from './types.js'

/**
 * Analyze time-related call
 * 
 * @param callee - Function call expression
 * @returns Mock requirement
 */
export function analyzeTimeCall(callee: string): MockRequirement {
  return {
    type: 'Timer',
    mockStrategy: 'jest.useFakeTimers()',
    reason: `Function uses ${callee} - requires time mocking`,
    setupExample: `
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})
    `.trim(),
    testExample: `
it('should handle timer', () => {
  functionUnderTest()
  jest.advanceTimersByTime(1000)
  expect(callback).toHaveBeenCalled()
})
    `.trim(),
    priority: 2
  }
}

/**
 * Analyze Math.random call
 * 
 * @param callee - Function call expression
 * @returns Mock requirement
 */
export function analyzeRandomCall(_callee: string): MockRequirement {
  return {
    type: 'Random',
    mockStrategy: 'jest.spyOn(Math, "random")',
    reason: 'Function uses Math.random - requires deterministic mocking',
    setupExample: `
let randomSpy: jest.SpyInstance

beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  randomSpy.mockRestore()
})
    `.trim(),
    testExample: `
it('should produce deterministic results', () => {
  const result = functionUnderTest()
  expect(result).toBe(expectedValue)
})
    `.trim(),
    priority: 2
  }
}

