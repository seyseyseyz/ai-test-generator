/**
 * 评分计算器 - 核心评分算法
 */

import { toFixedDown } from './utils.js'
import { pickWeight, pickThreshold } from './config-loader.js'
import type { ScoringConfig, ScoringMetrics, FunctionTarget } from './types.js'

/**
 * 传统评分方法（兼容旧配置）
 */
export function computeScoreLegacy(
  { BC, CC, ER, ROI, coverageScore }: ScoringMetrics,
  cfg: ScoringConfig
): { score: number; priority: 'P0' | 'P1' | 'P2' | 'P3'; layer: string } {
  const s = BC * pickWeight(cfg, 'BC', 0.4)
    + CC * pickWeight(cfg, 'CC', 0.3)
    + ER * pickWeight(cfg, 'ER', 0.2)
    + (ROI || 0) * pickWeight(cfg, 'ROI', 0.1)
    + (typeof coverageScore === 'number' ? coverageScore * pickWeight(cfg, 'coverage', 0) : 0)
  
  const score = toFixedDown(s, 2)
  const P0 = pickThreshold(cfg, 'P0', 8.5)
  const P1 = pickThreshold(cfg, 'P1', 6.5)
  const P2 = pickThreshold(cfg, 'P2', 4.5)
  
  let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3'
  if (score >= P0) priority = 'P0'
  else if (score >= P1) priority = 'P1'
  else if (score >= P2) priority = 'P2'
  
  return { score, priority, layer: 'N/A' }
}

/**
 * 分层评分方法（新方法）
 */
export function computeScoreLayered(
  { BC, CC, ER, testability, dependencyCount, coverageScore }: ScoringMetrics,
  target: FunctionTarget,
  cfg: ScoringConfig
): { score: number; priority: 'P0' | 'P1' | 'P2' | 'P3'; layer: string; layerName?: string } {
  const layer = target.layer || 'unknown'
  const layerDef = cfg?.layers?.[layer as keyof typeof cfg.layers]
  
  if (!layerDef) {
    // 如果没有层级定义，回退到传统评分
    return computeScoreLegacy({ BC, CC, ER, ROI: testability, coverageScore }, cfg)
  }
  
  const weights = layerDef.weights || {}
  let score = 0
  
  // 根据层级定义的权重计算分数
  if (weights.BC !== undefined) score += BC * weights.BC
  if (weights.CC !== undefined) score += CC * weights.CC
  if (weights.ER !== undefined) score += ER * weights.ER
  if (weights.testability !== undefined && testability !== undefined) {
    score += testability * weights.testability
  }
  if (weights.dependencyCount !== undefined && dependencyCount !== undefined) {
    score += dependencyCount * weights.dependencyCount
  }
  if (weights.coverage !== undefined && typeof coverageScore === 'number') {
    score += coverageScore * weights.coverage
  }
  
  score = toFixedDown(score, 2)
  
  // 使用层级特定的阈值
  const thresholds = layerDef.thresholds || { P0: 8.0, P1: 6.5, P2: 4.5 }
  let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3'
  if (score >= thresholds.P0) priority = 'P0'
  else if (score >= thresholds.P1) priority = 'P1'
  else if (score >= thresholds.P2) priority = 'P2'
  
  return { score, priority, layer, layerName: (layerDef as any).name }
}

/**
 * 统一评分入口
 */
export function computeScore(
  metrics: ScoringMetrics,
  target: FunctionTarget,
  cfg: ScoringConfig
): { score: number; priority: 'P0' | 'P1' | 'P2' | 'P3'; layer: string; layerName?: string } {
  const mode = cfg?.mode || 'legacy'
  
  if (mode === 'layered') {
    return computeScoreLayered(metrics, target, cfg)
  } else {
    return computeScoreLegacy(metrics, cfg)
  }
}

/**
 * 获取目标的指标数据
 */
export function pickMetricsForTarget(
  provider: { byFunc?: Record<string, { cyclomatic: number }> },
  target: FunctionTarget
): { cyclomatic: number } {
  const key = `${target.path}#${target.name}`
  const func = provider?.byFunc?.[key]
  
  if (!func) {
    return { cyclomatic: 1 }
  }
  
  return func
}

