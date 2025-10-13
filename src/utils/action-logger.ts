#!/usr/bin/env node
/**
 * Action Logger - 操作日志记录器
 * 
 * 借鉴 Qodo Cover 的设计：
 * - 记录所有测试生成操作
 * - 支持 dry-run 模式
 * - 提供可追溯性和审计能力
 * 
 * Reference: Qodo Cover (CodiumAI) - Actions Log System
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
// Constants
// ============================================================================

const ACTIONS_LOG_DIR = 'reports/actions'
const ACTIONS_LOG_FILE = join(ACTIONS_LOG_DIR, 'actions.log')
const ACTIONS_SUMMARY_FILE = join(ACTIONS_LOG_DIR, 'summary.json')

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 操作类型枚举
 */
export const ActionTypes = {
  SCAN: 'scan',
  GENERATE: 'generate',
  TEST_CREATED: 'test_created',
  TEST_UPDATED: 'test_updated',
  TEST_FAILED: 'test_failed',
  TEST_SKIPPED: 'test_skipped',
  COVERAGE_IMPROVED: 'coverage_improved',
  ITERATION_STARTED: 'iteration_started',
  ITERATION_COMPLETED: 'iteration_completed',
  QUALITY_CHECK: 'quality_check',
  DRY_RUN: 'dry_run'
} as const

export type ActionType = typeof ActionTypes[keyof typeof ActionTypes]

/**
 * Action input
 */
export interface ActionInput {
  type: ActionType | string
  description: string
  details?: Record<string, unknown>
  dryRun?: boolean
}

/**
 * Logged action entry
 */
export interface ActionLogEntry {
  timestamp: string
  type: ActionType | string
  description: string
  details: Record<string, unknown>
  dryRun: boolean
}

/**
 * Action summary statistics
 */
export interface ActionSummary {
  totalActions: number
  actionsByType: Record<string, number>
  firstAction: string | null
  lastAction: string | null
  dryRunMode: boolean
}

// ============================================================================
// Logger Initialization
// ============================================================================

/**
 * 初始化日志系统
 */
function initLogger(): void {
  if (!existsSync(ACTIONS_LOG_DIR)) {
    mkdirSync(ACTIONS_LOG_DIR, { recursive: true })
  }
}

// ============================================================================
// Action Logging
// ============================================================================

/**
 * 记录操作
 * @param action - 操作信息
 * @returns 日志条目
 */
export function logAction(action: ActionInput): ActionLogEntry {
  initLogger()
  
  const logEntry: ActionLogEntry = {
    timestamp: new Date().toISOString(),
    type: action.type,
    description: action.description,
    details: action.details || {},
    dryRun: action.dryRun || false
  }
  
  // 写入日志文件
  const logLine = JSON.stringify(logEntry) + '\n'
  appendFileSync(ACTIONS_LOG_FILE, logLine, 'utf-8')
  
  // 更新摘要
  updateSummary(logEntry)
  
  return logEntry
}

/**
 * 更新摘要统计
 * @param logEntry - 日志条目
 */
function updateSummary(logEntry: ActionLogEntry): void {
  let summary: ActionSummary = {
    totalActions: 0,
    actionsByType: {},
    firstAction: null,
    lastAction: null,
    dryRunMode: false
  }
  
  // 读取现有摘要
  if (existsSync(ACTIONS_SUMMARY_FILE)) {
    try {
      summary = JSON.parse(readFileSync(ACTIONS_SUMMARY_FILE, 'utf-8'))
    } catch (error) {
      // 忽略解析错误，使用默认值
    }
  }
  
  // 更新统计
  summary.totalActions++
  summary.actionsByType[logEntry.type] = (summary.actionsByType[logEntry.type] || 0) + 1
  
  if (!summary.firstAction) {
    summary.firstAction = logEntry.timestamp
  }
  summary.lastAction = logEntry.timestamp
  
  if (logEntry.dryRun) {
    summary.dryRunMode = true
  }
  
  // 保存摘要
  writeFileSync(ACTIONS_SUMMARY_FILE, JSON.stringify(summary, null, 2), 'utf-8')
}

// ============================================================================
// Summary Retrieval
// ============================================================================

/**
 * 获取操作摘要
 * @returns 操作摘要统计
 */
export function getActionSummary(): ActionSummary | null {
  if (!existsSync(ACTIONS_SUMMARY_FILE)) {
    return null
  }
  
  try {
    return JSON.parse(readFileSync(ACTIONS_SUMMARY_FILE, 'utf-8'))
  } catch (error) {
    return null
  }
}

/**
 * 获取最近的操作
 * @param count - 返回数量（默认10）
 * @returns 操作日志条目数组
 */
export function getRecentActions(count: number = 10): ActionLogEntry[] {
  if (!existsSync(ACTIONS_LOG_FILE)) {
    return []
  }
  
  try {
    const content = readFileSync(ACTIONS_LOG_FILE, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const recentLines = lines.slice(-count)
    
    return recentLines.map(line => JSON.parse(line))
  } catch (error) {
    return []
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * CLI 入口
 * @param argv - 命令行参数
 */
async function main(argv: string[] = process.argv): Promise<void> {
  const args = argv.slice(2)
  const command = args[0]
  
  if (command === 'summary') {
    const summary = getActionSummary()
    if (summary) {
      console.log('\n📊 Actions Summary:')
      console.log(`   Total Actions: ${summary.totalActions}`)
      console.log(`   First Action: ${summary.firstAction || 'N/A'}`)
      console.log(`   Last Action: ${summary.lastAction || 'N/A'}`)
      console.log(`   Dry Run Mode: ${summary.dryRunMode ? 'Yes' : 'No'}`)
      console.log('\n   Actions by Type:')
      for (const [type, count] of Object.entries(summary.actionsByType)) {
        console.log(`     ${type}: ${count}`)
      }
    } else {
      console.log('No action summary available.')
    }
  } else if (command === 'recent') {
    const count = parseInt(args[1] || '10', 10)
    const actions = getRecentActions(count)
    
    console.log(`\n📜 Recent ${count} Actions:`)
    for (const action of actions) {
      console.log(`   [${action.timestamp}] ${action.type}: ${action.description}`)
      if (action.dryRun) {
        console.log('     (Dry Run)')
      }
    }
  } else {
    console.log(`
Usage:
  node action-logger.js summary   - Show action summary
  node action-logger.js recent [n] - Show recent n actions (default: 10)
    `.trim())
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
