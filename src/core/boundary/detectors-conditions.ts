/**
 * Condition Boundary Detection
 * @module boundary/detectors-conditions
 */

import { SyntaxKind } from 'ts-morph'
import type { ConditionBoundary, FunctionNode, TestCase } from './types.js'

/**
 * Detect condition boundaries
 * 
 * Analyzes if-statements to generate boundary test cases.
 * Supports:
 * - Numeric comparisons (>, >=, <, <=)
 * - Equality checks (===, !==)
 * - Length checks (.length)
 * - Truthy/falsy conditions
 * 
 * @param functionNode - Function AST node
 * @returns Array of condition boundaries
 * 
 * @example
 * ```typescript
 * const boundaries = detectConditionBoundaries(functionNode)
 * console.log(`Found ${boundaries.length} condition boundaries`)
 * ```
 */
export function detectConditionBoundaries(functionNode: FunctionNode): ConditionBoundary[] {
  const boundaries: ConditionBoundary[] = []
  
  const ifStatements = functionNode.getDescendantsOfKind(SyntaxKind.IfStatement)
  
  for (const ifStmt of ifStatements) {
    try {
      const condition = ifStmt.getExpression().getText()
      const testCases = extractConditionBoundaries(condition)
      
      if (testCases.length > 0) {
        boundaries.push({
          type: 'if-statement',
          condition,
          testCases,
          reasoning: `Testing boundary values for condition: ${condition}`,
          priority: 1
        })
      }
    } catch {
      continue
    }
  }
  
  return boundaries
}

/**
 * Extract boundary test cases from condition expression
 * 
 * @param condition - Condition expression string
 * @returns Array of test cases
 * 
 * @internal
 */
export function extractConditionBoundaries(condition: string): TestCase[] {
  const testCases: TestCase[] = []
  
  // Numeric comparisons: x > 10, x >= 10, x < 10, x <= 10
  const numMatch = condition.match(/(\w+)\s*([><]=?)\s*(-?\d+(?:\.\d+)?)/)
  if (numMatch) {
    const [, variable, operator, value] = numMatch
    const num = parseFloat(value!)
    
    if (operator === '>') {
      testCases.push(
        { [variable!]: num, expected: false, description: `boundary (${variable} = ${num}, should be false)` },
        { [variable!]: num + 1, expected: true, description: `just above boundary (${variable} = ${num + 1}, should be true)` }
      )
    } else if (operator === '>=') {
      testCases.push(
        { [variable!]: num - 1, expected: false, description: `just below (${variable} = ${num - 1}, should be false)` },
        { [variable!]: num, expected: true, description: `boundary (${variable} = ${num}, should be true)` }
      )
    } else if (operator === '<') {
      testCases.push(
        { [variable!]: num - 1, expected: true, description: `just below (${variable} = ${num - 1}, should be true)` },
        { [variable!]: num, expected: false, description: `boundary (${variable} = ${num}, should be false)` }
      )
    } else if (operator === '<=') {
      testCases.push(
        { [variable!]: num, expected: true, description: `boundary (${variable} = ${num}, should be true)` },
        { [variable!]: num + 1, expected: false, description: `just above (${variable} = ${num + 1}, should be false)` }
      )
    }
  }
  
  // Equality comparisons: x === 'foo', x !== 'bar'
  const eqMatch = condition.match(/(\w+)\s*(===|!==)\s*['"]([^'"]+)['"]/)
  if (eqMatch) {
    const [, variable, operator, value] = eqMatch
    const expectedMatch = operator === '==='
    
    testCases.push(
      { [variable!]: value, expected: expectedMatch, description: `matching value (${variable} = '${value}')` },
      { [variable!]: 'other', expected: !expectedMatch, description: `non-matching value (${variable} = 'other')` },
      { [variable!]: '', expected: !expectedMatch, description: `empty string (${variable} = '')` },
      { [variable!]: null, expected: false, description: `null (${variable} = null)` }
    )
  }
  
  // Length checks: arr.length > 0, str.length === 5
  const lengthMatch = condition.match(/(\w+)\.length\s*([><]=?|===|!==)\s*(\d+)/)
  if (lengthMatch) {
    const [, variable, operator, value] = lengthMatch
    const num = parseInt(value!)
    
    if (operator === '>' && num === 0) {
      testCases.push(
        { [variable!]: '[]', expected: false, description: `empty (${variable}.length = 0)` },
        { [variable!]: '[1]', expected: true, description: `non-empty (${variable}.length = 1)` }
      )
    } else if (operator === '===') {
      testCases.push(
        { [variable!]: `Array(${num - 1})`, expected: false, description: `length ${num - 1}` },
        { [variable!]: `Array(${num})`, expected: true, description: `length ${num}` },
        { [variable!]: `Array(${num + 1})`, expected: false, description: `length ${num + 1}` }
      )
    }
  }
  
  // Truthy/Falsy checks: if (x), if (!x)
  const truthyMatch = condition.match(/^!?(\w+)$/)
  if (truthyMatch) {
    const [fullMatch, variable] = truthyMatch
    const isNegated = fullMatch!.startsWith('!')
    
    testCases.push(
      { [variable!]: true, expected: !isNegated, description: 'truthy: true' },
      { [variable!]: false, expected: isNegated, description: 'falsy: false' },
      { [variable!]: 0, expected: isNegated, description: 'falsy: 0' },
      { [variable!]: '""', expected: isNegated, description: 'falsy: empty string' },
      { [variable!]: null, expected: isNegated, description: 'falsy: null' },
      { [variable!]: undefined, expected: isNegated, description: 'falsy: undefined' }
    )
  }
  
  return testCases
}

