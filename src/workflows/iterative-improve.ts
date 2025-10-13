#!/usr/bin/env node
/**
 * Meta TestGen-LLM 风格的迭代改进机制
 * 
 * 工作流程：
 * 1. 生成测试
 * 2. 检查质量（构建、通过、覆盖率）
 * 3. 如果不满足标准 → 收集反馈 → 重新生成
 * 4. 重复直到：达到质量标准 OR 达到最大迭代次数
 */

import { spawn, ChildProcess, StdioOptions } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '../..')

/**
 * 质量标准（参考 Meta TestGen-LLM 论文）
 * Reference: https://arxiv.org/pdf/2402.09171
 */
const QUALITY_STANDARDS = {
  minBuildSuccess: 0.75,    // 75% 构建成功（Meta 标准）
  minTestPass: 0.57,        // 57% 测试通过（Meta 标准）
  minCoverageIncrease: 0.25, // 25% 覆盖率提升（Meta 标准）
  maxIterations: 3,         // 最大迭代次数
  temperature: 0.4,         // Meta 发现: 0.4 比 0.0 成功率高 25% (Table 4)
  samplesPerIteration: 1    // 每次迭代生成的样本数（可扩展为 N-sample）
} as const

/**
 * Shell执行选项
 */
interface ShellOptions {
  captureStdout?: boolean
  cwd?: string
  env?: Record<string, string>
}

/**
 * 执行命令
 */
