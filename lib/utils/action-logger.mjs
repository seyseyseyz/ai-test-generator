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

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ACTIONS_LOG_DIR = 'reports/actions'
const ACTIONS_LOG_FILE = join(ACTIONS_LOG_DIR, 'actions.log')
const ACTIONS_SUMMARY_FILE = join(ACTIONS_LOG_DIR, 'summary.json')

/**
 * 操作类型
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
}

/**
 * 初始化日志系统
 */
function initLogger() {
  if (!existsSync(ACTIONS_LOG_DIR)) {
    mkdirSync(ACTIONS_LOG_DIR, { recursive: true })
  }
}

/**
 * 记录操作
 */
export function logAction(action) {
  initLogger()
  
  const logEntry = {
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
 */
function updateSummary(logEntry) {
  let summary = {
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
    } catch {
      // 使用默认摘要
    }
  }
  
  // 更新统计
  summary.totalActions++
  summary.actionsByType[logEntry.type] = (summary.actionsByType[logEntry.type] || 0) + 1
  summary.lastAction = logEntry.timestamp
  summary.dryRunMode = logEntry.dryRun || summary.dryRunMode
  
  if (!summary.firstAction) {
    summary.firstAction = logEntry.timestamp
  }
  
  // 写回摘要
  writeFileSync(ACTIONS_SUMMARY_FILE, JSON.stringify(summary, null, 2), 'utf-8')
}

/**
 * 读取操作日志
 */
export function readActionLog() {
  if (!existsSync(ACTIONS_LOG_FILE)) {
    return []
  }
  
  const content = readFileSync(ACTIONS_LOG_FILE, 'utf-8')
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(entry => entry !== null)
}

/**
 * 读取摘要统计
 */
export function readSummary() {
  if (!existsSync(ACTIONS_SUMMARY_FILE)) {
    return null
  }
  
  try {
    return JSON.parse(readFileSync(ACTIONS_SUMMARY_FILE, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * 清空日志（用于测试或重置）
 */
export function clearLog() {
  if (existsSync(ACTIONS_LOG_FILE)) {
    writeFileSync(ACTIONS_LOG_FILE, '', 'utf-8')
  }
  if (existsSync(ACTIONS_SUMMARY_FILE)) {
    writeFileSync(ACTIONS_SUMMARY_FILE, JSON.stringify({
      totalActions: 0,
      actionsByType: {},
      firstAction: null,
      lastAction: null,
      dryRunMode: false
    }, null, 2), 'utf-8')
  }
}

/**
 * 生成日志报告（人类可读）
 */
export function generateReport() {
  const logs = readActionLog()
  const summary = readSummary()
  
  if (!summary) {
    return 'No actions logged yet.'
  }
  
  let report = `📊 Actions Log Report\n`
  report += `${'='.repeat(50)}\n\n`
  
  report += `Total Actions: ${summary.totalActions}\n`
  report += `First Action: ${summary.firstAction}\n`
  report += `Last Action: ${summary.lastAction}\n`
  report += `Dry Run Mode: ${summary.dryRunMode ? 'Yes ✅' : 'No'}\n\n`
  
  report += `Actions by Type:\n`
  Object.entries(summary.actionsByType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      report += `  - ${type}: ${count}\n`
    })
  
  report += `\n${'='.repeat(50)}\n`
  report += `Recent Actions (last 10):\n\n`
  
  logs.slice(-10).forEach((log, idx) => {
    report += `${idx + 1}. [${log.type}] ${log.description}\n`
    report += `   Time: ${log.timestamp}\n`
    if (log.dryRun) report += `   Mode: DRY RUN ⚠️\n`
    if (Object.keys(log.details).length > 0) {
      report += `   Details: ${JSON.stringify(log.details, null, 2).split('\n').join('\n   ')}\n`
    }
    report += `\n`
  })
  
  return report
}

/**
 * Dry-run 辅助函数
 */
export function isDryRun() {
  return process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run')
}

/**
 * 执行操作（支持 dry-run）
 */
export async function executeAction(action, fn) {
  const dryRun = isDryRun()
  
  logAction({
    type: action.type,
    description: action.description,
    details: action.details,
    dryRun
  })
  
  if (dryRun) {
    console.log(`🔍 [DRY RUN] Would execute: ${action.description}`)
    return { dryRun: true, skipped: true }
  }
  
  return await fn()
}

