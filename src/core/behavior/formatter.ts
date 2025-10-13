/**
 * Behavior Formatting and Statistics
 * @module behavior/formatter
 */

import type { Behavior, BehaviorStats, TestPlan } from './types.js'

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format behaviors for AI prompt
 * 
 * @param behaviors - Classified behaviors
 * @returns Formatted string for prompt
 * 
 * @example
 * ```typescript
 * const formatted = formatBehaviorsForPrompt(behaviors)
 * console.log(formatted)
 * ```
 */
export function formatBehaviorsForPrompt(behaviors: Behavior[]): string {
  if (!behaviors.length) return ''
  
  let output = '\n## 📋 Behavior-Driven Test Plan\n\n'
  output += '> 基于代码分析自动生成的测试场景分类\n\n'
  
  // 按类别分组
  const grouped: Record<string, Behavior[]> = {}
  for (const b of behaviors) {
    const categoryId = b.category.id
    if (!grouped[categoryId]) {
      grouped[categoryId] = []
    }
    grouped[categoryId]?.push(b)
  }
  
  // 输出每个类别
  for (const categoryId in grouped) {
    const categoryBehaviors = grouped[categoryId]
    if (!categoryBehaviors || categoryBehaviors.length === 0) continue
    
    const cat = categoryBehaviors[0]?.category
    if (!cat) continue
    
    output += `### ${cat.emoji} ${cat.name}\n\n`
    output += `${cat.description}\n\n`
    
    for (const behavior of categoryBehaviors) {
      output += `**${behavior.description}**\n`
      output += `- Scenario: \`${behavior.testCase.scenario}\`\n`
      output += `- Expected: ${behavior.testCase.expectedOutcome}\n`
      
      if (behavior.testCase.importance) {
        output += `- Importance: ${behavior.testCase.importance}\n`
      }
      
      output += `- Reasoning: ${behavior.reasoning}\n\n`
    }
    
    output += '\n'
  }
  
  return output
}

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Get behavior statistics
 * 
 * @param behaviors - Classified behaviors
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const stats = getBehaviorStats(behaviors)
 * console.log(`Total: ${stats.total}`)
 * ```
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
    // Count by category
    const categoryId = behavior.category.id
    stats.byCategory[categoryId] = (stats.byCategory[categoryId] || 0) + 1
    
    // Count by importance
    const importance = behavior.testCase.importance || 'optional'
    if (importance in stats.byImportance) {
      stats.byImportance[importance as keyof typeof stats.byImportance]++
    }
  }
  
  return stats
}

/**
 * Generate test plan from behaviors
 * 
 * @param behaviors - Classified behaviors
 * @returns Test plan with recommendations
 * 
 * @example
 * ```typescript
 * const plan = generateTestPlan(behaviors)
 * console.log(`Total tests: ${plan.totalTests}`)
 * ```
 */
export function generateTestPlan(behaviors: Behavior[]): TestPlan {
  const stats = getBehaviorStats(behaviors)
  
  const plan: TestPlan = {
    totalTests: stats.total,
    estimatedTime: calculateEstimatedTime(stats.total),
    coverage: {
      happyPath: stats.byCategory['happy-path'] || 0,
      edgeCases: stats.byCategory['edge-case'] || 0,
      errorPaths: stats.byCategory['error-path'] || 0
    },
    recommendations: []
  }
  
  // Generate recommendations
  if (plan.coverage.happyPath === 0) {
    plan.recommendations.push('⚠️  Add Happy Path tests - basic functionality not covered')
  }
  
  if (plan.coverage.edgeCases === 0) {
    plan.recommendations.push('💡 Consider adding Edge Case tests for robustness')
  }
  
  if (plan.coverage.errorPaths === 0) {
    plan.recommendations.push('🔒 Add Error Path tests for better error handling')
  }
  
  if (stats.byImportance.critical === 0) {
    plan.recommendations.push('🎯 No critical tests identified - review test priority')
  }
  
  const ratio = plan.coverage.happyPath / (plan.coverage.edgeCases + plan.coverage.errorPaths + 1)
  if (ratio > 2) {
    plan.recommendations.push('⚖️  Test balance: Too many Happy Path tests, add more edge cases')
  }
  
  if (plan.totalTests > 20) {
    plan.recommendations.push('📊 Large test suite - consider splitting into test groups')
  }
  
  return plan
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate estimated time for test execution
 */
function calculateEstimatedTime(testCount: number): string {
  const avgTimePerTest = 0.5 // seconds
  const totalMinutes = Math.ceil((testCount * avgTimePerTest) / 60)
  
  if (totalMinutes < 1) return '< 1 min'
  if (totalMinutes < 60) return `~${totalMinutes} min`
  
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `~${hours}h ${minutes}m`
}

