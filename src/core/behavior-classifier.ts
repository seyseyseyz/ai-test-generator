/**
 * Behavior 分类系统
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

import { type ArrowFunction, SyntaxKind, type FunctionDeclaration, type FunctionExpression, type ParameterDeclaration } from 'ts-morph'

// ============================================================================
// Type Definitions
// ============================================================================

/** Behavior category definition */
export interface BehaviorCategory {
  id: string
  name: string
  emoji: string
  description: string
  priority: number
  color: string
}

/** Test case specification for behavior */
export interface BehaviorTestCase {
  scenario: string
  inputs?: Array<{ name: string; value: string }>
  expectedOutcome: string
  importance?: string
}

/** Behavior classification result */
export interface Behavior {
  category: BehaviorCategory
  description: string
  testCase: BehaviorTestCase
  reasoning: string
  exampleTest: string
}

/** Classification options */
export interface ClassifyOptions {
  includeExamples?: boolean
  verbosity?: 'minimal' | 'normal' | 'verbose'
}

/** Behavior statistics */
export interface BehaviorStats {
  total: number
  byCategory: Record<string, number>
  byImportance: {
    critical: number
    important: number
    optional: number
  }
}

/** Test plan */
export interface TestPlan {
  totalTests: number
  estimatedTime: string
  coverage: {
    happyPath: number
    edgeCases: number
    errorPaths: number
  }
  recommendations: string[]
}

/** Function node type from ts-morph */
type FunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression

// ============================================================================
// Constants
// ============================================================================

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
  } as BehaviorCategory,
  EDGE_CASE: {
    id: 'edge-case',
    name: 'Edge Case',
    emoji: '⚠️',
    description: '异常或极端的场景 - 边界条件和特殊情况',
    priority: 2,
    color: '#f59e0b'
  } as BehaviorCategory,
  ERROR_PATH: {
    id: 'error-path',
    name: 'Error Path',
    emoji: '❌',
    description: '异常和错误处理 - 失败场景和错误恢复',
    priority: 3,
    color: '#ef4444'
  } as BehaviorCategory
} as const

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * 分类函数的 Behavior
 * @param functionNode - ts-morph 函数节点
 * @param options - 分类选项
 * @returns Behavior 列表
 */
export function classifyBehaviors(
  functionNode: FunctionNode,
  _options: ClassifyOptions = {}
): Behavior[] {
  const behaviors: Behavior[] = []
  
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
    const message = error instanceof Error ? error.message : String(error)
    console.error(`⚠️  Behavior classification failed: ${message}`)
  }
  
  return behaviors
}

// ============================================================================
// Happy Path Detection
// ============================================================================

/**
 * 获取函数名称（兼容所有函数节点类型）
 */
function getFunctionName(functionNode: FunctionNode): string {
  if ('getName' in functionNode && typeof functionNode.getName === 'function') {
    return functionNode.getName() || 'anonymous'
  }
  return 'anonymous'
}

/**
 * 检测 Happy Path
 */
