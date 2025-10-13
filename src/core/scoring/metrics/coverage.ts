/**
 * 覆盖率 (Coverage) 评分计算
 */

import { clamp } from '../utils.js'
import type { ScoringConfig } from '../types.js'

/**
 * 将覆盖率百分比映射为评分 (1-10)
 */
export function mapCoverageScore(pct: number | undefined, _cfg: ScoringConfig): number {
  if (pct == null || pct < 0) return 0
  
  // P2-1: 0% 覆盖率
  if (pct === 0) return 0
  
  // P2-2: 线性映射：0-100% → 1-10
  // pct = 10 → score = 1
  // pct = 50 → score = 5
  // pct = 100 → score = 10
  const score = Math.ceil(pct / 10)
  
  return clamp(score, 1, 10)
}

