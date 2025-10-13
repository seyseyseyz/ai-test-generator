// @ts-nocheck
/**
 * 边界条件检测器（Keploy 风格）
 * 
 * 自动识别函数参数类型和条件分支的边界值，生成全面的测试用例。
 * 
 * 参考:
 * - Keploy ut-gen: https://github.com/keploy/keploy/blob/main/README-UnitGen.md
 * - IEEE 754 浮点数标准
 * 
 * @module boundary-detector
 */

import { SyntaxKind } from 'ts-morph'

/**
 * 检测函数的边界条件
 * @param {import('ts-morph').FunctionDeclaration} functionNode - ts-morph 函数节点
 * @returns {Array<Object>} 边界条件列表
 */
export function detectBoundaries(functionNode) {
  const boundaries = []
  
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
    console.error(`⚠️  Boundary detection failed: ${error.message}`)
  }
  
  return boundaries
}

/**
 * 检测参数类型边界
 */
function detectParameterBoundaries(functionNode) {
  const boundaries = []
  
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
      
    } catch (error) {
      // Skip parameters that can't be analyzed
      continue
    }
  }
  
  return boundaries
}

/**
 * 检测条件分支边界
 */
function detectConditionBoundaries(functionNode) {
  const boundaries = []
  
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
    } catch (error) {
      continue
    }
  }
  
  return boundaries
}

/**
 * 从条件表达式提取边界值
 */
function extractConditionBoundaries(condition) {
  const testCases = []
  
  // 数值比较: x > 10, x >= 10, x < 10, x <= 10
  const numMatch = condition.match(/(\w+)\s*([><]=?)\s*(-?\d+(?:\.\d+)?)/)
  if (numMatch) {
    const [, variable, operator, value] = numMatch
    const num = parseFloat(value)
    
    if (operator === '>') {
      testCases.push(
        { [variable]: num, expected: false, description: `boundary (${variable} = ${num}, should be false)` },
        { [variable]: num + 1, expected: true, description: `just above boundary (${variable} = ${num + 1}, should be true)` }
      )
    } else if (operator === '>=') {
      testCases.push(
        { [variable]: num - 1, expected: false, description: `just below (${variable} = ${num - 1}, should be false)` },
        { [variable]: num, expected: true, description: `boundary (${variable} = ${num}, should be true)` }
      )
    } else if (operator === '<') {
      testCases.push(
        { [variable]: num - 1, expected: true, description: `just below (${variable} = ${num - 1}, should be true)` },
        { [variable]: num, expected: false, description: `boundary (${variable} = ${num}, should be false)` }
      )
    } else if (operator === '<=') {
      testCases.push(
        { [variable]: num, expected: true, description: `boundary (${variable} = ${num}, should be true)` },
        { [variable]: num + 1, expected: false, description: `just above (${variable} = ${num + 1}, should be false)` }
      )
    }
  }
  
  // 相等比较: x === 'foo', x !== 'bar'
  const eqMatch = condition.match(/(\w+)\s*(===|!==)\s*['"]([^'"]+)['"]/)
  if (eqMatch) {
    const [, variable, operator, value] = eqMatch
    const expectedMatch = operator === '==='
    
    testCases.push(
      { [variable]: value, expected: expectedMatch, description: `matching value (${variable} = '${value}')` },
      { [variable]: 'other', expected: !expectedMatch, description: `non-matching value (${variable} = 'other')` },
      { [variable]: '', expected: !expectedMatch, description: `empty string (${variable} = '')` },
      { [variable]: null, expected: false, description: `null (${variable} = null)` }
    )
  }
  
  // 长度检查: arr.length > 0, str.length === 5
  const lengthMatch = condition.match(/(\w+)\.length\s*([><]=?|===|!==)\s*(\d+)/)
  if (lengthMatch) {
    const [, variable, operator, value] = lengthMatch
    const num = parseInt(value)
    
    if (operator === '>' && num === 0) {
      testCases.push(
        { [variable]: '[]', expected: false, description: `empty (${variable}.length = 0)` },
        { [variable]: '[1]', expected: true, description: `non-empty (${variable}.length = 1)` }
      )
    } else if (operator === '===') {
      testCases.push(
        { [variable]: `Array(${num - 1})`, expected: false, description: `length ${num - 1}` },
        { [variable]: `Array(${num})`, expected: true, description: `length ${num}` },
        { [variable]: `Array(${num + 1})`, expected: false, description: `length ${num + 1}` }
      )
    }
  }
  
  // Truthy/Falsy 检查: if (x), if (!x)
  const truthyMatch = condition.match(/^!?(\w+)$/)
  if (truthyMatch) {
    const [fullMatch, variable] = truthyMatch
    const isNegated = fullMatch.startsWith('!')
    
    testCases.push(
      { [variable]: true, expected: !isNegated, description: 'truthy: true' },
      { [variable]: false, expected: isNegated, description: 'falsy: false' },
      { [variable]: 0, expected: isNegated, description: 'falsy: 0' },
      { [variable]: '""', expected: isNegated, description: 'falsy: empty string' },
      { [variable]: null, expected: isNegated, description: 'falsy: null' },
      { [variable]: undefined, expected: isNegated, description: 'falsy: undefined' }
    )
  }
  
  return testCases
}

