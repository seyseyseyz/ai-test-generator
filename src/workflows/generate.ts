// @ts-nocheck
/**
 * Generate 工作流：生成单元测试
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { iterativeImprove } from './iterative-improve.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '../..')

/**
 * 生成单批测试
 */
async function generateBatch(priority, count, skip, report) {
  const batchScript = join(PKG_ROOT, 'lib/workflows/batch.mjs')
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [batchScript, priority, String(count), String(skip), report], {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ generated: count, passed: count })
      } else {
        reject(new Error(`Batch generation failed with code ${code}`))
      }
    })
    
    child.on('error', reject)
  })
}

/**
 * Generate 工作流
 */
export async function generate(options) {
  const { count, priority, all, report, iterative, maxIterations, samples } = options
  
  // 1. 检查报告是否存在
  if (!existsSync(report)) {
    console.error(`❌ Report not found: ${report}`)
    console.log(`   Run: ai-test scan`)
    process.exit(1)
  }
  
  // 🔄 如果启用迭代模式，使用 Meta TestGen-LLM 风格的迭代改进
  if (iterative) {
    console.log('🔄 Iterative improvement mode enabled (Meta TestGen-LLM style)\n')
    try {
      await iterativeImprove({
        reportPath: report,
        maxIterations: maxIterations || 3,
        samplesPerIteration: samples || 1  // 🆕 N-Sample Generation
      })
    } catch (err) {
      console.error('❌ Iterative improvement failed:', err.message)
      process.exit(1)
    }
    return
  }
  
  if (all) {
    // 2. 持续生成直到所有 TODO 完成
    const priorityMsg = priority ? `${priority} ` : ''
    console.log(`🚀 Generating all ${priorityMsg}TODO functions...\n`)
    
    let batchNum = 1
    let totalGenerated = 0
    let totalPassed = 0
    
    while (true) {
      // 检查还有多少 TODO
      const content = readFileSync(report, 'utf-8')
      const lines = content.split('\n')
      const todoLines = lines.filter(line => {
        if (!line.includes('| TODO |')) return false
        // 如果指定了 priority，只匹配该 priority
        if (priority && !line.includes(`| ${priority} |`)) return false
        return true
      })
      
      if (todoLines.length === 0) {
        console.log(`\n✅ All ${priorityMsg}functions completed!`)
        console.log(`   Total generated: ${totalGenerated}`)
        console.log(`   Total passed: ${totalPassed}`)
        break
      }
      
      console.log(`\n━━━━ Batch ${batchNum} (${todoLines.length} TODO remaining) ━━━━`)
      
      try {
        const result = await generateBatch(priority, Math.min(count, todoLines.length), 0, report)
        totalGenerated += result.generated
        totalPassed += result.passed
        batchNum++
      } catch (err) {
        console.error(`❌ Batch ${batchNum} failed:`, err.message)
        break
      }
    }
  } else {
    // 3. 生成指定数量
    const priorityMsg = priority ? `${count} ${priority}` : `top ${count}`
    console.log(`🚀 Generating ${priorityMsg} functions...\n`)
    
    try {
      await generateBatch(priority, count, 0, report)
    } catch (err) {
      console.error('❌ Generation failed:', err.message)
      process.exit(1)
    }
  }
}

