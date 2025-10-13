/**
 * 代码复杂度 (Code Complexity) 计算
 */

import { readFileSync, existsSync } from 'node:fs'
import { clamp, stripJsonComments } from '../utils.js'
import type { ScoringConfig, ESLintCognitiveData, FunctionTarget } from '../types.js'

/**
 * 从指标数据计算 CC 值
 */
export function mapCCFromMetrics(
  metrics: { cyclomatic?: number; cognitive?: number },
  _cfg: ScoringConfig,
  eslintCognitive: ESLintCognitiveData,
  target: FunctionTarget,
  overrides?: Record<string, number>
): number {
  // P2-1: override 优先
  if (overrides && overrides[target.path] !== undefined) {
    return clamp(overrides[target.path] ?? 1, 1, 10)
  }
  
  // P2-2: eslint cognitive 优先（更准确）
  const eslintVal = eslintCognitive?.[target.path]?.[target.name]
  if (eslintVal != null && eslintVal > 0) {
    if (eslintVal <= 5) return 1
    if (eslintVal <= 10) return 3
    if (eslintVal <= 15) return 5
    if (eslintVal <= 20) return 7
    if (eslintVal <= 30) return 9
    return 10
  }
  
  // P2-3: 使用 metrics 中的 cognitive
  if (metrics.cognitive != null && metrics.cognitive > 0) {
    if (metrics.cognitive <= 5) return 1
    if (metrics.cognitive <= 10) return 3
    if (metrics.cognitive <= 15) return 5
    if (metrics.cognitive <= 20) return 7
    if (metrics.cognitive <= 30) return 9
    return 10
  }
  
  // P2-4: 使用 cyclomatic
  const cyclo = metrics.cyclomatic || 1
  if (cyclo <= 3) return 1
  if (cyclo <= 5) return 3
  if (cyclo <= 10) return 5
  if (cyclo <= 15) return 7
  if (cyclo <= 20) return 9
  return 10
}

/**
 * 加载 ESLint 认知复杂度数据
 */
export function loadESLintCognitive(eslintJsonPath: string): ESLintCognitiveData {
  if (!existsSync(eslintJsonPath)) {
    return {}
  }
  
  try {
    const raw = readFileSync(eslintJsonPath, 'utf-8')
    const clean = stripJsonComments(raw)
    const data = JSON.parse(clean)
    
    if (!Array.isArray(data) || data.length === 0) {
      return {}
    }
    
    const result: ESLintCognitiveData = {}
    
    for (const item of data) {
      if (!item.filePath || !Array.isArray(item.messages)) continue
      
      const filePath = item.filePath.replace(/^.*\/src\//, 'src/')
      
      for (const msg of item.messages) {
        if (!msg.ruleId?.includes('complexity') || msg.ruleId === 'complexity') {
          continue
        }
        
        const match = msg.message?.match(/complexity of (\d+)/)
        if (!match) continue
        
        const complexity = parseInt(match[1], 10)
        if (isNaN(complexity)) continue
        
        // 尝试从消息中提取函数名
        let funcName = 'unknown'
        const funcMatch = msg.message?.match(/Function '([^']+)'/)
        if (funcMatch) {
          funcName = funcMatch[1]
        }
        
        if (!result[filePath]) {
          result[filePath] = {}
        }
        
        result[filePath][funcName] = complexity
      }
    }
    
    return result
  } catch (error) {
    console.error(`Failed to load ESLint cognitive data: ${eslintJsonPath}`, error)
    return {}
  }
}