function sh(cmd: string, args: string[], options: ShellOptions = {}): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const stdio: StdioOptions = options.captureStdout ? ['inherit', 'pipe', 'inherit'] : 'inherit'
    const child: ChildProcess = spawn(cmd, args, { 
      stdio, 
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env as Record<string, string>
    })
    
    const chunks: Buffer[] = []
    if (options.captureStdout && child.stdout) {
      child.stdout.on('data', (d: Buffer) => chunks.push(Buffer.from(d)))
    }
    
    child.on('close', (code: number | null) => {
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
 * Jest 覆盖率摘要接口
 */
interface CoverageSummary {
  total?: {
    lines?: { pct?: number }
    statements?: { pct?: number }
    functions?: { pct?: number }
    branches?: { pct?: number }
  }
}

/**
 * 读取覆盖率
 */
function readCoverageSummary(): CoverageSummary | null {
  const path = 'coverage/coverage-summary.json'
  if (!existsSync(path)) return null
  try { 
    return JSON.parse(readFileSync(path, 'utf8')) as CoverageSummary
  } catch { 
    return null 
  }
}

function getCoveragePercent(summary: CoverageSummary | null): number {
  if (!summary || !summary.total) return 0
  return summary.total.lines?.pct ?? 0
}

/**
 * 质量评估结果
 */
interface QualityEvaluation {
  buildSuccess: boolean
  testPass: boolean
  coverageIncrease: number
  passesStandard: boolean
  feedback: string[]
  telemetry: {
    iteration: number
    timestamp: string
    buildTimeMs: number
    testTimeMs: number
    temperature: number
    coverageBefore: number
    coverageAfter: number
    totalTimeMs: number
    passesStandard: boolean
  }
}

/**
 * 评估测试质量（Meta Filter Pipeline）
 * Reference: Section 3.1 - Build, Run, Coverage filters
 */
async function evaluateQuality(beforeCov: number, iteration: number): Promise<QualityEvaluation> {
  const startTime = Date.now()
  
  const quality: QualityEvaluation = {
    buildSuccess: false,
    testPass: false,
    coverageIncrease: 0,
    passesStandard: false,
    feedback: [],
    // 🆕 Meta 风格的遥测数据
    telemetry: {
      iteration,
      timestamp: new Date().toISOString(),
      buildTimeMs: 0,
      testTimeMs: 0,
      temperature: QUALITY_STANDARDS.temperature,
      coverageBefore: 0,
      coverageAfter: 0,
      totalTimeMs: 0,
      passesStandard: false
    }
  }
  
  // 1. 检查是否构建成功 (Build Filter)
  const buildStart = Date.now()
  try {
    await sh('npx', ['tsc', '--noEmit'])
    quality.buildSuccess = true
    quality.telemetry.buildTimeMs = Date.now() - buildStart
  } catch {
    quality.feedback.push('Build failed: TypeScript compilation errors')
    quality.telemetry.buildTimeMs = Date.now() - buildStart
    return quality
  }
  
  // 2. 检查测试是否通过 (Run Filter)
  const testStart = Date.now()
  try {
    await sh('npx', ['jest', '--passWithNoTests'])
    quality.testPass = true
    quality.telemetry.testTimeMs = Date.now() - testStart
  } catch {
    quality.feedback.push('Tests failed: Some tests are not passing')
    quality.telemetry.testTimeMs = Date.now() - testStart
    // 继续，不 return，因为可能覆盖率有提升
  }
  
  // 3. 检查覆盖率是否提升 (Coverage Filter)
  const afterCov = getCoveragePercent(readCoverageSummary())
  quality.coverageIncrease = afterCov - beforeCov
  quality.telemetry.coverageBefore = beforeCov
  quality.telemetry.coverageAfter = afterCov
  
  if (quality.coverageIncrease < QUALITY_STANDARDS.minCoverageIncrease) {
    quality.feedback.push(`Coverage increase ${quality.coverageIncrease.toFixed(2)}% < required ${QUALITY_STANDARDS.minCoverageIncrease}%`)
  }
  
  // 4. 判断是否满足标准（参考 Meta 的过滤器管道）
  quality.passesStandard = (
    quality.buildSuccess &&
    quality.testPass &&
    quality.coverageIncrease >= QUALITY_STANDARDS.minCoverageIncrease
  )
  
  quality.telemetry.totalTimeMs = Date.now() - startTime
  quality.telemetry.passesStandard = quality.passesStandard
  
  return quality
}

/**
 * 计算候选测试的综合评分（用于 N-Sample 选择）
 * Meta 策略: 综合考虑构建、测试、覆盖率三个维度
 */
function calculateCandidateScore(quality: QualityEvaluation): number {
  let score = 0
  
  // 1. 构建成功 (权重: 40%) - 最基础
  if (quality.buildSuccess) {
    score += 40
  }
  
  // 2. 测试通过 (权重: 30%) - 次重要
  if (quality.testPass) {
    score += 30
  }
  
  // 3. 覆盖率增量 (权重: 30%) - 最终目标
  // 归一化到 0-30 分
  const covScore = Math.min(quality.coverageIncrease / QUALITY_STANDARDS.minCoverageIncrease, 1) * 30
  score += covScore
  
  return score
}

/**
 * 反馈信息
 */
interface FeedbackInfo {
  iteration: number
  timestamp: string
  issues: string[]
  suggestions: string[]
}

/**
 * 收集改进反馈
 */
async function collectFeedback(quality: QualityEvaluation, iteration: number): Promise<FeedbackInfo> {
  const feedback: FeedbackInfo = {
    iteration,
    timestamp: new Date().toISOString(),
    issues: quality.feedback,
    suggestions: []
  }
  
  // 基于问题生成建议
  if (!quality.buildSuccess) {
    feedback.suggestions.push('Fix TypeScript errors before generating tests')
    feedback.suggestions.push('Check for missing imports or type definitions')
  }
  
  if (!quality.testPass) {
    feedback.suggestions.push('Review test assertions and expected values')
    feedback.suggestions.push('Check for async/await issues in tests')
    feedback.suggestions.push('Verify mock setup is correct')
  }
  
  if (quality.coverageIncrease < QUALITY_STANDARDS.minCoverageIncrease) {
    feedback.suggestions.push('Add more test cases for uncovered branches')
    feedback.suggestions.push('Test edge cases and error conditions')
    feedback.suggestions.push('Increase assertion coverage')
  }
  
  return feedback
}

/**
 * 迭代改进选项
 */
interface IterativeImproveOptions {
  targetFunctions?: string[]
  reportPath?: string
  maxIterations?: number
  samplesPerIteration?: number
}

/**
 * 候选样本
 */
interface CandidateSample {
  sampleIdx: number
  quality: QualityEvaluation
  score: number
}

/**
 * 迭代改进主循环（Meta TestGen-LLM 风格）
 */
export async function iterativeImprove(options: IterativeImproveOptions = {}): Promise<void> {
  const {
    reportPath = 'reports/ut_scores.md',
    maxIterations = QUALITY_STANDARDS.maxIterations,
    samplesPerIteration = QUALITY_STANDARDS.samplesPerIteration  // 🆕 N-Sample Generation
  } = options
  
  console.log('🔄 Starting iterative improvement (Meta TestGen-LLM style)...\n')
  console.log(`📊 Quality Standards:`)
  console.log(`   - Build Success: ${QUALITY_STANDARDS.minBuildSuccess * 100}%`)
  console.log(`   - Test Pass: ${QUALITY_STANDARDS.minTestPass * 100}%`)
  console.log(`   - Coverage Increase: ${QUALITY_STANDARDS.minCoverageIncrease}%`)
  console.log(`   - Max Iterations: ${maxIterations}`)
  console.log(`   - Samples Per Iteration: ${samplesPerIteration} ${samplesPerIteration > 1 ? '(N-Sample Mode 🎲)' : ''}\n`)
  
  const beforeCov = getCoveragePercent(readCoverageSummary())
  console.log(`📈 Initial Coverage: ${beforeCov.toFixed(2)}%\n`)
  
  let iteration = 1
  let quality: QualityEvaluation | null = null
  const feedbackHistory: FeedbackInfo[] = []
  
  while (iteration <= maxIterations) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🔄 Iteration ${iteration}/${maxIterations}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    
    // 1. 生成测试（使用之前的 feedback）
    console.log(`🤖 Generating tests ${samplesPerIteration > 1 ? `(${samplesPerIteration} samples)` : ''}...`)
    
    try {
      if (feedbackHistory.length > 0) {
        // 将 feedback 写入 hints 文件
        const hintsContent = feedbackHistory.map((fb) => 
          `## Iteration ${fb.iteration} Feedback:\n` +
          `Issues:\n${fb.issues.map((i: string) => `- ${i}`).join('\n')}\n` +
          `Suggestions:\n${fb.suggestions.map((s: string) => `- ${s}`).join('\n')}`
        ).join('\n\n')
        
        writeFileSync('reports/improvement_hints.txt', hintsContent, 'utf-8')
        console.log(`💡 Using feedback from ${feedbackHistory.length} previous iteration(s)`)
      }
      
      //  N-Sample Generation: 生成多个候选，选择最佳
      if (samplesPerIteration > 1) {
        const candidates: CandidateSample[] = []
        
        for (let sampleIdx = 0; sampleIdx < samplesPerIteration; sampleIdx++) {
          console.log(`\n   🎲 Sample ${sampleIdx + 1}/${samplesPerIteration}...`)
          
          // 生成候选测试
          await sh('node', [
            join(PKG_ROOT, 'lib/workflows/batch.mjs'),
            null, // priority
            '10', // limit
            '0',  // skip
            reportPath
          ])
          
          // 立即评估此候选的质量
          const candidateQuality = await evaluateQuality(beforeCov, iteration)
          
          // 保存候选结果到临时目录
          const candidateDir = `reports/candidates/iter${iteration}_sample${sampleIdx}`
          await sh('mkdir', ['-p', candidateDir], {})
          await sh('cp', ['-r', 'coverage', `${candidateDir}/`], {}).catch(() => {})
          
          candidates.push({
            sampleIdx,
            quality: candidateQuality,
            score: calculateCandidateScore(candidateQuality)
          })
          
          console.log(`      Build: ${candidateQuality.buildSuccess ? '✅' : '❌'}, ` +
                     `Pass: ${candidateQuality.testPass ? '✅' : '❌'}, ` +
                     `Cov: ${candidateQuality.coverageIncrease.toFixed(2)}%, ` +
                     `Score: ${calculateCandidateScore(candidateQuality).toFixed(2)}`)
        }
        
        // 选择最佳候选
        candidates.sort((a, b) => b.score - a.score)
        const bestCandidate = candidates[0]
        
        if (!bestCandidate) {
          throw new Error('No valid candidate samples generated')
        }
        
        console.log(`\n   ✨ Best sample: #${bestCandidate.sampleIdx + 1} (score: ${bestCandidate.score.toFixed(2)})`)
        
        // 恢复最佳候选的覆盖率数据
        const bestCandidateDir = `reports/candidates/iter${iteration}_sample${bestCandidate.sampleIdx}`
        await sh('cp', ['-r', `${bestCandidateDir}/coverage`, '.'], {}).catch(() => {})
        
        quality = bestCandidate.quality
      } else {
        // 单样本模式（原有逻辑）
        await sh('node', [
          join(PKG_ROOT, 'lib/workflows/batch.mjs'),
          'null', // priority
          '10', // limit
          '0',  // skip
          reportPath
        ], {})
      }
    } catch (err: unknown) {
      const error = err as Error
      console.error(`❌ Generation failed: ${error?.message || String(err)}`)
      break
    }
    
    // 2. 评估质量（Meta Filter Pipeline）
    // N-Sample 模式下已经在候选选择时评估过了
    if (samplesPerIteration === 1) {
      console.log('\n📊 Evaluating quality...')
      quality = await evaluateQuality(beforeCov, iteration)
    } else {
      console.log('\n📊 Final quality (best sample):')
    }
    
    console.log(`   Build: ${quality.buildSuccess ? '✅' : '❌'} (${quality.telemetry.buildTimeMs}ms)`)
    console.log(`   Tests Pass: ${quality.testPass ? '✅' : '❌'} (${quality.telemetry.testTimeMs}ms)`)
    console.log(`   Coverage: ${quality.coverageIncrease.toFixed(2)}% ${quality.coverageIncrease >= QUALITY_STANDARDS.minCoverageIncrease ? '✅' : '❌'} (${quality.telemetry.coverageBefore.toFixed(2)}% → ${quality.telemetry.coverageAfter.toFixed(2)}%)`)
    
    // 3. 检查是否满足标准
    if (quality.passesStandard) {
      console.log(`\n🎉 Quality standard met!`)
      console.log(`   Final coverage: ${(beforeCov + quality.coverageIncrease).toFixed(2)}%`)
      console.log(`   Iterations used: ${iteration}/${maxIterations}`)
      break
    }
    
    // 4. 收集反馈
    const feedback = await collectFeedback(quality, iteration)
    feedbackHistory.push(feedback)
    
    console.log(`\n💬 Feedback for next iteration:`)
    feedback.issues.forEach(issue => console.log(`   ⚠️  ${issue}`))
    feedback.suggestions.forEach(sug => console.log(`   💡 ${sug}`))
    
    // 5. 检查是否达到最大迭代次数
    if (iteration >= maxIterations) {
      console.log(`\n⏱️  Reached max iterations (${maxIterations})`)
      if (quality) {
        console.log(`   Final quality:`)
        console.log(`   - Build: ${quality.buildSuccess ? 'Pass' : 'Fail'}`)
        console.log(`   - Tests: ${quality.testPass ? 'Pass' : 'Fail'}`)
        console.log(`   - Coverage: +${quality.coverageIncrease.toFixed(2)}%`)
      }
      break
    }
    
    iteration++
  }
  
  // 生成改进报告（Meta 风格 - 包含详细遥测）
  const report = {
    success: quality?.passesStandard || false,
    iterations: iteration,
    initialCoverage: beforeCov,
    finalCoverage: beforeCov + (quality?.coverageIncrease || 0),
    improvement: quality?.coverageIncrease || 0,
    feedbackHistory,
    // 🆕 Meta 风格的遥测汇总
    telemetry: {
      temperature: QUALITY_STANDARDS.temperature,
      maxIterations: maxIterations,
      qualityStandards: {
        minBuildSuccess: QUALITY_STANDARDS.minBuildSuccess,
        minTestPass: QUALITY_STANDARDS.minTestPass,
        minCoverageIncrease: QUALITY_STANDARDS.minCoverageIncrease
      },
      iterationDetails: feedbackHistory.map(fb => ({
        iteration: fb.iteration,
        timestamp: fb.timestamp,
        issues: fb.issues,
        suggestions: fb.suggestions
      })),
      finalQuality: quality?.telemetry || null
    },
    // 论文引用
    reference: 'Meta TestGen-LLM (2024) - https://arxiv.org/pdf/2402.09171'
  }
  
  writeFileSync('reports/improvement_report.json', JSON.stringify(report, null, 2), 'utf-8')
  console.log(`\n📄 Full report saved: reports/improvement_report.json`)
  console.log(`   Reference: Meta TestGen-LLM - https://arxiv.org/pdf/2402.09171`)
  
  return report
}

/**
 * CLI 入口
 */
async function main(argv: string[] = process.argv): Promise<void> {
  const args = argv.slice(2)
  const reportPath = args[0]
  const maxIterations = parseInt(args[1]) || QUALITY_STANDARDS.maxIterations
  
  try {
    await iterativeImprove({
      reportPath,
      maxIterations
    })
  } catch (err) {
    console.error(`❌ Iterative improvement failed: ${err.message}`)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

