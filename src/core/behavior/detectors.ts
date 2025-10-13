/**
 * Behavior Detection Logic
 * @module behavior/detectors
 */

import { SyntaxKind, type ParameterDeclaration } from 'ts-morph'
import { BEHAVIOR_CATEGORIES, type Behavior, type FunctionNode } from './types.js'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get function name from AST node
 */
export function getFunctionName(functionNode: FunctionNode): string {
  if ('getName' in functionNode && typeof functionNode.getName === 'function') {
    return functionNode.getName() || 'anonymous'
  }
  return 'anonymous'
}

/**
 * Generate happy path example test code
 */
export function generateHappyPathExample(functionName: string, params: ParameterDeclaration[]): string {
  const paramList = Array.isArray(params) ? params.map((p: ParameterDeclaration) => p.getName()).join(', ') : ''
  
  return `
it('should work with valid inputs', () => {
  const result = ${functionName}(${paramList || 'validInput'})
  expect(result).toBeDefined()
  // Add more specific assertions based on expected return value
})
  `.trim()
}

// ============================================================================
// Happy Path Detection
// ============================================================================

/**
 * Detect Happy Path behavior
 */
export function detectHappyPath(functionNode: FunctionNode): Behavior | null {
  const functionName = getFunctionName(functionNode)
  const params = functionNode.getParameters()
  
  // 构建 Happy Path 描述
  let description = `${functionName} 使用有效输入正常执行`
  
  // 根据函数类型优化描述
  if (functionName.startsWith('validate')) {
    description = `验证通过：所有字段有效`
  } else if (functionName.startsWith('calculate') || functionName.startsWith('compute')) {
    description = `计算成功：返回正确结果`
  } else if (functionName.startsWith('fetch') || functionName.startsWith('get')) {
    description = `成功获取数据`
  } else if (functionName.startsWith('create') || functionName.startsWith('save')) {
    description = `成功创建/保存`
  } else if (functionName.startsWith('update')) {
    description = `成功更新`
  } else if (functionName.startsWith('delete') || functionName.startsWith('remove')) {
    description = `成功删除`
  }
  
  return {
    category: BEHAVIOR_CATEGORIES.HAPPY_PATH,
    description,
    testCase: {
      scenario: 'valid-inputs',
      expectedOutcome: 'success',
      importance: 'critical'
    },
    reasoning: '基础功能测试 - 确保正常路径工作',
    exampleTest: generateHappyPathExample(functionName, params)
  }
}

// ============================================================================
// Edge Cases Detection
// ============================================================================

/**
 * Detect Edge Cases behaviors
 */
export function detectEdgeCases(functionNode: FunctionNode): Behavior[] {
  const edgeCases: Behavior[] = []
  const functionName = getFunctionName(functionNode)
  const params = functionNode.getParameters()
  
  // 1. 空值/null/undefined 参数
  if (params.length > 0) {
    edgeCases.push({
      category: BEHAVIOR_CATEGORIES.EDGE_CASE,
      description: `处理 null/undefined 输入`,
      testCase: {
        scenario: 'null-undefined-inputs',
        inputs: params.map(p => ({ name: p.getName(), value: 'null | undefined' })),
        expectedOutcome: 'graceful-handling'
      },
      reasoning: 'null/undefined 是最常见的边界情况',
      exampleTest: `
it('should handle null/undefined inputs gracefully', () => {
  expect(${functionName}(null)).toBeDefined() // or throw expected error
  expect(${functionName}(undefined)).toBeDefined()
})
      `.trim()
    })
  }
  
  // 2. 空数组/空字符串
  const hasArrayParams = params.some(p => {
    try {
      const type = p.getType().getText()
      return type.includes('[]') || type.includes('Array')
    } catch {
      return false
    }
  })
  
  const hasStringParams = params.some(p => {
    try {
      const type = p.getType().getText()
      return type.includes('string')
    } catch {
      return false
    }
  })
  
  if (hasArrayParams || hasStringParams) {
    edgeCases.push({
      category: BEHAVIOR_CATEGORIES.EDGE_CASE,
      description: `处理空数组/空字符串`,
      testCase: {
        scenario: 'empty-inputs',
        expectedOutcome: 'appropriate-default-behavior'
      },
      reasoning: '空集合是常见的边界情况',
      exampleTest: `
it('should handle empty inputs', () => {
  ${hasArrayParams ? `expect(${functionName}([])).toBeDefined()` : ''}
  ${hasStringParams ? `expect(${functionName}('')).toBeDefined()` : ''}
})
      `.trim()
    })
  }
  
  // 3. 数值边界
  const hasNumberParams = params.some(p => {
    try {
      const type = p.getType().getText()
      return type.includes('number')
    } catch {
      return false
    }
  })
  
  if (hasNumberParams) {
    edgeCases.push({
      category: BEHAVIOR_CATEGORIES.EDGE_CASE,
      description: `处理数值边界（0, 负数, Infinity, NaN）`,
      testCase: {
        scenario: 'numeric-boundaries',
        expectedOutcome: 'handle-special-values'
      },
      reasoning: '数值特殊值常导致边界错误',
      exampleTest: `
it('should handle numeric boundaries', () => {
  expect(${functionName}(0)).toBeDefined()
  expect(${functionName}(-1)).toBeDefined()
  expect(${functionName}(Infinity)).toBeDefined()
  expect(${functionName}(NaN)).toBeDefined()
})
      `.trim()
    })
  }
  
  // 4. 大数据集
  if (hasArrayParams) {
    edgeCases.push({
      category: BEHAVIOR_CATEGORIES.EDGE_CASE,
      description: `处理大数据集（性能测试）`,
      testCase: {
        scenario: 'large-dataset',
        expectedOutcome: 'performant-handling'
      },
      reasoning: '确保大数据集不会导致性能问题',
      exampleTest: `
it('should handle large datasets efficiently', () => {
  const largeArray = Array(10000).fill(0).map((_, i) => i)
  const startTime = Date.now()
  ${functionName}(largeArray)
  const duration = Date.now() - startTime
  expect(duration).toBeLessThan(1000) // Should complete within 1s
})
      `.trim()
    })
  }
  
  // 5. 特殊字符（字符串参数）
  if (hasStringParams) {
    edgeCases.push({
      category: BEHAVIOR_CATEGORIES.EDGE_CASE,
      description: `处理特殊字符和 Unicode`,
      testCase: {
        scenario: 'special-characters',
        expectedOutcome: 'proper-encoding'
      },
      reasoning: '特殊字符可能导致编码问题',
      exampleTest: `
it('should handle special characters', () => {
  expect(${functionName}('!@#$%^&*()')).toBeDefined()
  expect(${functionName}('你好世界')).toBeDefined()
  expect(${functionName}('emoji: 🚀')).toBeDefined()
})
      `.trim()
    })
  }
  
  return edgeCases
}

