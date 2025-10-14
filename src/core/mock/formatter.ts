/**
 * Mock Formatting and Statistics
 * @module mock/formatter
 */

import type { MockRequirement, MockStats } from './types.js'

/**
 * Format mock requirements for AI prompt (simplified)
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
  if (!mocks.length) return ''
  
  let output = '\n## 🔧 Detected Dependencies\n\n'
  
  // Group by type
  const byType: Record<string, string[]> = {}
  for (const mock of mocks) {
    if (!byType[mock.type]) {
      byType[mock.type] = []
    }
    byType[mock.type]?.push(...mock.calls)
  }
  
  // Format each type
  for (const [type, calls] of Object.entries(byType)) {
    const emoji = getTypeEmoji(type)
    output += `${emoji} **${capitalizeFirst(type)}**: ${calls.join(', ')}\n`
  }
  
  output += '\n**Note**: Please choose appropriate mocking strategies for your test framework.\n'
  
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
  
  // Count by type
  for (const mock of mocks) {
    stats.byType[mock.type] = (stats.byType[mock.type] || 0) + mock.calls.length
  }
  
  // Determine complexity
  const totalCalls = Object.values(stats.byType).reduce((sum, count) => sum + count, 0)
  if (totalCalls === 0) {
    stats.complexity = 'low'
  } else if (totalCalls <= 3) {
    stats.complexity = 'medium'
  } else if (totalCalls <= 6) {
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