function detectHappyPath(functionNode: FunctionNode): Behavior | null {
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
 * 检测 Edge Cases
 */
function detectEdgeCases(functionNode: FunctionNode): Behavior[] {
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
 * 检测 Error Paths
 */
function detectErrorPaths(functionNode: FunctionNode): Behavior[] {
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 生成 Happy Path 示例测试
 */
function generateHappyPathExample(functionName: string, params: ParameterDeclaration[]): string {
  const paramList = Array.isArray(params) ? params.map((p: ParameterDeclaration) => p.getName()).join(', ') : ''
  const hasParams = params.length > 0
  
  return `
it('should work correctly with valid inputs', () => {
  ${hasParams ? `const result = ${functionName}(${paramList})` : `const result = ${functionName}()`}
  expect(result).toBeDefined()
  // Add specific assertions based on expected return value
})
  `.trim()
}

/**
 * 格式化 Behaviors 为 Prompt 文本
 */
export function formatBehaviorsForPrompt(behaviors: Behavior[]): string {
  if (behaviors.length === 0) {
    return '- No behaviors detected\n'
  }
  
  let text = ''
  
  // 按类别分组
  const byCategory: Partial<Record<string, Behavior[]>> = {}
  for (const behavior of behaviors) {
    const categoryId = behavior.category.id
    if (!byCategory[categoryId]) byCategory[categoryId] = []
    byCategory[categoryId]!.push(behavior)
  }
  
  // Happy Path
  if (byCategory['happy-path']) {
    text += `**${BEHAVIOR_CATEGORIES.HAPPY_PATH.emoji} ${BEHAVIOR_CATEGORIES.HAPPY_PATH.name}**:\n`
    for (const b of byCategory['happy-path']) {
      text += `- ${b.description}\n`
      text += `  Reasoning: ${b.reasoning}\n`
    }
    text += '\n'
  }
  
  // Edge Cases
  if (byCategory['edge-case']) {
    text += `**${BEHAVIOR_CATEGORIES.EDGE_CASE.emoji} ${BEHAVIOR_CATEGORIES.EDGE_CASE.name}**:\n`
    for (const b of byCategory['edge-case']) {
      text += `- ${b.description}\n`
    }
    text += '\n'
  }
  
  // Error Paths
  if (byCategory['error-path']) {
    text += `**${BEHAVIOR_CATEGORIES.ERROR_PATH.emoji} ${BEHAVIOR_CATEGORIES.ERROR_PATH.name}**:\n`
    for (const b of byCategory['error-path']) {
      text += `- ${b.description}\n`
    }
    text += '\n'
  }
  
  return text
}

/**
 * 获取 Behavior 统计信息
 */
export function getBehaviorStats(behaviors: Behavior[]): BehaviorStats {
  const stats: BehaviorStats = {
    total: behaviors.length,
    byCategory: {},
    byImportance: {
      critical: 0,
      important: 0,
      optional: 0
    }
  }
  
  for (const behavior of behaviors) {
    // 按类别统计
    const categoryId = behavior.category.id
    stats.byCategory[categoryId] = (stats.byCategory[categoryId] || 0) + 1
    
    // 按重要性统计
    const importance = behavior.testCase.importance
    if (importance === 'critical') {
      stats.byImportance.critical++
    } else if (importance === 'important') {
      stats.byImportance.important++
    } else {
      stats.byImportance.optional++
    }
  }
  
  return stats
}

/**
 * 生成测试计划
 */
export function generateTestPlan(behaviors: Behavior[]): TestPlan {
  const stats = getBehaviorStats(behaviors)
  
  const happyPathCount = stats.byCategory['happy-path'] || 0
  const edgeCaseCount = stats.byCategory['edge-case'] || 0
  const errorPathCount = stats.byCategory['error-path'] || 0
  
  const totalTests = behaviors.length
  const estimatedMinutes = totalTests * 3 // 每个测试估计3分钟
  const estimatedTime = estimatedMinutes < 60
    ? `${estimatedMinutes} 分钟`
    : `${Math.ceil(estimatedMinutes / 60)} 小时`
  
  const recommendations: string[] = []
  
  if (happyPathCount === 0) {
    recommendations.push('⚠️  缺少 Happy Path 测试 - 建议添加基础功能测试')
  }
  
  if (edgeCaseCount === 0) {
    recommendations.push('⚠️  缺少 Edge Case 测试 - 建议添加边界条件测试')
  }
  
  if (errorPathCount === 0) {
    recommendations.push('💡 建议添加错误处理测试')
  }
  
  if (totalTests < 3) {
    recommendations.push('💡 测试覆盖较少 - 建议增加更多测试场景')
  }
  
  return {
    totalTests,
    estimatedTime,
    coverage: {
      happyPath: happyPathCount,
      edgeCases: edgeCaseCount,
      errorPaths: errorPathCount
    },
    recommendations
  }
}
