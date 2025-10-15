/**
 * Scan 工作流：扫描代码 + 打分 + 生成报告
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectConfig, readConfig } from '../utils/config-manager.js'
import { extractTargets, listFiles } from '../core/scanner.js'
import { analyzeGitHistory } from '../core/git-analyzer.js'
import { scoreTargets } from '../core/scoring/index.js'
import { formatCSV, formatMarkdown } from '../core/scoring/formatters/index.js'
import type { ScanCommandOptions } from '../types/cli.js'
import type { AITestConfig, GitSignals } from '../types/index.js'
import type { ScoredTarget, ScoringConfig } from '../core/scoring/types.js'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 运行覆盖率测试
 * @param command - 覆盖率命令
 */
async function runCoverage(command: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(command, { 
      stdio: 'inherit', 
      shell: true, 
      cwd: process.cwd() 
    })
    
    child.on('close', () => resolve())
    child.on('error', () => resolve()) // 失败也继续
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
  const output = options.output || 'reports'
  const skipGit = options.skipGit || false
  
  // 1. 检查配置
  console.log('🔍 Step 1: Checking configuration...')
  const configPath = detectConfig(options.config || 'ai-test.config.jsonc')
  
  if (!configPath) {
    console.error('❌ Config not found. Run `ai-test init` first.')
    process.exit(1)
  }
  
  console.log(`   Using config: ${configPath}\n`)
  
  // 读取配置
  const config = readConfig(configPath) as AITestConfig
  
  // 2. 创建输出目录
  if (!existsSync(output)) {
    mkdirSync(output, { recursive: true })
  }
  
  // 3. 可选：运行覆盖率
  try {
    // 从配置中获取覆盖率设置（如果配置中没有 coverage 字段，使用默认值）
    const covCfg = (config as AITestConfig & { coverage?: { runBeforeScan?: boolean; command?: string } })?.coverage || { runBeforeScan: false }
    
    if (covCfg.runBeforeScan) {
      console.log('🧪 Running coverage before scan...')
      const cmd = covCfg.command || 'npx jest --coverage --silent'
      await runCoverage(cmd)
      console.log('✅ Coverage completed.\n')
    }
  } catch (_err) {
    console.warn('⚠️  Coverage step failed. Continuing scan.')
  }
  
  console.log('🚀 Starting code scan...\n')
  
  try {
    // 4. 扫描 AST + 复杂度
    console.log('📋 Step 2: Scanning targets...')
    
    // 获取扫描路径和排除目录
    const scanPaths = (config as AITestConfig & { targetGeneration?: { scanPaths?: string[] } }).targetGeneration?.scanPaths || ['src']
    const excludeDirs = config.targetGeneration?.excludeDirs || []
    
    console.log(`   Scan paths: ${scanPaths.join(', ')}`)
    if (excludeDirs.length > 0) {
      console.log(`   Excluding: ${excludeDirs.join(', ')}`)
    }
    
    // 列出所有源文件
    const files = await listFiles(excludeDirs, scanPaths)
    console.log(`   Found ${files.length} source files`)
    
    // 扫描目标函数
    const targets = await extractTargets(files, config)
    console.log(`   Extracted ${targets.length} testable targets`)
    
    // 保存扫描结果
    const targetsPath = join(output, 'targets.json')
    writeFileSync(targetsPath, JSON.stringify(targets, null, 2), 'utf8')
    
    // 5. Git 信号（可选）
    let gitSignalsMap: Map<string, GitSignals> = new Map()
    
    if (!skipGit) {
      console.log('\n📊 Step 3: Analyzing Git history...')
      try {
        // 从targets中提取文件路径
        const targetFiles = [...new Set(targets.map(t => t.path))]
        const gitSignalsRecord = analyzeGitHistory(targetFiles, config)
        gitSignalsMap = new Map(Object.entries(gitSignalsRecord))
        const gitPath = join(output, 'git_signals.json')
        writeFileSync(gitPath, JSON.stringify(gitSignalsRecord, null, 2), 'utf8')
        console.log(`   Analyzed ${Object.keys(gitSignalsRecord).length} files`)
      } catch (_err) {
        console.warn('⚠️  Git analysis failed, continuing without Git signals')
      }
    } else {
      console.log('\n⏭️  Step 3: Skipping Git history analysis')
    }
    
    // 6. 打分
    console.log('\n🎯 Step 4: Scoring targets...')
    // 注意：scoreTargets的参数顺序是 (targets, config, gitData, coverageData, eslintJsonPath)
    const scoredTargets: ScoredTarget[] = await scoreTargets(targets, config as ScoringConfig, gitSignalsMap)
    console.log(`   Scored ${scoredTargets.length} targets`)
    
    // 7. 生成报告
    console.log('\n📝 Step 5: Generating reports...')
    
    const mdPath = join(output, 'ut_scores.md')
    const csvPath = join(output, 'ut_scores.csv')
    
    const mdContent = formatMarkdown(scoredTargets)
    const csvContent = formatCSV(scoredTargets)
    
    writeFileSync(mdPath, mdContent, 'utf8')
    writeFileSync(csvPath, csvContent, 'utf8')
    
    // 8. 统计结果
    // 注意：ScoredTarget 本身没有 status 字段，这些统计应该从报告中读取
    // 这里我们假设所有目标的初始状态都是 TODO
    const todoCount = scoredTargets.length
    const doneCount = 0
    const p0Count = scoredTargets.filter(t => t.priority === 'P0').length
    const p1Count = scoredTargets.filter(t => t.priority === 'P1').length
    
    console.log('\n✅ Scan completed!')
    console.log(`\n📊 Summary:`)
    console.log(`   Total targets: ${scoredTargets.length}`)
    console.log(`   TODO: ${todoCount}`)
    console.log(`   DONE: ${doneCount}`)
    console.log(`   P0 (must test): ${p0Count}`)
    console.log(`   P1 (high priority): ${p1Count}`)
    console.log(`\n📄 Reports:`)
    console.log(`   Markdown: ${mdPath}`)
    console.log(`   CSV: ${csvPath}`)
    console.log(`\n💡 Next steps:`)
    console.log(`   View report: cat ${mdPath}`)
    console.log(`   Generate tests: ai-test generate`)
    console.log(`   Generate P0 only: ai-test generate -p P0`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('\n❌ Scan failed:', message)
    if (err instanceof Error && err.stack) {
      console.error('Stack:', err.stack)
    }
    process.exit(1)
  }
}
