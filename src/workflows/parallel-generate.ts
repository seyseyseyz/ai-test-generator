#!/usr/bin/env node
/**
 * 并行测试生成（Phase 2 - v2.4.0）
 * 
 * 使用 p-limit 实现并发生成，2-3x 速度提升。
 * 
 * 策略:
 * 1. 将 TODO 函数分组（按文件或固定大小）
 * 2. 并发生成多个批次（控制并发数）
 * 3. 独立的 Prompt → AI → Extract → Test 流程
 * 4. 汇总结果并更新报告
 * 
 * 参考:
 * - Qodo Cover 的并行生成策略
 * - AutoTestGen 的批处理优化
 * 
 * @module parallel-generate
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pLimit from 'p-limit'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '../..')

// 并发控制配置
const CONCURRENCY_CONFIG = {
  default: 3,      // 默认并发数
  maxConcurrency: 5, // 最大并发数（避免 API 限流）
  minBatchSize: 3,  // 最小批次大小
  maxBatchSize: 10  // 最大批次大小
}

/**
 * 辅助函数：运行子进程
 */
function sh(cmd: string, args: string[], options: any): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const stdio: any = options.captureStdout ? ['inherit', 'pipe', 'inherit'] : 'inherit'
    const child: any = spawn(cmd, args, { 
      stdio, 
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    })
    
    const chunks: Buffer[] = []
    if (options.captureStdout) {
      child.stdout.on('data', (d: Buffer) => chunks.push(d))
    }
    
    child.on('close', (code: number) => {
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

/**
 * 读取 TODO 函数列表
 */
function readTodoFunctions(reportPath: string, priority: string | null): any[] {
  if (!existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`)
  }
  
  const content = readFileSync(reportPath, 'utf-8')
  const lines = content.split('\n')
  
  const todoFunctions = []
  for (const line of lines) {
    if (!line.includes('| TODO |')) continue
    
    if (priority && !line.includes(`| ${priority} |`)) continue
    
    const parts = line.split('|').map(p => p.trim()).filter(Boolean)
    if (parts.length >= 7) {
      const [_status, score, pri, name, type, layer, path] = parts
      todoFunctions.push({
        name: (name || '').toString(),
        path: (path || '').toString(),
        score: parseFloat(score || '0'),
        priority: (pri || '').toString(),
        type: (type || '').toString(),
        layer: (layer || '').toString()
      })
    }
  }
  
  // 按分数降序排序
  if (!priority) {
    todoFunctions.sort((a, b) => b.score - a.score)
  }
  
  return todoFunctions
}

/**
 * 将函数分组为批次
 * 
 * 策略:
 * - 按文件分组（同一文件的函数放在一起，提高上下文效率）
 * - 控制批次大小在合理范围内
 */
function groupIntoBatches(functions: any[], options: any = {}): any[] {
  const { minBatchSize, maxBatchSize } = { ...CONCURRENCY_CONFIG, ...options }
  
  // 按文件分组
  const byFile: any = {}
  for (const func of functions) {
    if (!byFile[func.path]) {
      byFile[func.path] = []
    }
    byFile[func.path].push(func)
  }
  
  // 转换为批次列表
  const batches: any[] = []
  for (const filePath in byFile) {
    const fileFunctions = byFile[filePath]
    
    // 如果一个文件的函数太多，拆分成多个批次
    if (fileFunctions.length > maxBatchSize) {
      for (let i = 0; i < fileFunctions.length; i += maxBatchSize) {
        batches.push(fileFunctions.slice(i, i + maxBatchSize))
      }
    } else {
      batches.push(fileFunctions)
    }
  }
  
  // 合并过小的批次
  const finalBatches = []
  let currentBatch = []
  
  for (const batch of batches) {
    currentBatch.push(...batch)
    
    if (currentBatch.length >= minBatchSize) {
      finalBatches.push(currentBatch)
      currentBatch = []
    }
  }
  
  // 处理剩余的函数
  if (currentBatch.length > 0) {
    if (finalBatches.length > 0 && currentBatch.length < minBatchSize) {
      // 合并到最后一个批次
      const lastBatch = finalBatches[finalBatches.length - 1]
      if (lastBatch) lastBatch.push(...currentBatch)
    } else {
      finalBatches.push(currentBatch)
    }
  }
  
  return finalBatches
}

/**
 * 生成单个批次的测试
 * 
 * 每个批次独立运行：
 * 1. 生成 Prompt
 * 2. 调用 AI
 * 3. 提取测试
 * 4. 运行 Jest
 */
async function generateBatch(batch: any[], batchIndex: number, options: any = {}): Promise<any> {
  const { reportPath, workDir, config: _config } = options
  
  console.log(`\n🔄 [Batch ${batchIndex + 1}] Generating ${batch.length} functions...`)
  console.log(`   Files: ${[...new Set(batch.map((f: any) => f.path))].join(', ')}`)
  
  const batchDir = join(workDir, `batch_${batchIndex}`)
  mkdirSync(batchDir, { recursive: true })
  
  const result = {
    batchIndex,
    total: batch.length,
    success: [] as string[],
    failed: [] as string[],
    error: null as any
  }
  
  try {
    // 1. 生成 Prompt（只包含这个批次的函数）
    const promptArgs = [
      join(PKG_ROOT, 'lib/ai/prompt-builder.mjs'),
      '--report', reportPath,
      '--only-todo'
    ]
    
    // 写入批次函数列表
    const batchListPath = join(batchDir, 'functions.txt')
    writeFileSync(batchListPath, batch.map(f => f.name).join('\n'), 'utf-8')
    promptArgs.push('--function-list', batchListPath)
    
    let promptText: string | null = null
    try {
      // const _hintsFile = join(batchDir, 'hints.txt')
      if (existsSync('reports/hints.txt')) {
        promptText = await sh('node', [...promptArgs, '--hints-file', 'reports/hints.txt'], { 
          captureStdout: true,
          cwd: process.cwd()
        })
      } else {
        promptText = await sh('node', promptArgs, { captureStdout: true })
      }
    } catch (err) {
      promptText = await sh('node', promptArgs, { captureStdout: true })
    }
    
    const promptPath = join(batchDir, 'prompt.txt')
    writeFileSync(promptPath, promptText || '', 'utf-8')
    
    // 2. 调用 AI
    const aiResponsePath = join(batchDir, 'ai_response.txt')
    await sh('node', [
      join(PKG_ROOT, 'lib/ai/client.mjs'),
      '--prompt', promptPath,
      '--out', aiResponsePath
    ], { captureStdout: false, cwd: process.cwd(), env: {} })
    
    // 3. 提取测试
    await sh('node', [
      join(PKG_ROOT, 'lib/ai/extractor.mjs'),
      aiResponsePath,
      '--overwrite'
    ], { captureStdout: false, cwd: process.cwd(), env: {} })
    
    // 4. 运行 Jest（只针对这个批次的测试文件）
    const testFiles = [...new Set(batch.map((f: any) => (f.path || '').replace(/\.(ts|tsx|js|jsx)$/i, (m: string) => `.test${m}`)))]
    
    try {
      await sh('npm', ['test', '--', ...testFiles], { captureStdout: false, cwd: process.cwd(), env: {} })
      result.success = batch.map((f: any) => f.name) as string[]
      console.log(`✅ [Batch ${batchIndex + 1}] All tests passed`)
    } catch (err: any) {
      // 即使测试失败也继续（会在后续分析中处理）
      console.warn(`⚠️  [Batch ${batchIndex + 1}] Some tests failed`)
      result.failed = batch.map((f: any) => f.name) as string[]
    }
    
  } catch (err: any) {
    const error = err as Error
    console.error(`❌ [Batch ${batchIndex + 1}] Failed:`, error?.message || String(err))
    result.error = error?.message || String(err)
    result.failed = batch.map((f: any) => f.name) as string[]
  }
  
  return result
}

/**
 * 标记函数状态
 */
function updateFunctionStatus(reportPath: string, functionNames: string[], status: string): void {
  if (!existsSync(reportPath)) return
  
  let content = readFileSync(reportPath, 'utf-8')
  
  for (const name of functionNames) {
    if (!name) continue
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line?.includes(`| ${name} |`) && line.includes('| TODO |')) {
        lines[i] = line.replace('| TODO |', `| ${status} |`)
      }
    }
    content = lines.join('\n')
  }
  
  writeFileSync(reportPath, content, 'utf-8')
}

/**
 * 主函数：并行生成测试
 */
export async function parallelGenerate(options: any = {}): Promise<void> {
  const reportPath: string = (options.reportPath as string) || 'reports/ut_scores.md'
  const priority: string | null = (options.priority as string) || null
  const count: number | null = (options.count as number) || null
  const concurrency: number = (options.concurrency as number) || CONCURRENCY_CONFIG.default
  
  console.log('🚀 Parallel Test Generation (v2.4.0)\n')
  console.log(`📊 Configuration:`)
  console.log(`   - Concurrency: ${concurrency}`)
  console.log(`   - Report: ${reportPath}`)
  if (priority) console.log(`   - Priority: ${priority}`)
  if (count) console.log(`   - Max functions: ${count}`)
  console.log()
  
  // 1. 读取 TODO 函数
  console.log('📋 Reading TODO functions...')
  let todoFunctions = readTodoFunctions(reportPath, priority)
  
  if (count) {
    todoFunctions = todoFunctions.slice(0, count)
  }
  
  if (todoFunctions.length === 0) {
    console.log('✅ No TODO functions found')
    return
  }
  
  console.log(`   Found ${todoFunctions.length} TODO functions\n`)
  
  // 2. 分组为批次
  console.log('📦 Grouping into batches...')
  const batches = groupIntoBatches(todoFunctions, {
    minBatchSize: CONCURRENCY_CONFIG.minBatchSize,
    maxBatchSize: CONCURRENCY_CONFIG.maxBatchSize
  })
  
  console.log(`   Created ${batches.length} batches`)
  for (let i = 0; i < batches.length; i++) {
    console.log(`   - Batch ${i + 1}: ${batches[i].length} functions`)
  }
  console.log()
  
  // 3. 创建工作目录
  const workDir = 'reports/parallel_batches'
  mkdirSync(workDir, { recursive: true })
  
  // 4. 并行生成（使用 p-limit 控制并发）
  console.log(`⚡ Starting parallel generation (${concurrency} concurrent batches)...\n`)
  
  const limit = pLimit(concurrency)
  const startTime = Date.now()
  
  const results = await Promise.all(
    batches.map((batch, index) =>
      limit(() => generateBatch(batch, index, { reportPath, workDir }))
    )
  )
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  
  // 5. 汇总结果
  console.log('\n\n📊 Generation Summary:')
  console.log('=' .repeat(60))
  
  const summary = {
    total: todoFunctions.length,
    success: 0,
    failed: 0,
    batches: results.length,
    duration,
    throughput: 0
  }
  
  const allSuccess = []
  const allFailed = []
  
  for (const result of results) {
    summary.success += result.success.length
    summary.failed += result.failed.length
    allSuccess.push(...result.success)
    allFailed.push(...result.failed)
  }
  
  summary.throughput = parseFloat((summary.total / parseFloat(duration)).toFixed(2))
  
  console.log(`Total functions: ${summary.total}`)
  console.log(`✅ Success: ${summary.success}`)
  console.log(`❌ Failed: ${summary.failed}`)
  console.log(`⏱️  Duration: ${summary.duration}s`)
  console.log(`📈 Throughput: ${summary.throughput} functions/sec`)
  console.log('=' .repeat(60))
  
  // 6. 更新报告状态
  if (allSuccess.length > 0) {
    console.log(`\n✏️  Marking ${allSuccess.length} functions as DONE...`)
    updateFunctionStatus(reportPath, allSuccess, 'DONE')
  }
  
  if (allFailed.length > 0) {
    console.log(`⚠️  ${allFailed.length} functions remain as TODO (will retry next time)`)
  }
  
  // 7. 保存详细报告
  const detailedReport = {
    timestamp: new Date().toISOString(),
    config: {
      concurrency,
      priority,
      count,
      batchCount: batches.length
    },
    summary,
    batches: results
  }
  
  const reportJson = join(workDir, 'parallel_report.json')
  writeFileSync(reportJson, JSON.stringify(detailedReport, null, 2), 'utf-8')
  console.log(`\n💾 Detailed report saved: ${reportJson}`)
  
  console.log('\n🎉 Parallel generation completed!')
}

/**
 * CLI 入口（如果直接运行此文件）
 */
async function main(argv = process.argv) {
  const args = argv.slice(2)
  
  interface MainOptions {
    reportPath?: string
    priority?: string | null
    count?: number | null
    concurrency?: number
  }
  
  const options: MainOptions = {
    reportPath: 'reports/ut_scores.md',
    priority: null,
    count: null,
    concurrency: CONCURRENCY_CONFIG.default
  }
  
  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p' || args[i] === '--priority') {
      options.priority = args[++i] || null
    } else if (args[i] === '-n' || args[i] === '--count') {
      options.count = parseInt(args[++i] || '10')
    } else if (args[i] === '-c' || args[i] === '--concurrency') {
      options.concurrency = Math.min(parseInt(args[++i] || '3'), CONCURRENCY_CONFIG.maxConcurrency)
    } else if (args[i] === '--report') {
      options.reportPath = args[++i] || 'reports/ut_scores.md'
    }
  }
  
  try {
    await parallelGenerate(options)
  } catch (err: any) {
    const error = err as Error
    console.error('❌ Parallel generation failed:', error?.message || String(err))
    process.exit(1)
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: any) => {
    const error = err as Error
    console.error('❌ Fatal error:', error?.message || String(err))
    process.exit(1)
  })
}

