#!/usr/bin/env node
/**
 * 单批次：生成 prompt → 调用 AI → 提取测试 → 运行 Jest → 自动标记状态
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgRoot = join(__dirname, '../..')

function sh(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const stdio = options.captureStdout ? ['inherit', 'pipe', 'inherit'] : 'inherit'
    const child = spawn(cmd, args, { stdio, cwd: process.cwd() })
    
    const chunks = []
    if (options.captureStdout) {
      child.stdout.on('data', d => chunks.push(Buffer.from(d)))
    }
    
    child.on('close', code => {
      if (code === 0) {
        const output = options.captureStdout ? Buffer.concat(chunks).toString('utf8') : null
        resolve(output)
      } else {
        reject(new Error(`${cmd} exited ${code}`))
      }
    })
    child.on('error', reject)
  })
}

function readCoverageSummary() {
  const path = 'coverage/coverage-summary.json'
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function getCoveragePercent(summary) {
  if (!summary || !summary.total) return 0
  return summary.total.lines?.pct ?? 0
}

/**
 * 从报告中读取 TODO 函数列表
 */
function readTodoFunctions(reportPath: string, priority: any, limit: number) {
  if (!existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`)
  }
  
  const content = readFileSync(reportPath, 'utf-8')
  const lines = content.split('\n')
  
  const todoFunctions = []
  for (const line of lines) {
    if (!line.includes('| TODO |')) continue
    
    // 如果指定了 priority，只匹配该 priority；否则接受所有
    if (priority && !line.includes(`| ${priority} |`)) continue
    
    // 解析表格行: | Status | Score | Priority | Name | Type | Layer | Path | ...
    const parts = line.split('|').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 7) {
      const [status, score, pri, name, type, layer, path] = parts
      todoFunctions.push({
        name,
        path,
        score: parseFloat(score),
        priority: pri
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
    // 查找包含该函数名且状态为 TODO 的行，替换为 DONE
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`| ${name} |`) && lines[i].includes('| TODO |')) {
        lines[i] = lines[i].replace('| TODO |', '| DONE |')
      }
    }
    content = lines.join('\n')
  }
  
  writeFileSync(reportPath, content, 'utf-8')
}

async function main(argv: any = process.argv) {
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
    const priorityMsg = priority ? `${priority} ` : ''
    console.log(`✅ No TODO functions found${priority ? ` for ${priority}` : ''}`)
    return
  }
  
  console.log(`📝 Found ${todoFunctions.length} TODO functions`)
  
  // 记录初始覆盖率
  const beforeCov = getCoveragePercent(readCoverageSummary())

  // 1) 生成 Prompt（只针对 TODO 函数，加入上一轮失败提示）
  const promptArgs = [
    join(pkgRoot, 'lib/ai/prompt-builder.mjs'),
    '--report', reportPath
  ]
  
  // 只有当 priority 存在时才添加 -p 参数
  if (priority) {
    promptArgs.push('-p', priority)
  }
  
  promptArgs.push('-n', String(limit))
  promptArgs.push('--skip', String(skip))
  promptArgs.push('--only-todo') // 新增：只处理 TODO 状态
  
  let promptText
  try {
    promptText = await sh('node', [...promptArgs, '--hints-file', 'reports/hints.txt'], { captureStdout: true })
  } catch {
    promptText = await sh('node', promptArgs, { captureStdout: true })
  }
  
  // 写入 prompt.txt
  writeFileSync('prompt.txt', promptText, 'utf-8')

  // 2) 调用 AI
  console.log('\n🤖 Calling AI...')
  await sh('node', [join(pkgRoot, 'lib/ai/client.mjs'), '--prompt', 'prompt.txt', '--out', 'reports/ai_response.txt'])

  // 3) 提取测试
  console.log('\n📦 Extracting tests...')
  await sh('node', [join(pkgRoot, 'lib/ai/extractor.mjs'), 'reports/ai_response.txt', '--overwrite'])

  // 4) 运行 Jest（按优先级自适应重跑）
  console.log('\n🧪 Running tests...')
  const reruns = priority === 'P0' ? 1 : 0
  let testsPassed = false
  
  for (let i = 0; i < Math.max(1, reruns + 1); i++) {
    try {
      await sh('node', [join(pkgRoot, 'lib/testing/runner.mjs')])
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
    const afterCov = getCoveragePercent(readCoverageSummary())
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
  const { spawn: spawnLocal } = await import('child_process')
  const { writeFileSync: writeFileSyncLocal } = await import('fs')
  await new Promise((resolve) => {
    const child = spawnLocal('node', [join(pkgRoot, 'lib/testing/analyzer.mjs')], { stdio: ['inherit','pipe','inherit'] })
    const chunks = []
    child.stdout.on('data', d => chunks.push(Buffer.from(d)))
    child.on('close', () => {
      try {
        const obj = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (obj.hints?.length) {
          writeFileSyncLocal('reports/hints.txt', `# 上一轮失败修复建议\n- ${obj.hints.join('\n- ')}`)
          console.log(`💡 Saved ${obj.hints.length} hints for next run`)
        }
      } catch {}
      resolve()
    })
  })

  console.log('\n✅ Batch completed!')
}

main().catch(err => {
  console.error('❌ Batch failed:', err.message)
  process.exit(1)
})