// ============================================================================
// Error Paths Detection
// ============================================================================

/**
 * Detect Error Paths behaviors
 */
export function detectErrorPaths(functionNode: FunctionNode): Behavior[] {
  const errorPaths: Behavior[] = []
  const functionName = getFunctionName(functionNode)
  
  try {
    // 1. 检测 throw 语句
    const throwStatements = functionNode.getDescendantsOfKind(SyntaxKind.ThrowStatement)
    if (throwStatements.length > 0) {
      errorPaths.push({
        category: BEHAVIOR_CATEGORIES.ERROR_PATH,
        description: `验证错误抛出机制`,
        testCase: {
          scenario: 'error-throwing',
          expectedOutcome: 'throw-appropriate-error'
        },
        reasoning: `函数包含 ${throwStatements.length} 个 throw 语句`,
        exampleTest: `
it('should throw errors for invalid inputs', () => {
  expect(() => ${functionName}(invalidInput)).toThrow()
})
        `.trim()
      })
    }
    
    // 2. 检测 try-catch 块
    const tryCatchBlocks = functionNode.getDescendantsOfKind(SyntaxKind.TryStatement)
    if (tryCatchBlocks.length > 0) {
      errorPaths.push({
        category: BEHAVIOR_CATEGORIES.ERROR_PATH,
        description: `测试错误处理和恢复`,
        testCase: {
          scenario: 'error-recovery',
          expectedOutcome: 'graceful-error-handling'
        },
        reasoning: `函数包含 ${tryCatchBlocks.length} 个 try-catch 块`,
        exampleTest: `
it('should handle and recover from errors', () => {
  // Test that errors are caught and handled gracefully
  expect(() => ${functionName}(errorProneInput)).not.toThrow()
})
        `.trim()
      })
    }
    
    // 3. 检测类型验证（TypeScript guards）
    const typeGuards = functionNode.getDescendantsOfKind(SyntaxKind.TypeOfExpression)
    if (typeGuards.length > 0) {
      errorPaths.push({
        category: BEHAVIOR_CATEGORIES.ERROR_PATH,
        description: `测试类型验证逻辑`,
        testCase: {
          scenario: 'type-validation',
          expectedOutcome: 'reject-invalid-types'
        },
        reasoning: '函数包含类型检查逻辑',
        exampleTest: `
it('should validate input types', () => {
  expect(() => ${functionName}('wrong type')).toThrow(TypeError)
})
        `.trim()
      })
    }
    
    // 4. 检测条件验证（if checks）
    const ifStatements = functionNode.getDescendantsOfKind(SyntaxKind.IfStatement)
    const validationChecks = ifStatements.filter(stmt => {
      const condition = stmt.getExpression().getText()
      return condition.includes('!') || condition.includes('===') || condition.includes('!==')
    })
    
    if (validationChecks.length > 2) {
      errorPaths.push({
        category: BEHAVIOR_CATEGORIES.ERROR_PATH,
        description: `测试输入验证逻辑`,
        testCase: {
          scenario: 'input-validation',
          expectedOutcome: 'reject-invalid-inputs'
        },
        reasoning: `函数包含 ${validationChecks.length} 个验证检查`,
        exampleTest: `
it('should validate all input conditions', () => {
  // Test each validation check
  expect(${functionName}(invalidCase1)).toMatch(/error|invalid|fail/)
})
        `.trim()
      })
    }
    
    // 5. 检测异步错误
    const awaitExpressions = functionNode.getDescendantsOfKind(SyntaxKind.AwaitExpression)
    if (awaitExpressions.length > 0) {
      errorPaths.push({
        category: BEHAVIOR_CATEGORIES.ERROR_PATH,
        description: `测试异步错误处理`,
        testCase: {
          scenario: 'async-errors',
          expectedOutcome: 'handle-promise-rejection'
        },
        reasoning: '函数包含异步操作',
        exampleTest: `
it('should handle async errors', async () => {
  await expect(${functionName}(failingAsync)).rejects.toThrow()
})
        `.trim()
      })
    }
    
  } catch {
    // Skip if AST analysis fails
  }
  
  return errorPaths
}

