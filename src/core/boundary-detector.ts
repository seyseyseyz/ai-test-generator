/**
 * 边界条件检测器
 * 
 * 自动识别函数参数类型和条件分支的边界值，生成全面的测试用例。
 * 
 * 参考:
 * - Keploy ut-gen: https://github.com/keploy/keploy/blob/main/README-UnitGen.md
 * - IEEE 754 浮点数标准
 * 
 * @module boundary-detector
 */

import { type ArrowFunction, type FunctionDeclaration, type FunctionExpression, SyntaxKind } from 'ts-morph'

// ============================================================================
// Type Definitions
// ============================================================================

/** Test value with label */
export interface TestValue {
  value: unknown
  label: string
}

/** Test case for condition boundaries */
export interface TestCase {
  [variable: string]: unknown
  expected?: boolean | unknown
  description: string
}

/** Parameter boundary detection result */
export interface ParameterBoundary {
  category: 'parameter'
  param: string
  type: string
  testValues: TestValue[]
  reasoning: string
  priority: number
}

/** Condition boundary detection result */
export interface ConditionBoundary {
  category: 'condition'
  type: 'if-statement'
  condition: string
  testCases: TestCase[]
  reasoning: string
  priority: number
}

/** Loop boundary detection result */
export interface LoopBoundary {
  category: 'loop'
  reasoning: string
  testCases: TestCase[]
}

/** Access boundary detection result */
export interface AccessBoundary {
  category: 'access'
  reasoning: string
}

/** Union type for all boundary types */
export type BoundaryValue = ParameterBoundary | ConditionBoundary | LoopBoundary | AccessBoundary

/** Function node type from ts-morph */
type FunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression

/** Grouped boundaries by category */
export type BoundaryGroup = {
  [K in BoundaryValue['category']]?: Extract<BoundaryValue, { category: K }>[]
}

/** Boundary statistics */
export interface BoundaryStats {
  total: number
  byCategory: Record<string, number>
  byPriority: {
    high: number
    medium: number
    low: number
  }
  totalTestCases: number
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * 检测函数的边界条件
 * @param functionNode - ts-morph 函数节点
 * @returns 边界条件列表
 */
export function detectBoundaries(functionNode: FunctionNode): BoundaryValue[] {
  const boundaries: BoundaryValue[] = []
  
  try {
    // 1. 参数类型边界
    const paramBoundaries = detectParameterBoundaries(functionNode)
    boundaries.push(...paramBoundaries)
    
    // 2. 条件分支边界
    const conditionBoundaries = detectConditionBoundaries(functionNode)
    boundaries.push(...conditionBoundaries)
    
    // 3. 循环边界
    const loopBoundaries = detectLoopBoundaries(functionNode)
    boundaries.push(...loopBoundaries)
    
    // 4. 数组/对象访问边界
    const accessBoundaries = detectAccessBoundaries(functionNode)
    boundaries.push(...accessBoundaries)
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`⚠️  Boundary detection failed: ${message}`)
  }
  
  return boundaries
}

// ============================================================================
// Parameter Boundaries Detection
// ============================================================================

/**
 * 检测参数类型边界
 */
