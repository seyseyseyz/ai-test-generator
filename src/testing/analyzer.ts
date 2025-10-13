#!/usr/bin/env node
/**
 * 解析 reports/jest-report.json，提取失败原因并分类
 * 输出一个简要的提示文本，可注入下一轮 Prompt
 */

import { readFileSync, existsSync } from 'node:fs'

// ============================================================================
// Type Definitions
// ============================================================================

/** Test analysis result */
export interface AnalysisResult {
  summary: string
  total: number
  failed: number
  hints: string[]
}

// ============================================================================
// Analysis Function
// ============================================================================

/**
 * 分析 Jest 测试报告
 * @param path - Jest 报告 JSON 文件路径
 * @returns 分析结果
 */
export function analyze(path: string = 'reports/jest-report.json'): AnalysisResult {
  if (!existsSync(path)) return { summary: 'No jest-report.json', total: 0, failed: 0, hints: [] }
  
  const json = JSON.parse(readFileSync(path, 'utf8'))
  const testResults = json.testResults || []
  const hints: string[] = []
  let total = 0
  let failed = 0

  for (const f of testResults) {
    for (const a of (f.assertionResults || [])) {
      total++
      if (a.status === 'failed') failed++
    }
    for (const msg of (f.message ? [f.message] : [])) {
      const m = String(msg)
      if (m.includes('Cannot find module')) hints.push('修正导入路径或添加模块别名')
      if (m.includes('TypeError')) hints.push('检查被测函数或 mock 是否返回预期类型')
      if (m.includes('Timed out')) hints.push('为异步/计时器逻辑添加等待与 fakeTimers')
      if (m.includes('not found') && m.includes('element')) hints.push('使用稳定的查询方式，如 getByRole/LabelText/TestId')
    }
  }

  const uniqueHints = Array.from(new Set(hints))
  const summary = `总断言: ${total}, 失败: ${failed}, 建议: ${uniqueHints.join('；')}`
  return { summary, total, failed, hints: uniqueHints }
}

/**
 * CLI 入口
 * @param argv - 命令行参数
 */
export function runCLI(argv: string[] = process.argv): void {
  const path = argv[2] || 'reports/jest-report.json'
  const res = analyze(path)
  console.log(JSON.stringify(res, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) runCLI()