/**
 * 检测循环边界
 */
function detectLoopBoundaries(functionNode) {
  const boundaries = []
  
  const forLoops = functionNode.getDescendantsOfKind(SyntaxKind.ForStatement)
  const whileLoops = functionNode.getDescendantsOfKind(SyntaxKind.WhileStatement)
  const forOfLoops = functionNode.getDescendantsOfKind(SyntaxKind.ForOfStatement)
  
  if (forLoops.length > 0 || whileLoops.length > 0 || forOfLoops.length > 0) {
    boundaries.push({
      category: 'loop',
      type: 'iteration',
      testCases: [
        { scenario: 'empty', description: 'Zero iterations (empty collection)' },
        { scenario: 'single', description: 'Single iteration (one element)' },
        { scenario: 'multiple', description: 'Multiple iterations (many elements)' },
        { scenario: 'large', description: 'Large collection (performance test)' }
      ],
      reasoning: 'Test loop behavior with different iteration counts',
      priority: 2
    })
  }
  
  return boundaries
}

/**
 * 检测数组/对象访问边界
 */
function detectAccessBoundaries(functionNode) {
  const boundaries = []
  
  // 查找数组访问: arr[i], obj[key]
  const elementAccesses = functionNode.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
  
  if (elementAccesses.length > 0) {
    boundaries.push({
      category: 'access',
      type: 'element-access',
      testCases: [
        { scenario: 'valid-index', description: 'Valid array index or object key' },
        { scenario: 'negative-index', description: 'Negative array index' },
        { scenario: 'out-of-bounds', description: 'Index beyond array length' },
        { scenario: 'undefined-key', description: 'Undefined object key' },
        { scenario: 'null-reference', description: 'Accessing property on null/undefined' }
      ],
      reasoning: 'Test safe access patterns and error handling',
      priority: 2
    })
  }
  
  return boundaries
}

/**
 * 格式化边界条件为 Prompt 文本
 * @param {Array} boundaries - 边界条件列表
 * @returns {string} 格式化的文本
 */
export function formatBoundariesForPrompt(boundaries) {
  if (boundaries.length === 0) {
    return '- No specific boundary conditions detected\n'
  }
  
  let text = ''
  
  // 按类别分组
  const byCategory = {}
  for (const boundary of boundaries) {
    const category = boundary.category || 'other'
    if (!byCategory[category]) byCategory[category] = []
    byCategory[category].push(boundary)
  }
  
  // 参数边界
  if (byCategory.parameter) {
    text += '**Parameter Boundaries**:\n'
    for (const b of byCategory.parameter) {
      text += `- **${b.param}** (${b.type}): ${b.reasoning}\n`
      text += `  Test values: ${b.testValues.map(v => v.label).join(', ')}\n`
    }
    text += '\n'
  }
  
  // 条件边界
  if (byCategory.condition) {
    text += '**Condition Boundaries**:\n'
    for (const b of byCategory.condition) {
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
    for (const b of byCategory.loop) {
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
    for (const b of byCategory.access) {
      text += `- ${b.reasoning}\n`
    }
    text += '\n'
  }
  
  return text
}

/**
 * 获取边界检测统计信息
 * @param {Array} boundaries - 边界条件列表
 * @returns {Object} 统计信息
 */
export function getBoundaryStats(boundaries) {
  const stats = {
    total: boundaries.length,
    byCategory: {},
    byPriority: { high: 0, medium: 0, low: 0 },
    totalTestCases: 0
  }
  
  for (const boundary of boundaries) {
    // 按类别统计
    const category = boundary.category || 'other'
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1
    
    // 按优先级统计
    if (boundary.priority === 1) stats.byPriority.high++
    else if (boundary.priority === 2) stats.byPriority.medium++
    else stats.byPriority.low++
    
    // 统计测试用例数
    if (boundary.testValues) {
      stats.totalTestCases += boundary.testValues.length
    } else if (boundary.testCases) {
      stats.totalTestCases += boundary.testCases.length
    }
  }
  
  return stats
}