function detectParameterBoundaries(functionNode: FunctionNode): ParameterBoundary[] {
  const boundaries: ParameterBoundary[] = []
  
  for (const param of functionNode.getParameters()) {
    try {
      const type = param.getType().getText()
      const paramName = param.getName()
      
      // Number 类型
      if (type.includes('number')) {
        boundaries.push({
          category: 'parameter',
          param: paramName,
          type: 'number',
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
          reasoning: 'Numeric boundaries and special values (IEEE 754)',
          priority: 1
        })
      }
      
      // String 类型
      if (type.includes('string')) {
        boundaries.push({
          category: 'parameter',
          param: paramName,
          type: 'string',
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
          reasoning: 'String boundaries: empty, whitespace, length extremes, injection attempts',
          priority: 1
        })
      }
      
      // Array 类型
      if (type.includes('[]') || type.includes('Array')) {
        boundaries.push({
          category: 'parameter',
          param: paramName,
          type: 'array',
          testValues: [
            { value: [], label: 'empty array' },
            { value: [1], label: 'single element' },
            { value: [1, 2, 3], label: 'multiple elements' },
            { value: Array(1000).fill(0), label: 'large array (1000 elements)' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          reasoning: 'Array boundaries: empty, single, multiple, large, null/undefined',
          priority: 1
        })
      }
      
      // Object 类型
      if (type.includes('object') || type === '{}' || type.includes('Record')) {
        boundaries.push({
          category: 'parameter',
          param: paramName,
          type: 'object',
          testValues: [
            { value: {}, label: 'empty object' },
            { value: { key: 'value' }, label: 'object with properties' },
            { value: { nested: { deep: 'value' } }, label: 'nested object' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          reasoning: 'Object boundaries: empty, with properties, nested, null/undefined',
          priority: 1
        })
      }
      
      // Boolean 类型
      if (type.includes('boolean')) {
        boundaries.push({
          category: 'parameter',
          param: paramName,
          type: 'boolean',
          testValues: [
            { value: true, label: 'true' },
            { value: false, label: 'false' },
            { value: null, label: 'null' },
            { value: undefined, label: 'undefined' }
          ],
          reasoning: 'Boolean values and null/undefined',
          priority: 1
        })
      }
      
      // Function 类型
      if (type.includes('=>') || type.includes('Function')) {
        boundaries.push({
          category: 'parameter',
          param: paramName,
          type: 'function',
          testValues: [
            { value: '() => {}', label: 'empty function' },
            { value: '() => "result"', label: 'function with return' },
            { value: '() => { throw new Error("test") }', label: 'throwing function' },
            { value: 'null', label: 'null' },
            { value: 'undefined', label: 'undefined' }
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

// ============================================================================
// Condition Boundaries Detection
// ============================================================================

/**
 * 检测条件分支边界
 */
function detectConditionBoundaries(functionNode: FunctionNode): ConditionBoundary[] {
  const boundaries: ConditionBoundary[] = []
  
  const ifStatements = functionNode.getDescendantsOfKind(SyntaxKind.IfStatement)
  
  for (const ifStmt of ifStatements) {
    try {
      const condition = ifStmt.getExpression().getText()
      const testCases = extractConditionBoundaries(condition)
      
      if (testCases.length > 0) {
        boundaries.push({
          category: 'condition',
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
 * 从条件表达式提取边界值
 */
function extractConditionBoundaries(condition: string): TestCase[] {
  const testCases: TestCase[] = []
  
  // 数值比较: x > 10, x >= 10, x < 10, x <= 10
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
  
  // 相等比较: x === 'foo', x !== 'bar'
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
  
  // 长度检查: arr.length > 0, str.length === 5
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
  
  // Truthy/Falsy 检查: if (x), if (!x)
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

// ============================================================================
// Loop Boundaries Detection
// ============================================================================

/**
 * 检测循环边界
 */
function detectLoopBoundaries(functionNode: FunctionNode): LoopBoundary[] {
  const boundaries: LoopBoundary[] = []
  
  const forLoops = functionNode.getDescendantsOfKind(SyntaxKind.ForStatement)
  
  // For loops
  if (forLoops.length > 0) {
    boundaries.push({
      category: 'loop',
      reasoning: `For loop boundary cases: empty, single iteration, multiple iterations`,
      testCases: [
        { description: 'Loop with 0 iterations (empty)' },
        { description: 'Loop with 1 iteration' },
        { description: 'Loop with multiple iterations' }
      ]
    })
  }
  
  return boundaries
}

// ============================================================================
// Access Boundaries Detection
// ============================================================================

/**
 * 检测数组/对象访问边界
 */
function detectAccessBoundaries(functionNode: FunctionNode): AccessBoundary[] {
  const boundaries: AccessBoundary[] = []
  
  // 查找数组访问: arr[i], obj[key]
  const elementAccesses = functionNode.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
  
  if (elementAccesses.length > 0) {
    boundaries.push({
      category: 'access',
      reasoning: `Array/Object access requires checking: out of bounds, negative index, undefined keys`
    })
  }
  
  return boundaries
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 按参数分组边界条件
 */
export function groupBoundariesByParameter(boundaries: BoundaryValue[]): Array<{
  parameter: string
  boundaries: BoundaryValue[]
  count: number
}> {
  const grouped: Record<string, BoundaryValue[]> = {}
  
  for (const boundary of boundaries) {
    const key = 
      (boundary.category === 'parameter' && boundary.param) ||
      (boundary.category === 'condition' && boundary.condition) ||
      'general'
    
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(boundary)
  }
  
  // 为每个参数添加元数据
  return Object.entries(grouped).map(([parameter, values]) => ({
    parameter,
    boundaries: values,
    count: values.length
  }))
}

/**
 * 格式化边界条件为 Prompt 文本
 */
export function formatBoundariesForPrompt(boundaries: BoundaryValue[]): string {
  if (boundaries.length === 0) {
    return '- No specific boundary conditions detected\n'
  }
  
  let text = ''
  
  // 按类别分组
  const byCategory: Partial<Record<BoundaryValue['category'], BoundaryValue[]>> = {}
  for (const boundary of boundaries) {
    const category = boundary.category
    if (!byCategory[category]) byCategory[category] = []
    byCategory[category]!.push(boundary)
  }
  
  // 参数边界
  if (byCategory.parameter) {
    text += '**Parameter Boundaries**:\n'
    for (const b of byCategory.parameter as ParameterBoundary[]) {
      text += `- **${b.param}** (${b.type}): ${b.reasoning}\n`
      text += `  Test values: ${b.testValues.map(v => v.label).join(', ')}\n`
    }
    text += '\n'
  }
  
  // 条件边界
  if (byCategory.condition) {
    text += '**Condition Boundaries**:\n'
    for (const b of byCategory.condition as ConditionBoundary[]) {
      text += `- \`${b.condition}\`\n`
      for (const tc of b.testCases.slice(0, 3)) {  // 限制显示前3个
        text += `  • ${tc.description}\n`
      }
    }
    text += '\n'
  }
  
  // 循环边界
  if (byCategory.loop) {
    text += '**Loop Boundaries**:\n'
    for (const b of byCategory.loop as LoopBoundary[]) {
      text += `- ${b.reasoning}\n`
      for (const tc of b.testCases) {
        text += `  • ${tc.description}\n`
      }
    }
    text += '\n'
  }
  
  // 访问边界
  if (byCategory.access) {
    text += '**Access Boundaries**:\n'
    for (const b of byCategory.access as AccessBoundary[]) {
      text += `- ${b.reasoning}\n`
    }
    text += '\n'
  }
  
  return text
}

/**
 * 获取边界检测统计信息
 */
export function getBoundaryStats(boundaries: BoundaryValue[]): BoundaryStats {
  const stats: BoundaryStats = {
    total: boundaries.length,
    byCategory: {},
    byPriority: { high: 0, medium: 0, low: 0 },
    totalTestCases: 0
  }
  
  for (const boundary of boundaries) {
    // 按类别统计
    const category = boundary.category
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1
    
    // 按优先级统计
    if ('priority' in boundary) {
      if (boundary.priority === 1) stats.byPriority.high++
      else if (boundary.priority === 2) stats.byPriority.medium++
      else stats.byPriority.low++
    }
    
    // 统计测试用例数
    if ('testCases' in boundary) {
      stats.totalTestCases += boundary.testCases.length
    } else if ('testValues' in boundary) {
      stats.totalTestCases += boundary.testValues.length
    }
  }
  
  return stats
}
