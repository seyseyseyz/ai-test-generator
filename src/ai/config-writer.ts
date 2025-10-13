/**
// @ts-nocheck
 * 安全的配置写入器
 */

import { readConfig, writeConfig } from '../utils/config-manager.js'

const LOCKED_PATHS = [
  'scoringMode',
  'layers',
  'weights',
  'thresholds',
  'ccMapping',
  'dependencyCountMapping',
  'coverageScoring',
  'fallbacks',
  'aiEnhancement.enabled'
]

// const WRITABLE_PATHS = [
//   'aiEnhancement.analyzed',
//   'aiEnhancement.analyzedAt',
//   'aiEnhancement.suggestions'
// ]

/**
 * 应用 AI 建议到配置文件
 */
export async function applyAISuggestions(configPath: string, suggestions: any) {
  // 1. 读取现有配置
  const config = readConfig(configPath)
  
  // 2. 验证权限
  validateWritePermissions(suggestions)
  
  // 3. 深拷贝配置
  const newConfig = JSON.parse(JSON.stringify(config))
  
  // 4. 初始化 aiEnhancement（如果不存在）
  if (!newConfig.aiEnhancement) {
    newConfig.aiEnhancement = {
      enabled: true,
      analyzed: false,
      analyzedAt: null,
      suggestions: {
        businessCriticalPaths: [],
        highRiskModules: [],
        testabilityAdjustments: []
      }
    }
  }
  
  // 5. 只写入允许的字段
  newConfig.aiEnhancement.analyzed = true
  newConfig.aiEnhancement.analyzedAt = new Date().toISOString()
  newConfig.aiEnhancement.suggestions = suggestions
  
  // 6. 验证核心配置未被修改
  validateCoreConfigIntact(config, newConfig)
  
  // 7. 写入文件
  writeConfig(configPath, newConfig)
  
  return newConfig
}

/**
 * 验证写入权限
 */
function validateWritePermissions(suggestions: any) {
  const allowedKeys = ['businessCriticalPaths', 'highRiskModules', 'testabilityAdjustments']
  
  for (const key of Object.keys(suggestions)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`AI attempted to write forbidden field: ${key}`)
    }
  }
}

/**
 * 验证核心配置完整性
 */
function validateCoreConfigIntact(oldConfig: any, newConfig: any) {
  for (const path of LOCKED_PATHS) {
    const oldValue = getNestedValue(oldConfig, path)
    const newValue = getNestedValue(newConfig, path)
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      throw new Error(`Core config was modified (locked path: ${path})`)
    }
  }
}

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((curr: any, key: string) => curr?.[key], obj)
}

