/**
 * 配置文件管理工具
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AITestConfig } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '../..')

/**
 * 移除 JSON 注释
 */
function stripJsonComments(str: string): string {
  return String(str)
    .replace(/\/\*[\s\S]*?\*\//g, '')  // 块注释
    .replace(/(^|\s)\/\/.*$/gm, '')     // 行注释
}

/**
 * 自动探测配置文件
 */
export function detectConfig(providedPath?: string): string | null {
  const detectOrder = [
    providedPath,
    'ai-test.config.jsonc',
    'ai-test.config.json',
    'ut_scoring_config.json' // 向后兼容
  ].filter(Boolean) as string[]
  
  return detectOrder.find(p => existsSync(p)) || null
}

/**
 * 确保配置文件存在（不存在则创建）
 */
export function ensureConfig(configPath: string = 'ai-test.config.jsonc'): string {
  const detected = detectConfig(configPath)
  
  if (detected) {
    return detected
  }
  
  // 创建默认配置
  console.log('⚙️  Config not found, creating default config...')
  const templatePath = join(PKG_ROOT, 'templates', 'default.config.jsonc')
  copyFileSync(templatePath, configPath)
  console.log(`✅ Config created: ${configPath}\n`)
  
  return configPath
}

/**
 * 读取配置文件（支持 JSONC）
 */
export function readConfig(configPath: string): AITestConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`)
  }
  
  const content = readFileSync(configPath, 'utf-8')
  const cleaned = stripJsonComments(content)
  
  try {
    return JSON.parse(cleaned) as AITestConfig
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse config file: ${configPath}\n${message}`)
  }
}

/**
 * 写入配置文件（保留 JSONC 格式）
 */
export function writeConfig(configPath: string, config: AITestConfig): void {
  const content = JSON.stringify(config, null, 2)
  writeFileSync(configPath, content, 'utf-8')
}

/**
 * 检查配置是否已经 AI 分析过
 */
export function isAnalyzed(config: AITestConfig): boolean {
  return config?.aiEnhancement?.analyzed === true
}

/**
 * 验证配置结构
 */
export function validateConfig(config: Partial<AITestConfig>): string[] {
  const errors: string[] = []
  
  // 检查必需字段
  if (!config.scoringConfig) {
    errors.push('Missing required field: scoringConfig')
  }
  
  if (config.scoringConfig?.mode === 'layered' && !config.scoringConfig.layers) {
    errors.push('Layered mode requires "layers" field')
  }
  
  return errors
}

