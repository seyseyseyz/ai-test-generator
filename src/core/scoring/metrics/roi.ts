/**
 * ROI (投资回报率) 计算
 */

import { clamp } from '../utils.js'
import type { ScoringConfig, ImpactHint, FunctionTarget } from '../types.js'

/**
 * 根据配置计算 ROI 值
 */
export function mapROIByConfig(
  hint: ImpactHint | undefined,
  _cfg: ScoringConfig,
  _localMap?: Record<string, number>,
  overrides?: Record<string, number>,
  target?: FunctionTarget
): number {
  // P2-1: override 优先
  if (overrides && target && overrides[target.path] !== undefined) {
    return clamp(overrides[target.path] ?? 1, 1, 10)
  }
  
  // P2-2: 基础值
  let roi = 5
  
  // P2-3: 根据 hint 调整
  if (hint?.hasComplexLogic) roi += 2
  if (hint?.hasTryCatch) roi += 1
  if (hint?.hasAsync) roi += 1
  
  return clamp(roi, 1, 10)
}

