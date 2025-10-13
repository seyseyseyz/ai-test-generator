#!/usr/bin/env node
/**
 * 解析 reports/jest-report.json，提取失败原因并分类
 * 输出一个简要的提示文本，可注入下一轮 Prompt
 */

import { readFileSync, existsSync } from 'fs'

export function analyze(path = 'reports/jest-report.json') {
  if (!existsSync(path)) return { summary: 'No jest-report.json', total: 0, failed: 0, hints: [] }
  const json = JSON.parse(readFileSync(path, 'utf8'))
  const testResults = json.testResults || []
  const hints = []
  let total = 0, failed = 0

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

export function runCLI(argv = process.argv) {
  const path = argv[2] || 'reports/jest-report.json'
  const res = analyze(path)
  console.log(JSON.stringify(res, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) runCLI()


