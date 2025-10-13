/**
 * Boundary Formatting and Statistics
 * @module boundary/formatter
 */

import type { BoundaryGroup, BoundaryStats, BoundaryValue } from './types.js'

/**
 * Group boundaries by parameter
 * 
 * @param boundaries - Array of boundary values
 * @returns Grouped boundaries by parameter name
 * 
 * @example
 * ```typescript
 * const grouped = groupBoundariesByParameter(boundaries)
 * console.log(`Grouped into ${grouped.length} parameters`)
 * ```
 */
export function groupBoundariesByParameter(boundaries: BoundaryValue[]): BoundaryGroup[] {
  const grouped: Record<string, BoundaryValue[]> = {}
  
  for (const boundary of boundaries) {
    if (boundary.type === 'parameter') {
      const paramName = boundary.parameterName
      if (!grouped[paramName]) {
        grouped[paramName] = []
      }
      grouped[paramName]?.push(boundary)
    }
  }
  
  return Object.entries(grouped).map(([parameter, boundaries]) => ({
    parameter,
    boundaries
  }))
}

/**
 * Format boundaries for AI prompt
 * 
 * @param boundaries - Array of boundary values
 * @returns Formatted string for prompt
 * 
 * @example
 * ```typescript
 * const formatted = formatBoundariesForPrompt(boundaries)
 * console.log(formatted)
 * ```
 */
export function formatBoundariesForPrompt(boundaries: BoundaryValue[]): string {
  if (!boundaries.length) return '- No boundaries detected\n'
  
  let output = '\n## 🎯 Boundary Value Analysis\n\n'
  output += '> 基于代码分析自动生成的边界测试值\n\n'
  
  // Group by type
  const byType: Record<string, BoundaryValue[]> = {
    parameter: [],
    'if-statement': [],
    loop: [],
    'array-access': [],
    'object-property': []
  }
  
  for (const boundary of boundaries) {
    const type = boundary.type
    if (!byType[type]) {
      byType[type] = []
    }
    byType[type]?.push(boundary)
  }
  
  // Format parameters
  if (byType.parameter && byType.parameter.length > 0) {
    output += '### 📊 Parameter Boundaries\n\n'
    for (const boundary of byType.parameter) {
      if (boundary.type === 'parameter') {
        output += `**${boundary.parameterName}** (${boundary.parameterType}):\n`
        output += `- Test Values: ${boundary.testValues.map(tv => tv.label).slice(0, 5).join(', ')}`
        if (boundary.testValues.length > 5) output += ', ...'
        output += `\n- Reasoning: ${boundary.reasoning}\n\n`
      }
    }
  }
  
  // Format conditions
  if (byType['if-statement'] && byType['if-statement'].length > 0) {
    output += '### ⚖️  Condition Boundaries\n\n'
    for (const boundary of byType['if-statement']) {
      if (boundary.type === 'if-statement') {
        output += `**Condition**: \`${boundary.condition}\`\n`
        output += `- Test Cases: ${boundary.testCases.length} cases\n`
        output += `- ${boundary.reasoning}\n\n`
      }
    }
  }
  
  // Format loops
  if (byType.loop && byType.loop.length > 0) {
    output += '### 🔄 Loop Boundaries\n\n'
    for (const boundary of byType.loop) {
      if (boundary.type === 'loop') {
        output += `**Loop Type**: ${boundary.loopType}\n`
        output += `- ${boundary.reasoning}\n\n`
      }
    }
  }
  
  return output
}

/**
 * Get boundary statistics
 * 
 * @param boundaries - Array of boundary values
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const stats = getBoundaryStats(boundaries)
 * console.log(`Total boundaries: ${stats.total}`)
 * console.log(`Complexity: ${stats.complexity}`)
 * ```
 */
export function getBoundaryStats(boundaries: BoundaryValue[]): BoundaryStats {
  const stats: BoundaryStats = {
    total: boundaries.length,
    byType: {
      parameter: 0,
      condition: 0,
      loop: 0,
      access: 0
    },
    byPriority: {
      high: 0,
      medium: 0,
      low: 0
    },
    complexity: 'low',
    recommendations: []
  }
  
  // Count by type and priority
  for (const boundary of boundaries) {
    // Count by type
    if (boundary.type === 'parameter') stats.byType.parameter++
    else if (boundary.type === 'if-statement') stats.byType.condition++
    else if (boundary.type === 'loop') stats.byType.loop++
    else if (boundary.type === 'array-access' || boundary.type === 'object-property') stats.byType.access++
    
    // Count by priority
    if (boundary.priority === 1) stats.byPriority.high++
    else if (boundary.priority === 2) stats.byPriority.medium++
    else stats.byPriority.low++
  }
  
  // Determine complexity
  if (stats.total < 5) {
    stats.complexity = 'low'
  } else if (stats.total < 15) {
    stats.complexity = 'medium'
  } else if (stats.total < 30) {
    stats.complexity = 'high'
  } else {
    stats.complexity = 'very-high'
  }
  
  // Generate recommendations
  if (stats.byType.parameter === 0) {
    stats.recommendations.push('⚠️  No parameter boundaries detected - review function parameters')
  }
  
  if (stats.byType.condition === 0) {
    stats.recommendations.push('💡 No condition boundaries detected - function may lack branching logic')
  }
  
  if (stats.byPriority.high > 10) {
    stats.recommendations.push('🔥 Many high-priority boundaries - consider splitting function')
  }
  
  if (stats.complexity === 'very-high') {
    stats.recommendations.push('⚠️  Very high complexity - strong candidate for refactoring')
  }
  
  return stats
}

