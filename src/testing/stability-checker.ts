#!/usr/bin/env node
/**
 * Stability Checker - 测试稳定性检查器
 * 
 * 借鉴 Qodo Cover 的做法：
 * - 运行测试 N 次（默认 3 次）
 * - 检测 flaky tests
 * - 自动标记不稳定测试
 * 
 * Reference: Qodo Cover - Test Stability Validation
 */

import { spawn } from 'node:child_process'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RUNS = 3  // Qodo Cover 使用 5 次，我们用 3 次（平衡速度和准确性）
const FLAKY_REPORT_PATH = 'reports/flaky_tests.json'

// ============================================================================
// Type Definitions
// ============================================================================

/** Test execution result */
export interface TestResult {
  passed: boolean
  exitCode: number | null
  duration: number
  stdout: string
  stderr: string
  error?: string
}

/** Stability analysis result */
export interface StabilityAnalysis {
  passCount: number
  failCount: number
  passRate: number
  avgDuration: number
  maxDuration: number
  minDuration: number
  durationVariance: number
  status: string
  isStable: boolean
  isFlaky: boolean
  isUnstable: boolean
}

/** Stability check result */
export interface StabilityCheckResult {
  testFile: string
  runs: number
  results: TestResult[]
  analysis: StabilityAnalysis
}

/** Flaky test information */
export interface FlakyTestInfo {
  file: string
  passRate: number
  passCount: number
  failCount: number
  avgDuration: number
  detectedCount?: number
  firstDetected?: string
  lastDetected?: string
}

/** Flaky tests report */
export interface FlakyReport {
  tests: FlakyTestInfo[]
  lastUpdated: string | null
  totalFlakyTests?: number
}

