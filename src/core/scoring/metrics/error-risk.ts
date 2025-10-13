/**
 * 错误风险 (Error Risk) 计算
 */

import { clamp, matchPattern } from '../utils.js'
import type { ScoringConfig, GitSignals, ImpactHint, DependencyGraph } from '../types.js'

/**
 * 根据 Git 数据和配置计算可能性 (Likelihood)
 */
export function mapLikelihoodFromGitByConfig(
  git: GitSignals,
  _depGraphData: DependencyGraph,
  _cfg: ScoringConfig
): number {
  const { totalCommits, recentCommits, uniqueAuthors, crossModuleRefs } = git
  
  let L = 3 // 基础值
  
  // P2-1: 提交频率（越频繁，越可能出错）
  if (totalCommits > 50) L += 2
  else if (totalCommits > 20) L += 1
  
  // P2-2: 最近活跃度
  if (recentCommits > 10) L += 2
  else if (recentCommits > 5) L += 1
  
  // P2-3: 多人协作（人越多，越容易冲突）
  if (uniqueAuthors > 5) L += 1
  else if (uniqueAuthors > 10) L += 2
  
  // P2-4: 跨模块引用（复杂依赖）
  if (crossModuleRefs > 3) L += 1
  
  return clamp(L, 1, 10)
}

/**
 * 根据提示计算影响 (Impact)
 */
export function mapImpactFromHintByConfig(
  hint: ImpactHint | undefined,
  _cfg: ScoringConfig,
  _localMap?: Record<string, number>
): number {
  let I = 3 // 基础值
  
  if (hint?.hasExternal) I += 2
  if (hint?.hasAsync) I += 1
  if (hint?.hasTryCatch) I += 1
  if (hint?.hasComplexLogic) I += 1
  
  return clamp(I, 1, 10)
}

/**
 * 根据 Git 数据和影响提示计算 ER 值
 */
export function mapERFromGitAndImpactConfig(
  git: GitSignals,
  impactHint: ImpactHint | undefined,
  depGraphData: DependencyGraph,
  cfg: ScoringConfig,
  overrides?: Record<string, number>,
  localImpact?: Record<string, number>,
  target?: { path: string }
): number {
  // P2-1: 检查 AI 建议中的高风险模块
  const suggestions = cfg?.aiEnhancement?.suggestions
  if (suggestions?.highRiskModules && target) {
    for (const item of suggestions.highRiskModules) {
      if (matchPattern(target.path, item.pattern) && item.suggestedER != null) {
        return clamp(item.suggestedER, 1, 10)
      }
    }
  }
  
  // P2-2: override 优先
  if (overrides && target && overrides[target.path]) {
    return clamp(overrides[target.path] ?? 1, 1, 10)
  }
  
  // P2-3: 计算 Likelihood 和 Impact
  const L = mapLikelihoodFromGitByConfig(git, depGraphData, cfg)
  const I = mapImpactFromHintByConfig(impactHint, cfg, localImpact)
  
  // P2-4: ER = (L + I) / 2，四舍五入
  const ER = Math.round((L + I) / 2)
  
  return clamp(ER || 1, 1, 10)
}

