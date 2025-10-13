/**
 * 可测试性 (Testability) 计算
 */

import { clamp, matchPattern } from '../utils.js'
import type { ScoringConfig, ImpactHint, DependencyGraph, FunctionTarget } from '../types.js'

/**
 * 计算依赖数量
 */
export function mapDependencyCount(
  depGraphData: DependencyGraph,
  _cfg: ScoringConfig
): number {
  // 简化实现：返回依赖图的节点数量
  return depGraphData?.nodes?.size || 0
}

/**
 * 根据配置计算可测试性值
 */
export function mapTestabilityByConfig(
  hint: ImpactHint | undefined,
  cfg: ScoringConfig,
  _localMap?: Record<string, number>,
  overrides?: Record<string, number>,
  target?: FunctionTarget
): number {
  // P2-1: 检查 AI 建议中的可测试性调整
  const suggestions = cfg?.aiEnhancement?.suggestions
  if (suggestions?.testabilityAdjustments && target) {
    for (const item of suggestions.testabilityAdjustments) {
      if (matchPattern(target.path, item.pattern) && item.adjustment) {
        // adjustment: "-2" | "-1" | "+1" | "+2"
        const base = 5
        const adj = parseInt(item.adjustment, 10)
        return clamp(base + adj, 1, 10)
      }
    }
  }
  
  // P2-2: override 优先
  if (overrides && target && overrides[target.path] !== undefined) {
    return clamp(overrides[target.path] ?? 1, 1, 10)
  }
  
  // P2-3: 基础值 5，根据 hint 调整
  let testability = 5
  
  // 复杂逻辑降低可测试性
  if (hint?.hasComplexLogic) testability -= 1
  
  // 异步操作降低可测试性
  if (hint?.hasAsync) testability -= 1
  
  // 外部依赖降低可测试性
  if (hint?.hasExternal) testability -= 1
  
  // try-catch 表明有错误处理，轻微降低可测试性
  if (hint?.hasTryCatch) testability -= 0.5
  
  return clamp(Math.round(testability), 1, 10)
}

