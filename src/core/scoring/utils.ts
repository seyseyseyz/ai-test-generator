/**
 * 评分系统的工具函数
 */

import type { ScoringConfig } from './types.js'
import type { FunctionTarget, Layer } from '../../types/index.js'

/**
 * 向下取整到指定小数位
 */
export function toFixedDown(num: number, digits = 2): number {
  const m = Math.pow(10, digits)
  return Math.floor(num * m) / m
}

/**
 * 限制数值在指定范围内
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * 匹配文件路径和模式（支持 glob 语法）
 */
export function matchPattern(filePath: string, pattern: string): boolean {
  if (!pattern || !filePath) return false
  
  // 移除开头的 src/ 如果存在（标准化路径）
  const normalizedPath = filePath.replace(/^src\//, '')
  
  // 简单 glob 匹配：支持 ** 和 *
  const regexPattern = pattern
    .replace(/\./g, '\\.')         // . 转义
    .replace(/\*\*/g, '__DSTAR__') // ** 临时占位
    .replace(/\*/g, '[^/]*')       // * 匹配非斜杠字符
    .replace(/__DSTAR__/g, '.*')   // ** 匹配任意字符
  
  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(normalizedPath) || regex.test(filePath)
}

/**
 * 移除 JSON 注释
 */
export function stripJsonComments(s: string): string {
  return String(s)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
}

/**
 * 根据路径匹配层级（作为 fallback）
 */
export function matchLayerByPath(filePath: string, cfg: ScoringConfig): Layer | 'unknown' {
  const layers = cfg?.layers || {}
  
  // 按配置文件中定义的顺序遍历层级（foundation → business → state → ui）
  const layerOrder: Layer[] = ['foundation', 'business', 'state', 'ui']
  
  for (const layerKey of layerOrder) {
    const layerDef = (layers as any)[layerKey]
    if (!layerDef) continue
    
    const patterns = layerDef.patterns || []
    for (const pattern of patterns) {
      // 简单的 glob 匹配：支持 ** 和 *
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '__DSTAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DSTAR__/g, '.*')
      
      const regex = new RegExp(`^${regexPattern}$`)
      
      // 标准化路径以进行匹配
      const normalizedPath = filePath.replace(/^src\//, '')
      
      if (regex.test(normalizedPath) || regex.test(filePath)) {
        return layerKey
      }
    }
  }
  
  return 'unknown'
}

/**
 * 匹配目标的层级
 */
export function matchLayer(target: FunctionTarget, cfg: ScoringConfig): Layer | 'unknown' {
  // P2-1: 如果 target 本身已有 layer，直接返回
  if (target.layer) {
    return target.layer as Layer
  }
  
  // P2-2: 否则根据路径重新匹配
  return matchLayerByPath(target.path, cfg)
}

/**
 * 判断是否为主链路
 */
export function isMainChain(path: string, cfg: ScoringConfig): boolean {
  const arr = (cfg?.mainChainPaths || []).map(s => String(s).toLowerCase())
  const lower = (path || '').toLowerCase()
  return arr.some(s => lower.includes(s))
}

