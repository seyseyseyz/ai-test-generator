#!/usr/bin/env node
/**
 * 单批次：生成 prompt → 调用 AI → 提取测试 → 运行 Jest → 自动标记状态
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnCommand } from '../shared/process-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgRoot = join(__dirname, '../..')

/**
 * 覆盖率汇总接口
 */
interface CoverageSummary {
  total?: {
    lines?: { pct?: number }
    statements?: { pct?: number }
    functions?: { pct?: number }
    branches?: { pct?: number }
  }
}

function readCoverageSummary(): CoverageSummary | null {
  const path = 'coverage/coverage-summary.json'
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) as CoverageSummary } catch { return null }
}

function getCoveragePercent(summary: CoverageSummary | null): number {
  if (!summary || !summary.total) return 0
  return summary.total.lines?.pct ?? 0
}

/**
 * TODO函数信息接口
 */
interface TodoFunction {
  name: string
  path: string
  score: number
  priority: string
}

/**
 * 从报告中读取 TODO 函数列表
 */
function readTodoFunctions(reportPath: string, priority: string | null, limit: number): TodoFunction[] {
  if (!existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`)
  }
  
  const content = readFileSync(reportPath, 'utf-8')
  const lines = content.split('\n')
  
  const todoFunctions: TodoFunction[] = []
  for (const line of lines) {
    if (!line.includes('| TODO |')) continue
    
    // 如果指定了 priority，只匹配该 priority；否则接受所有
    if (priority && !line.includes(`| ${priority} |`)) continue
    
    // 解析表格行: | Status | Score | Priority | Name | Type | Layer | Path | ...
    const parts = line.split('|').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 7) {
      const [_status, score, pri, name, _type, _layer, path] = parts
      todoFunctions.push({
        name: (name || '').toString(),
        path: (path || '').toString(),
        score: parseFloat(score || '0'),
        priority: (pri || '').toString()
      })
    }
  }
  
  // 如果没有指定 priority，按分数降序排序
  if (!priority) {
    todoFunctions.sort((a, b) => b.score - a.score)
  }
  
  return todoFunctions.slice(0, limit)
}

/**
 * 标记函数状态为 DONE
 */
function markFunctionsDone(reportPath: string, functionNames: string[]) {
  if (!existsSync(reportPath)) return
  
  let content = readFileSync(reportPath, 'utf-8')
  
  for (const name of functionNames) {
    if (!name) continue
    // 查找包含该函数名且状态为 TODO 的行，替换为 DONE
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line?.includes(name) && line.includes('| TODO |')) {
        lines[i] = line.replace('| TODO |', '| DONE |')
      }
    }
    content = lines.join('\n')
  }
  
  writeFileSync(reportPath, content, 'utf-8')
}

async function main(argv: string[] = process.argv): Promise<void> {
  const args = argv.slice(2)
  const priority = args[0] && args[0] !== 'undefined' ? args[0] : null
  const limit = Number(args[1] || 10)
  const skip = Number(args[2] || 0)
  const reportPath = args[3] || 'reports/ut_scores.md'
  const minCovDelta = priority === 'P0' ? 2 : (priority === 'P1' ? 1 : 0)

  // 读取 TODO 函数列表（跳过 DONE）
  console.log(`📋 Reading TODO functions from ${reportPath}...`)
  const todoFunctions = readTodoFunctions(reportPath, priority, limit)
  
  if (todoFunctions.length === 0) {
    console.log(`✅ No TODO functions found${priority ? ` for ${priority}` : ''}`)
    return
  }
  
  console.log(`📝 Found ${todoFunctions.length} TODO functions`)
  
  // 记录初始覆盖率
  const summary = readCoverageSummary()
  const beforeCov = summary ? getCoveragePercent(summary) : 0
  console.log(`📊 Initial coverage: ${beforeCov.toFixed(2)}%`)

  // 1) 生成 Prompt（只针对 TODO 函数，加入上一轮失败提示）
  const promptArgs = [
    join(pkgRoot, 'dist/ai/prompt-builder.js'),
    '--report', reportPath
  ]
  
  // 只有当 priority 存在时才添加 -p 参数
  if (priority) {
    promptArgs.push('-p', priority)
  }
  
  promptArgs.push('-n', String(limit))
  promptArgs.push('--skip', String(skip))
  promptArgs.push('--only-todo') // 新增：只处理 TODO 状态
  
    let promptText: string
    try {
      promptText = (await spawnCommand('node', promptArgs, { captureStdout: true })) as string
    } catch (err: unknown) {
      const error = err as Error
      console.error('❌ Failed to generate prompt:', error?.message || String(err))
      return
    }
  
  // 写入 prompt.txt
  writeFileSync('prompt.txt', promptText)

  // 2) 调用 AI
  console.log('\n🤖 Calling AI...')
  await spawnCommand('node', [join(pkgRoot, 'dist/ai/client.js'), '--prompt', 'prompt.txt'], { captureStdout: true })

  // 3) 提取测试
  console.log('\n📦 Extracting tests...')
  await spawnCommand('node', [join(pkgRoot, 'dist/ai/extractor.js'), 'reports/ai_response.txt', '--overwrite'])

  // 4) 运行 Jest（按优先级自适应重跑）
  console.log('\n🧪 Running tests...')
  const reruns = priority === 'P0' ? 1 : 0
  let testsPassed = false
  
  for (let i = 0; i < Math.max(1, reruns + 1); i++) {
    try {
      await spawnCommand('node', [join(pkgRoot, 'dist/testing/runner.js')])
      testsPassed = true
      break
    } catch {
      if (i === reruns) {
        console.warn('⚠️  Tests failed after retries')
      }
    }
  }

  // 5) 校验覆盖率增量
  if (minCovDelta > 0) {
    const afterSummary = readCoverageSummary()
    const afterCov = afterSummary ? getCoveragePercent(afterSummary) : 0
    const delta = afterCov - beforeCov
    if (delta < minCovDelta) {
      console.warn(`⚠️  Coverage delta ${delta.toFixed(2)}% < required ${minCovDelta}% (before: ${beforeCov.toFixed(2)}%, after: ${afterCov.toFixed(2)}%)`)
    } else {
      console.log(`✅ Coverage improved: ${beforeCov.toFixed(2)}% → ${afterCov.toFixed(2)}% (+${delta.toFixed(2)}%)`)
    }
  }

  // 6) 自动标记 DONE（如果测试通过）
  if (testsPassed) {
    console.log('\n✏️  Marking functions as DONE...')
    const functionNames = todoFunctions.map(f => f.name)
    markFunctionsDone(reportPath, functionNames)
    console.log(`✅ Marked ${functionNames.length} functions as DONE`)
  } else {
    console.log('\n⚠️  Tests failed, keeping functions as TODO for retry')
  }

  // 7) 失败分析并落盘 hints（用于下次重试）
  console.log('\n🔍 Analyzing failures...')
  const { spawn: spawnLocal } = await import('node:child_process')
  const { writeFileSync: writeFileSyncLocal } = await import('node:fs')
  await new Promise<void>((resolve) => {
    const child = spawnLocal('node', [join(pkgRoot, 'dist/testing/analyzer.js')], { stdio: ['inherit','pipe','inherit'] })
    const chunks: Buffer[] = []
    if (child.stdout) {
      child.stdout.on('data', (d: Buffer) => chunks.push(d))
    }
    child.on('close', () => {
      try {
        const obj = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (obj.hints?.length) {
          writeFileSyncLocal('reports/hints.txt', `# 上一轮失败修复建议\n- ${obj.hints.join('\n- ')}`)
          console.log(`💡 Saved ${obj.hints.length} hints for next run`)
        }
      } catch {
        // Ignore JSON parse errors
      }
      resolve()
    })
    child.on('error', () => resolve())
  })

  console.log('\n✅ Batch completed!')
}

main().catch(err => {
  console.error('❌ Batch failed:', err.message)
  process.exit(1)
})
