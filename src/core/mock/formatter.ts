/**
 * Mock Formatting and Statistics
 * @module mock/formatter
 */

import type { MockRequirement, MockStats } from './types.js'

/**
 * Format mock requirements for AI prompt
 * 
 * @param mocks - Array of mock requirements
 * @returns Formatted string for prompt
 * 
 * @example
 * ```typescript
 * const formatted = formatMocksForPrompt(mocks)
 * console.log(formatted)
 * ```
 */
export function formatMocksForPrompt(mocks: MockRequirement[]): string {
  if (!mocks.length) return '- No mocks required\n'
  
  let output = '\n## 🔌 Mock Requirements\n\n'
  output += '> 基于依赖分析自动生成的 Mock 需求\n\n'
  
  // Group by type
  const byType: Record<string, MockRequirement[]> = {}
  for (const mock of mocks) {
    if (!byType[mock.type]) {
      byType[mock.type] = []
    }
    byType[mock.type]?.push(mock)
  }
  
  // Format each type
  for (const [type, typeMocks] of Object.entries(byType)) {
    const emoji = getTypeEmoji(type)
    output += `### ${emoji} ${capitalizeFirst(type)} Mocks\n\n`
    
    for (const mock of typeMocks) {
      output += `**Strategy**: ${mock.mockStrategy}\n`
      output += `**Reason**: ${mock.reason}\n\n`
      output += `**Setup Example**:\n\`\`\`typescript\n${mock.setupExample}\n\`\`\`\n\n`
      
      if (mock.testExample) {
        output += `**Test Example**:\n\`\`\`typescript\n${mock.testExample}\n\`\`\`\n\n`
      }
    }
  }
  
  return output
}

/**
 * Get mock statistics
 * 
 * @param mocks - Array of mock requirements
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const stats = getMockStats(mocks)
 * console.log(`Total mocks: ${stats.total}`)
 * console.log(`Complexity: ${stats.complexity}`)
 * ```
 */
export function getMockStats(mocks: MockRequirement[]): MockStats {
  const stats: MockStats = {
    total: mocks.length,
    byType: {},
    byStrategy: {},
    complexity: 'low',
    recommendations: []
  }
  
  // Count by type and strategy
  for (const mock of mocks) {
    stats.byType[mock.type] = (stats.byType[mock.type] || 0) + 1
    stats.byStrategy[mock.mockStrategy] = (stats.byStrategy[mock.mockStrategy] || 0) + 1
  }
  
  // Determine complexity
  if (stats.total === 0) {
    stats.complexity = 'low'
  } else if (stats.total <= 3) {
    stats.complexity = 'medium'
  } else if (stats.total <= 6) {
    stats.complexity = 'high'
  } else {
    stats.complexity = 'very-high'
  }
  
  // Generate recommendations
  if (stats.total === 0) {
    stats.recommendations.push('✅ No external dependencies detected - function is easy to test')
  }
  
  if (stats.byType['http'] && stats.byType['http'] > 2) {
    stats.recommendations.push('💡 Consider using MSW for consistent HTTP mocking')
  }
  
  if (stats.byType['database']) {
    stats.recommendations.push('⚠️  Database mocks detected - consider using in-memory databases for tests')
  }
  
  if (stats.complexity === 'very-high') {
    stats.recommendations.push('🔥 High mock complexity - consider refactoring to reduce dependencies')
  }
  
  if (Object.keys(stats.byType).length > 3) {
    stats.recommendations.push('⚙️  Multiple mock types needed - ensure proper test isolation')
  }
  
  return stats
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get emoji for mock type
 */
function getTypeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    http: '🌐',
    timer: '⏰',
    random: '🎲',
    filesystem: '📁',
    database: '🗄️',
    external: '📦'
  }
  return emojiMap[type.toLowerCase()] || '🔌'
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

