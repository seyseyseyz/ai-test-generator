/**
 * Behavior 分类系统（Qodo Cover 风格）
 * 
 * 将测试场景分类为不同的行为类别，确保全面覆盖。
 * 
 * 分类类别:
 * - Happy Path: 理想和预期的用例
 * - Edge Case: 异常或极端的场景
 * - Error Path: 异常和错误处理
 * 
 * 参考:
 * - Qodo Cover Behavior-Driven Testing
 * - Google Testing Blog - Test Behaviors, Not Implementation
 * 
 * @module behavior-classifier
 */

import { SyntaxKind } from 'ts-morph'

/**
 * Behavior 类别定义
 */
export const BEHAVIOR_CATEGORIES = {
  HAPPY_PATH: {
    id: 'happy-path',
    name: 'Happy Path',
    emoji: '✅',
    description: '理想和预期的用例 - 一切正常工作的场景',
    priority: 1,
    color: '#22c55e'
  },
  EDGE_CASE: {
    id: 'edge-case',
    name: 'Edge Case',
    emoji: '⚠️',
    description: '异常或极端的场景 - 边界条件和特殊情况',
    priority: 2,
    color: '#f59e0b'
  },
  ERROR_PATH: {
    id: 'error-path',
    name: 'Error Path',
    emoji: '❌',
    description: '异常和错误处理 - 失败场景和错误恢复',
    priority: 3,
    color: '#ef4444'
  }
}

/**
 * 分类函数的 Behavior
 * @param {import('ts-morph').FunctionDeclaration} functionNode - ts-morph 函数节点
 * @param {Object} options - 分类选项
 * @returns {Array<Object>} Behavior 列表
 */
export function classifyBehaviors(functionNode, options = {}) {
  const behaviors = []
  
  try {
    // 1. Happy Path（总是有的）
    const happyPath = detectHappyPath(functionNode)
    if (happyPath) {
      behaviors.push(happyPath)
    }
    
    // 2. Edge Cases
    const edgeCases = detectEdgeCases(functionNode)
    behaviors.push(...edgeCases)
    
    // 3. Error Paths
    const errorPaths = detectErrorPaths(functionNode)
    behaviors.push(...errorPaths)
    
  } catch (error) {
    console.error(`⚠️  Behavior classification failed: ${error.message}`)
  }
  
  return behaviors
}

/**
 * 检测 Happy Path
 */
function detectHappyPath(functionNode) {
  const functionName = functionNode.getName()
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

/**
 * 检测 Edge Cases
 */
function detectEdgeCases(functionNode) {
  const edgeCases = []
  const functionName = functionNode.getName()
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
        inputs: ['0', '-1', 'Infinity', '-Infinity', 'NaN'],
        expectedOutcome: 'valid-results-or-error'
      },
      reasoning: '数值边界是常见的 bug 来源',
      exampleTest: `
it('should handle numeric edge cases', () => {
  expect(${functionName}(0)).toBeDefined()
  expect(${functionName}(-1)).toBeDefined()
  expect(${functionName}(Infinity)).toBeDefined()
})
      `.trim()
    })
  }
  
  // 4. 条件分支边界
  const ifStatements = functionNode.getDescendantsOfKind(SyntaxKind.IfStatement)
  if (ifStatements.length > 0) {
    edgeCases.push({
      category: BEHAVIOR_CATEGORIES.EDGE_CASE,
      description: `测试条件分支的边界值`,
      testCase: {
        scenario: 'conditional-boundaries',
        expectedOutcome: 'both-branches-covered'
      },
      reasoning: `函数包含 ${ifStatements.length} 个条件分支`,
      exampleTest: `
it('should cover conditional branches', () => {
  // Test boundary values that trigger different branches
  // Example: if (value > 10) { ... } else { ... }
  expect(${functionName}(10)).toBeDefined() // boundary
  expect(${functionName}(11)).toBeDefined() // just above
})
      `.trim()
    })
  }
  
  // 5. 循环边界（空、单个、多个）
  const loops = [
    ...functionNode.getDescendantsOfKind(SyntaxKind.ForStatement),
    ...functionNode.getDescendantsOfKind(SyntaxKind.WhileStatement),
    ...functionNode.getDescendantsOfKind(SyntaxKind.ForOfStatement)
  ]
  
  if (loops.length > 0) {
    edgeCases.push({
      category: BEHAVIOR_CATEGORIES.EDGE_CASE,
      description: `测试循环边界（零次、单次、多次迭代）`,
      testCase: {
        scenario: 'loop-boundaries',
        inputs: ['empty collection', 'single item', 'multiple items'],
        expectedOutcome: 'correct-iteration-behavior'
      },
      reasoning: `函数包含 ${loops.length} 个循环`,
      exampleTest: `
it('should handle different loop iterations', () => {
  expect(${functionName}([])).toBeDefined() // zero iterations
  expect(${functionName}([1])).toBeDefined() // single iteration
  expect(${functionName}([1, 2, 3])).toBeDefined() // multiple
})
      `.trim()
    })
  }
  
  return edgeCases
}

