/**
 * 配置加载器
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripJsonComments } from './utils.js'
import type { ScoringConfig } from './types.js'

/**
 * 加载配置文件
 */
export function loadConfig(pathFromArg?: string): ScoringConfig {
  const cfgPath = pathFromArg || 'ai-test.config.jsonc'
  
  if (!existsSync(cfgPath)) {
    console.warn(`⚠️  Config not found: ${cfgPath}, using defaults`)
    return {}
  }
  
  try {
    const raw = readFileSync(resolve(cfgPath), 'utf-8')
    const clean = stripJsonComments(raw)
    return JSON.parse(clean)
  } catch (error) {
    console.error(`❌ Failed to load config: ${cfgPath}`, error)
    return {}
  }
}

/**
 * 获取权重配置
 */
export function pickWeight(cfg: ScoringConfig, key: string, def: number): number {
  return cfg?.weights?.[key as keyof typeof cfg.weights] ?? def
}

/**
 * 获取阈值配置
 */
export function pickThreshold(cfg: ScoringConfig, key: string, def: number): number {
  return cfg?.thresholds?.[key as keyof typeof cfg.thresholds] ?? def
}

