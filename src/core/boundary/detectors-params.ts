/**
 * Parameter Boundary Detection
 * @module boundary/detectors-params
 */

import type { FunctionNode, ParameterBoundary } from './types.js'

/**
 * Detect parameter type boundaries
 * 
 * Analyzes function parameters to generate test values for:
 * - Numbers: infinity, min/max safe integers, zero, NaN
 * - Strings: empty, whitespace, long, XSS attempts
 * - Arrays: empty, single, multiple, large
 * - Objects: empty, with properties, nested
 * - Booleans: true, false
 * - Functions: normal, throwing, null/undefined
 * 
 * @param functionNode - Function AST node
 * @returns Array of parameter boundaries
 * 
 * @example
 * ```typescript
 * const boundaries = detectParameterBoundaries(functionNode)
 * console.log(`Found ${boundaries.length} parameter boundaries`)
 * ```
 */
export function detectParameterBoundaries(functionNode: FunctionNode): ParameterBoundary[] {
  const boundaries: ParameterBoundary[] = []
  
  for (const param of functionNode.getParameters()) {
    try {
      const type = param.getType().getText()
      const paramName = param.getName()
      
      // Number type
      if (type.includes('number')) {
        boundaries.push({
          type: 'parameter',
          parameterName: paramName,
          parameterType: 'number',
          testValues: [
            { value: -Infinity, label: 'negative infinity' },
            { value: Number.MIN_SAFE_INTEGER, label: 'min safe integer' },
            { value: -1, label: 'negative' },
            { value: 0, label: 'zero' },
            { value: 1, label: 'positive' },
            { value: Number.MAX_SAFE_INTEGER, label: 'max safe integer' },
            { value: Infinity, label: 'positive infinity' },
            { value: NaN, label: 'NaN' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          testCases: [
            { [paramName]: -Infinity, description: 'negative infinity' },
            { [paramName]: 0, description: 'zero' },
            { [paramName]: Infinity, description: 'positive infinity' },
            { [paramName]: NaN, description: 'NaN' }
          ],
          reasoning: 'Numeric boundaries and special values (IEEE 754)',
          priority: 1
        })
      }
      
      // String type
      if (type.includes('string')) {
        boundaries.push({
          type: 'parameter',
          parameterName: paramName,
          parameterType: 'string',
          testValues: [
            { value: '', label: 'empty string' },
            { value: ' ', label: 'whitespace only' },
            { value: '  \n\t  ', label: 'mixed whitespace' },
            { value: 'a', label: 'single character' },
            { value: 'Test', label: 'normal string' },
            { value: 'a'.repeat(1000), label: 'long string (1000 chars)' },
            { value: '<script>alert("xss")</script>', label: 'potential XSS' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          testCases: [
            { [paramName]: '', description: 'empty string' },
            { [paramName]: ' ', description: 'whitespace' },
            { [paramName]: 'Test', description: 'normal' },
            { [paramName]: 'a'.repeat(1000), description: 'long string' }
          ],
          reasoning: 'String boundaries: empty, whitespace, length extremes, injection attempts',
          priority: 1
        })
      }
      
      // Array type
      if (type.includes('[]') || type.includes('Array')) {
        boundaries.push({
          type: 'parameter',
          parameterName: paramName,
          parameterType: 'array',
          testValues: [
            { value: [], label: 'empty array' },
            { value: [1], label: 'single element' },
            { value: [1, 2, 3], label: 'multiple elements' },
            { value: Array(1000).fill(0), label: 'large array (1000 elements)' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          testCases: [
            { [paramName]: [], description: 'empty array' },
            { [paramName]: [1], description: 'single element' },
            { [paramName]: [1, 2, 3], description: 'multiple elements' }
          ],
          reasoning: 'Array boundaries: empty, single, multiple, large, null/undefined',
          priority: 1
        })
      }
      
      // Object type
      if (type.includes('object') || type === '{}' || type.includes('Record')) {
        boundaries.push({
          type: 'parameter',
          parameterName: paramName,
          parameterType: 'object',
          testValues: [
            { value: {}, label: 'empty object' },
            { value: { key: 'value' }, label: 'object with properties' },
            { value: { nested: { deep: 'value' } }, label: 'nested object' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          testCases: [
            { [paramName]: {}, description: 'empty object' },
            { [paramName]: { key: 'value' }, description: 'with properties' },
            { [paramName]: null, description: 'null' }
          ],
          reasoning: 'Object boundaries: empty, with properties, nested, null/undefined',
          priority: 1
        })
      }
      
      // Boolean type
      if (type.includes('boolean')) {
        boundaries.push({
          type: 'parameter',
          parameterName: paramName,
          parameterType: 'boolean',
          testValues: [
            { value: true, label: 'true' },
            { value: false, label: 'false' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          testCases: [
            { [paramName]: true, description: 'true' },
            { [paramName]: false, description: 'false' }
          ],
          reasoning: 'Boolean values and null/undefined',
          priority: 1
        })
      }
      
      // Function type
      if (type.includes('=>') || type.includes('Function')) {
        boundaries.push({
          type: 'parameter',
          parameterName: paramName,
          parameterType: 'function',
          testValues: [
            { value: '() => {}', label: 'empty function' },
            { value: '() => "result"', label: 'function with return' },
            { value: '() => { throw new Error("test") }', label: 'throwing function' },
            { value: 'null', label: 'null' },
            { value: 'undefined', label: 'undefined' }
          ],
          testCases: [
            { [paramName]: '() => {}', description: 'normal function' },
            { [paramName]: '() => { throw new Error() }', description: 'throwing function' }
          ],
          reasoning: 'Function callbacks: normal, throwing, null/undefined',
          priority: 2
        })
      }
      
    } catch {
      // Skip parameters that can't be analyzed
      continue
    }
  }
  
  return boundaries
}