/**
 * 检测 Error Paths
 */
function detectErrorPaths(functionNode) {
  const errorPaths = []
  const functionName = functionNode.getName()
  
  // 1. Try-Catch 错误处理
  const tryStatements = functionNode.getDescendantsOfKind(SyntaxKind.TryStatement)
  if (tryStatements.length > 0) {
    errorPaths.push({
      category: BEHAVIOR_CATEGORIES.ERROR_PATH,
      description: `测试错误处理和恢复`,
      testCase: {
        scenario: 'error-handling',
        expectedOutcome: 'graceful-error-handling'
      },
      reasoning: `函数包含 ${tryStatements.length} 个 try-catch 块`,
      exampleTest: `
it('should handle errors gracefully', () => {
  // Trigger error condition
  expect(() => ${functionName}(invalidInput)).toThrow()
  // Or: expect(${functionName}(invalidInput)).rejects.toThrow()
})
      `.trim()
    })
  }
  
  // 2. Throw 语句
  const throwStatements = functionNode.getDescendantsOfKind(SyntaxKind.ThrowStatement)
  if (throwStatements.length > 0) {
    errorPaths.push({
      category: BEHAVIOR_CATEGORIES.ERROR_PATH,
      description: `测试抛出的异常`,
      testCase: {
        scenario: 'exception-throwing',
        expectedOutcome: 'correct-error-thrown'
      },
      reasoning: `函数包含 ${throwStatements.length} 个 throw 语句`,
      exampleTest: `
it('should throw appropriate errors', () => {
  expect(() => ${functionName}(invalidData))
    .toThrow('Expected error message')
})
      `.trim()
    })
  }
  
  // 3. 异步函数的拒绝（Promise reject）
  const isAsync = functionNode.isAsync()
  if (isAsync) {
    errorPaths.push({
      category: BEHAVIOR_CATEGORIES.ERROR_PATH,
      description: `测试异步操作失败`,
      testCase: {
        scenario: 'async-rejection',
        expectedOutcome: 'promise-rejection-handled'
      },
      reasoning: '异步函数需要测试失败场景',
      exampleTest: `
it('should handle async failures', async () => {
  await expect(${functionName}(invalidInput))
    .rejects.toThrow()
})
      `.trim()
    })
  }
  
  // 4. 验证失败
  if (functionName.includes('validate') || functionName.includes('check')) {
    errorPaths.push({
      category: BEHAVIOR_CATEGORIES.ERROR_PATH,
      description: `测试验证失败场景`,
      testCase: {
        scenario: 'validation-failure',
        inputs: ['invalid data', 'missing required fields'],
        expectedOutcome: 'validation-error'
      },
      reasoning: '验证函数必须测试失败场景',
      exampleTest: `
it('should reject invalid inputs', () => {
  expect(${functionName}(invalidData)).toEqual({
    valid: false,
    errors: expect.arrayContaining([expect.any(String)])
  })
})
      `.trim()
    })
  }
  
  // 5. 外部依赖失败（HTTP, DB, etc.）
  const hasExternalCalls = functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some(call => {
      const expr = call.getExpression().getText()
      return /fetch|axios|\.get\(|\.post\(|\.query\(|\.find\(/.test(expr)
    })
  
  if (hasExternalCalls) {
    errorPaths.push({
      category: BEHAVIOR_CATEGORIES.ERROR_PATH,
      description: `测试外部依赖失败`,
      testCase: {
        scenario: 'external-failure',
        expectedOutcome: 'error-handling-or-retry'
      },
      reasoning: '外部依赖可能失败，需要测试错误处理',
      exampleTest: `
it('should handle external service failures', async () => {
  // Mock external service to fail
  mockService.get.mockRejectedValue(new Error('Service unavailable'))
  
  await expect(${functionName}()).rejects.toThrow('Service unavailable')
  // Or test retry logic, fallback, etc.
})
      `.trim()
    })
  }
  
  return errorPaths
}

/**
 * 生成 Happy Path 测试示例
 */
function generateHappyPathExample(functionName, params) {
  const paramList = params.map(p => {
    const name = p.getName()
    const type = p.getType().getText()
    
    // 根据类型生成合理的测试值
    if (type.includes('string')) return `'validString'`
    if (type.includes('number')) return `42`
    if (type.includes('boolean')) return `true`
    if (type.includes('[]') || type.includes('Array')) return `[1, 2, 3]`
    if (type.includes('object') || type === '{}') return `{ key: 'value' }`
    return `validInput`
  }).join(', ')
  
  return `
it('should work correctly with valid inputs (Happy Path)', () => {
  const result = ${functionName}(${paramList})
  
  expect(result).toBeDefined()
  expect(result).not.toBeNull()
  // Add specific assertions based on expected behavior
})
  `.trim()
}

/**
 * 格式化 Behaviors 为 Prompt 文本
 * @param {Array} behaviors - Behavior 列表
 * @returns {string} 格式化的文本
 */
export function formatBehaviorsForPrompt(behaviors) {
  if (behaviors.length === 0) {
    return '- No specific behaviors identified\n'
  }
  
  let text = '**Test Behaviors** (Qodo Cover style):\n\n'
  
  // 按类别分组
  const byCategory = {
    [BEHAVIOR_CATEGORIES.HAPPY_PATH.id]: [],
    [BEHAVIOR_CATEGORIES.EDGE_CASE.id]: [],
    [BEHAVIOR_CATEGORIES.ERROR_PATH.id]: []
  }
  
  for (const behavior of behaviors) {
    byCategory[behavior.category.id].push(behavior)
  }
  
  // Happy Path
  if (byCategory['happy-path'].length > 0) {
    text += `### ${BEHAVIOR_CATEGORIES.HAPPY_PATH.emoji} ${BEHAVIOR_CATEGORIES.HAPPY_PATH.name}\n`
    text += `*${BEHAVIOR_CATEGORIES.HAPPY_PATH.description}*\n\n`
    
    for (const b of byCategory['happy-path']) {
      text += `- **${b.description}**\n`
      text += `  - Scenario: ${b.testCase.scenario}\n`
      text += `  - Expected: ${b.testCase.expectedOutcome}\n`
    }
    text += '\n'
  }
  
  // Edge Cases
  if (byCategory['edge-case'].length > 0) {
    text += `### ${BEHAVIOR_CATEGORIES.EDGE_CASE.emoji} ${BEHAVIOR_CATEGORIES.EDGE_CASE.name}\n`
    text += `*${BEHAVIOR_CATEGORIES.EDGE_CASE.description}*\n\n`
    
    for (const b of byCategory['edge-case']) {
      text += `- **${b.description}**\n`
      text += `  - ${b.reasoning}\n`
    }
    text += '\n'
  }
  
  // Error Paths
  if (byCategory['error-path'].length > 0) {
    text += `### ${BEHAVIOR_CATEGORIES.ERROR_PATH.emoji} ${BEHAVIOR_CATEGORIES.ERROR_PATH.name}\n`
    text += `*${BEHAVIOR_CATEGORIES.ERROR_PATH.description}*\n\n`
    
    for (const b of byCategory['error-path']) {
      text += `- **${b.description}**\n`
      text += `  - ${b.reasoning}\n`
    }
    text += '\n'
  }
  
  text += `**Testing Priority**: Happy Path (critical) → Edge Cases (important) → Error Paths (complete coverage)\n`
  
  return text
}

/**
 * 获取 Behavior 统计信息
 * @param {Array} behaviors - Behavior 列表
 * @returns {Object} 统计信息
 */
export function getBehaviorStats(behaviors) {
  const stats = {
    total: behaviors.length,
    byCategory: {
      'happy-path': 0,
      'edge-case': 0,
      'error-path': 0
    },
    hasTryCatch: false,
    hasAsyncErrors: false,
    hasValidation: false
  }
  
  for (const behavior of behaviors) {
    stats.byCategory[behavior.category.id]++
    
    if (behavior.testCase?.scenario === 'error-handling') {
      stats.hasTryCatch = true
    }
    if (behavior.testCase?.scenario === 'async-rejection') {
      stats.hasAsyncErrors = true
    }
    if (behavior.testCase?.scenario === 'validation-failure') {
      stats.hasValidation = true
    }
  }
  
  return stats
}

/**
 * 生成测试计划
 * @param {Array} behaviors - Behavior 列表
 * @returns {Object} 测试计划
 */
export function generateTestPlan(behaviors) {
  const plan = {
    totalTests: behaviors.length,
    criticalTests: [],
    importantTests: [],
    optionalTests: []
  }
  
  for (const behavior of behaviors) {
    const testItem = {
      description: behavior.description,
      category: behavior.category.name,
      scenario: behavior.testCase?.scenario,
      example: behavior.exampleTest
    }
    
    if (behavior.category.id === 'happy-path') {
      plan.criticalTests.push(testItem)
    } else if (behavior.category.id === 'edge-case') {
      plan.importantTests.push(testItem)
    } else if (behavior.category.id === 'error-path') {
      plan.optionalTests.push(testItem)
    }
  }
  
  return plan
}