/** Stability summary for multiple tests */
export interface StabilitySummary {
  totalTests: number
  stable: number
  flaky: number
  unstable: number
  timestamp: string
  results: StabilityCheckResult[]
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 运行单个测试文件
 * @param testFile - 测试文件路径
 * @returns 测试执行结果
 */
function runTest(testFile: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const child = spawn('npx', ['jest', testFile, '--silent'], {
      stdio: 'pipe',
      cwd: process.cwd()
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    
    child.on('close', (code: number | null) => {
      const endTime = Date.now()
      resolve({
        passed: code === 0,
        exitCode: code,
        duration: endTime - startTime,
        stdout,
        stderr
      })
    })
    
    child.on('error', (error: Error) => {
      resolve({
        passed: false,
        exitCode: -1,
        duration: Date.now() - startTime,
        stdout,
        stderr,
        error: error.message
      })
    })
  })
}

/**
 * 检查测试稳定性
 * @param testFile - 测试文件路径
 * @param runs - 运行次数
 * @returns 稳定性检查结果
 */
export async function checkStability(testFile: string, runs: number = DEFAULT_RUNS): Promise<StabilityCheckResult> {
  console.log(`🔍 Checking stability for: ${testFile}`)
  console.log(`   Running ${runs} times...\n`)
  
  const results: TestResult[] = []
  
  for (let i = 0; i < runs; i++) {
    process.stdout.write(`   Run ${i + 1}/${runs}... `)
    
    const result = await runTest(testFile)
    results.push(result)
    
    if (result.passed) {
      console.log(`✅ PASS (${result.duration}ms)`)
    } else {
      console.log(`❌ FAIL (${result.duration}ms)`)
    }
  }
  
  // 分析结果
  const analysis = analyzeStability(results)
  
  console.log(`\n📊 Stability Analysis:`)
  console.log(`   Pass rate: ${analysis.passRate.toFixed(1)}% (${analysis.passCount}/${runs})`)
  console.log(`   Average duration: ${analysis.avgDuration.toFixed(0)}ms`)
  console.log(`   Status: ${analysis.status}`)
  
  if (analysis.isFlaky) {
    console.log(`\n⚠️  WARNING: This test is FLAKY!`)
    console.log(`   Passed: ${analysis.passCount} times`)
    console.log(`   Failed: ${analysis.failCount} times`)
    console.log(`   Recommendation: Fix this test before merging`)
  }
  
  return {
    testFile,
    runs,
    results,
    analysis
  }
}

/**
 * 分析稳定性结果
 * @param results - 测试结果数组
 * @returns 稳定性分析结果
 */
function analyzeStability(results: TestResult[]): StabilityAnalysis {
  const passCount = results.filter(r => r.passed).length
  const failCount = results.length - passCount
  const passRate = (passCount / results.length) * 100
  
  const durations = results.map(r => r.duration)
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
  const maxDuration = Math.max(...durations)
  const minDuration = Math.min(...durations)
  const durationVariance = maxDuration - minDuration
  
  // 判断稳定性
  let status: string
  let isFlaky: boolean
  let isStable: boolean
  let isUnstable: boolean
  
  if (passRate === 100) {
    status = 'STABLE ✅'
    isStable = true
    isFlaky = false
    isUnstable = false
  } else if (passRate === 0) {
    status = 'UNSTABLE ❌'
    isUnstable = true
    isFlaky = false
    isStable = false
  } else {
    status = 'FLAKY ⚠️'
    isFlaky = true
    isStable = false
    isUnstable = false
  }
  
  return {
    passCount,
    failCount,
    passRate,
    avgDuration,
    maxDuration,
    minDuration,
    durationVariance,
    status,
    isStable,
    isFlaky,
    isUnstable
  }
}

/**
 * 批量检查多个测试文件
 * @param testFiles - 测试文件路径数组
 * @param runs - 每个测试运行次数
 * @returns 汇总结果
 */
export async function checkMultipleStability(testFiles: string[], runs: number = DEFAULT_RUNS): Promise<StabilitySummary> {
  const allResults: StabilityCheckResult[] = []
  
  for (const testFile of testFiles) {
    const result = await checkStability(testFile, runs)
    allResults.push(result)
    console.log('\n' + '='.repeat(60) + '\n')
  }
  
  // 生成汇总报告
  const summary: StabilitySummary = {
    totalTests: allResults.length,
    stable: allResults.filter(r => r.analysis.isStable).length,
    flaky: allResults.filter(r => r.analysis.isFlaky).length,
    unstable: allResults.filter(r => r.analysis.isUnstable).length,
    timestamp: new Date().toISOString(),
    results: allResults
  }
  
  console.log('📊 Summary:')
  console.log(`   Total tests: ${summary.totalTests}`)
  console.log(`   Stable: ${summary.stable} ✅`)
  console.log(`   Flaky: ${summary.flaky} ⚠️`)
  console.log(`   Unstable: ${summary.unstable} ❌`)
  
  // 保存 flaky tests
  if (summary.flaky > 0) {
    const flakyTests: FlakyTestInfo[] = allResults
      .filter(r => r.analysis.isFlaky)
      .map(r => ({
        file: r.testFile,
        passRate: r.analysis.passRate,
        passCount: r.analysis.passCount,
        failCount: r.analysis.failCount,
        avgDuration: r.analysis.avgDuration
      }))
    
    saveFlakyReport(flakyTests)
    console.log(`\n⚠️  Flaky tests saved to: ${FLAKY_REPORT_PATH}`)
  }
  
  return summary
}

/**
 * 保存 flaky tests 报告
 * @param flakyTests - Flaky 测试信息数组
 */
function saveFlakyReport(flakyTests: FlakyTestInfo[]): void {
  let existingReport: FlakyReport = { tests: [], lastUpdated: null }
  
  if (existsSync(FLAKY_REPORT_PATH)) {
    try {
      existingReport = JSON.parse(readFileSync(FLAKY_REPORT_PATH, 'utf-8'))
    } catch {
      // 使用默认值
    }
  }
  
  // 合并新的 flaky tests
  const merged: FlakyTestInfo[] = [...existingReport.tests]
  
  flakyTests.forEach(newTest => {
    const existingIndex = merged.findIndex(t => t.file === newTest.file)
    if (existingIndex >= 0) {
      const existing = merged[existingIndex]!
      merged[existingIndex] = {
        ...existing,
        ...newTest,
        detectedCount: (existing.detectedCount || 1) + 1,
        lastDetected: new Date().toISOString()
      }
    } else {
      merged.push({
        ...newTest,
        detectedCount: 1,
        firstDetected: new Date().toISOString(),
        lastDetected: new Date().toISOString()
      })
    }
  })
  
  const report: FlakyReport = {
    tests: merged,
    lastUpdated: new Date().toISOString(),
    totalFlakyTests: merged.length
  }
  
  writeFileSync(FLAKY_REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')
}

/**
 * 读取 flaky tests 报告
 * @returns Flaky 测试信息数组
 */
export function getFlakyTests(): FlakyTestInfo[] {
  if (!existsSync(FLAKY_REPORT_PATH)) {
    return []
  }
  
  try {
    const report: FlakyReport = JSON.parse(readFileSync(FLAKY_REPORT_PATH, 'utf-8'))
    return report.tests || []
  } catch {
    return []
  }
}

/**
 * 检查文件是否在 flaky 列表中
 * @param testFile - 测试文件路径
 * @returns 是否为 flaky test
 */
export function isFlaky(testFile: string): boolean {
  const flakyTests = getFlakyTests()
  return flakyTests.some(t => t.file === testFile)
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * CLI 工具
 * @param argv - 命令行参数
 */
async function main(argv: string[] = process.argv): Promise<void> {
  const args = argv.slice(2)
  
  if (args.length === 0) {
    console.log(`
Usage: node stability-checker.mjs <test-file> [test-file2] [...] [--runs N]

Options:
  --runs N    Number of runs per test (default: 3)

Examples:
  node stability-checker.mjs src/utils/format.test.ts
  node stability-checker.mjs src/**/*.test.ts --runs 5
  node stability-checker.mjs --list-flaky
`)
    return
  }
  
  // 特殊命令
  if (args[0] === '--list-flaky') {
    const flakyTests = getFlakyTests()
    if (flakyTests.length === 0) {
      console.log('No flaky tests found ✅')
    } else {
      console.log(`Found ${flakyTests.length} flaky tests:\n`)
      flakyTests.forEach((test, idx) => {
        console.log(`${idx + 1}. ${test.file}`)
        console.log(`   Pass rate: ${test.passRate.toFixed(1)}%`)
        console.log(`   Detected: ${test.detectedCount} times`)
        console.log(`   Last: ${test.lastDetected}`)
        console.log()
      })
    }
    return
  }
  
  // 解析参数
  const runsIndex = args.indexOf('--runs')
  const runs = runsIndex >= 0 ? parseInt(args[runsIndex + 1] || String(DEFAULT_RUNS)) || DEFAULT_RUNS : DEFAULT_RUNS
  const testFiles = args.filter(arg => !arg.startsWith('--') && arg !== String(runs))
  
  if (testFiles.length === 0) {
    console.error('Error: No test files specified')
    process.exit(1)
  }
  
  // 执行稳定性检查
  const summary = await checkMultipleStability(testFiles, runs)
  
  // 退出码
  const exitCode = summary.flaky > 0 || summary.unstable > 0 ? 1 : 0
  process.exit(exitCode)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
