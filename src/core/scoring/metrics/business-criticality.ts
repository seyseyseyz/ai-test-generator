/**
 * 业务关键性 (Business Criticality) 计算
 */

import { clamp, isMainChain, matchPattern } from '../utils.js'
import type { ScoringConfig, ImpactHint } from '../types.js'

/**
 * 根据配置计算 BC 值
 */
export function mapBCByConfig(
  { path, impactHint }: { name?: string; path: string; impactHint?: ImpactHint },
  cfg: ScoringConfig,
  overrides?: Record<string, number>
): number {
  // P2-1: 检查 AI 建议中的业务关键路径
  const suggestions = cfg?.aiEnhancement?.suggestions
  if (suggestions?.businessCriticalPaths) {
    for (const item of suggestions.businessCriticalPaths) {
      if (matchPattern(path, item.pattern) && item.suggestedBC != null) {
        return clamp(item.suggestedBC, 1, 10)
      }
    }
  }
  
  // P2-2: 检查 override 映射
  if (overrides && overrides[path]) {
    return clamp(overrides[path], 1, 10)
  }
  
  // P2-3: 主链路判断
  if (isMainChain(path, cfg)) {
    return 9
  }
  
  // P2-4: 默认根据 impactHint 判断
  if (impactHint?.hasExternal || impactHint?.hasAsync) {
    return 7
  }
  
  return 5
}

