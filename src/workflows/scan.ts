/**
 * Scan 工作流：扫描代码 + 打分 + 生成报告
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectConfig } from '../utils/config-manager.js'
import type { ScanCommandOptions } from '../types/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '../..')

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 移除 JSON 注释
 * @param str - JSON 字符串
 * @returns 清理后的 JSON 字符串
 */
function stripJsonComments(str: string): string {
  return String(str)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
}

/**
 * 运行脚本
 * @param scriptPath - 脚本路径
 * @param args - 参数
 * @returns Promise
 */
function runScript(scriptPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const fullPath = join(PKG_ROOT, 'lib', scriptPath)
    const child = spawn('node', [fullPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    })

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`))
      }
    })

    child.on('error', reject)
  })
}

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Scan 工作流
 * @param options - 扫描选项
 */
export async function scan(options: ScanCommandOptions): Promise<void> {
  let { config = 'ai-test.config.jsonc', output = 'reports', skipGit = false } = options
  
  // 1. 检查配置
  console.log('🔍 Step 1: Checking configuration...')
  const configPath = detectConfig(config)
  
  if (!configPath) {
    console.error('❌ Config not found. Run `ai-test init` first.')
    process.exit(1)
  }
  
  config = configPath
  console.log(`   Using config: ${config}\n`)
  
  // 2. 创建输出目录
  if (!existsSync(output)) {
    mkdirSync(output, { recursive: true })
  }
  
  // 3. 可选：运行覆盖率
  try {
    const cfgText = existsSync(config) ? readFileSync(config, 'utf-8') : '{}'
    const cfg = JSON.parse(stripJsonComments(cfgText))
    const covCfg = cfg?.coverage || { runBeforeScan: false }
    
    if (covCfg.runBeforeScan) {
      console.log('🧪 Running coverage before scan...')
      await new Promise<void>((resolve) => {
        const cmd = covCfg.command || 'npx jest --coverage --silent'
        const child = spawn(cmd, { stdio: 'inherit', shell: true, cwd: process.cwd() })
        child.on('close', () => resolve())
        child.on('error', () => resolve())
      })
      console.log('✅ Coverage completed.\n')
    }
  } catch (_err) {
    console.warn('⚠️  Coverage step failed. Continuing scan.')
  }
  
  console.log('🚀 Starting code scan...\n')
  
  try {
    // 4. 扫描 AST + 复杂度
    console.log('📋 Step 2: Scanning targets...')
    await runScript('core/scanner.mjs', [
      '--config', config,
      '--out', join(output, 'targets.json')
    ])
    
    // 5. Git 信号（可选）
    if (!skipGit) {
      console.log('\n📊 Step 3: Analyzing Git history...')
      await runScript('core/git-analyzer.mjs', [
        '--targets', join(output, 'targets.json'),
        '--out', join(output, 'git_signals.json')
      ])
    }
    
    // 6. 打分
    console.log('\n🎯 Step 4: Scoring targets...')
    const scoreArgs = [
      '--targets', join(output, 'targets.json'),
      '--config', config,
      '--out-md', join(output, 'ut_scores.md'),
      '--out-csv', join(output, 'ut_scores.csv')
    ]
    
    if (!skipGit && existsSync(join(output, 'git_signals.json'))) {
      scoreArgs.push('--git', join(output, 'git_signals.json'))
    }
    
    await runScript('core/scorer.mjs', scoreArgs)
    
    // 7. 统计结果
    const reportPath = join(output, 'ut_scores.md')
    if (existsSync(reportPath)) {
      const content = readFileSync(reportPath, 'utf-8')
      const todoCount = (content.match(/\| TODO \|/g) || []).length
      const doneCount = (content.match(/\| DONE \|/g) || []).length
      
      console.log('\n✅ Scan completed!')
      console.log(`\n📊 Status:`)
      console.log(`   TODO: ${todoCount}`)
      console.log(`   DONE: ${doneCount}`)
      console.log(`   Total: ${todoCount + doneCount}`)
      console.log(`\n📄 Report: ${reportPath}`)
      console.log(`\n💡 Next: ai-test generate`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('❌ Scan failed:', message)
    process.exit(1)
  }
}
