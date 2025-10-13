#!/usr/bin/env node
/**
 * 评分系统主入口
 */

import { writeFileSync } from 'node:fs'
import { parseArgs } from '../../shared/cli-utils.js'
import { loadJson } from '../../shared/file-utils.js'
import { requirePackage } from '../../shared/process-utils.js'
import { loadConfig } from './config-loader.js'
import { matchLayer } from './utils.js'
import { 
  mapBCByConfig,
  mapCCFromMetrics,
  loadESLintCognitive,
  mapERFromGitAndImpactConfig,
  mapROIByConfig,
  mapTestabilityByConfig,
  mapCoverageScore
} from './metrics/index.js'
import { computeScore, pickMetricsForTarget } from './calculator.js'
import { buildDepGraph } from './dependency-graph.js'
import { formatMarkdown, readExistingStatus, formatCSV } from './formatters/index.js'

import type { ScoringConfig, ScoredTarget, GitSignals, FunctionTarget, Layer, ImpactHint } from './types.js'
import type { FunctionDeclaration, ArrowFunction, FunctionExpression } from 'ts-morph'

/**
 * 构建函数指标提供者
 */
async function buildFuncMetricsProvider(targets: FunctionTarget[]) {
  const tsMorph = await requirePackage<typeof import('ts-morph')>('ts-morph', 'ts-morph')
  const escomplex = await requirePackage<typeof import('escomplex')>('escomplex', 'escomplex')
  const { Project, SyntaxKind } = tsMorph
  const project = new Project({ skipAddingFilesFromTsConfig: true })
  
  // 收集所有需要分析的文件
  const byPath = new Map()
  targets.forEach(t => {
    if (!byPath.has(t.path)) {
      byPath.set(t.path, true)
    }
  })
  
  Array.from(byPath.keys()).forEach(p => project.addSourceFileAtPathIfExists(p))
  
  const byFunc: Record<string, { cyclomatic: number }> = {}
  const skipped: string[] = []
  
  for (const t of targets) {
    const sf = project.getSourceFile(t.path)
    if (!sf) {
      process.stderr.write(`⚠️  Source not found: ${t.path}\n`)
      continue
    }
    
    let node: FunctionDeclaration | ArrowFunction | FunctionExpression | undefined = sf.getFunction(t.name)
    if (!node) {
      const v = sf.getVariableDeclaration(t.name)
      const init = v?.getInitializer()
      if (init && (init.getKind() === SyntaxKind.FunctionExpression || init.getKind() === SyntaxKind.ArrowFunction)) {
        node = init as ArrowFunction | FunctionExpression
      }
    }
    
    if (!node) {
      skipped.push(`${t.name} in ${t.path}`)
      continue
    }
    
    const text = node.getText()
    let cyclomatic = 0
    
    try {
      const res = escomplex.analyzeModule ? escomplex.analyzeModule(text) : null
      cyclomatic = res?.aggregate?.cyclomatic ?? 0
    } catch {
      skipped.push(`${t.name} (escomplex failed)`)
      continue
    }
    
    byFunc[`${t.path}#${t.name}`] = { cyclomatic }
  }
  
  if (skipped.length > 0) {
    process.stdout.write(`⚠️  Skipped ${skipped.length} targets (not functions or parse failed)\n`)
  }
  
  return { project, byFunc }
}

/**
 * 主评分函数
 */
export async function scoreTargets(
  targets: FunctionTarget[],
  cfg: ScoringConfig,
  gitData: Map<string, GitSignals>,
  coverageData?: Record<string, { lineCoverage?: number }>,
  eslintJsonPath?: string
): Promise<ScoredTarget[]> {
  const { project, byFunc } = await buildFuncMetricsProvider(targets)
  
  // 构建依赖图
  const depGraph = buildDepGraph(project, cfg)
  
  // 加载 ESLint 认知复杂度
  const eslintCognitive = eslintJsonPath ? loadESLintCognitive(eslintJsonPath) : {}
  
  const scored: ScoredTarget[] = []
  
  for (const target of targets) {
    // 获取指标
    const metrics = pickMetricsForTarget({ byFunc }, target)
    const git = gitData.get(target.path) || {
      totalCommits: 0,
      recentCommits: 0,
      uniqueAuthors: 0,
      avgTimeGap: 0,
      crossModuleRefs: 0
    }
    
    // 计算各项指标
    const impactHint = (target as FunctionTarget & { impactHint?: ImpactHint }).impactHint
    const BC = mapBCByConfig(
      { name: target.name, path: target.path, impactHint },
      cfg
    )
    
    const CC = mapCCFromMetrics(metrics, cfg, eslintCognitive, target)
    
    const ER = mapERFromGitAndImpactConfig(
      git,
      impactHint,
      depGraph,
      cfg,
      undefined,
      undefined,
      target
    )
    
    const ROI = mapROIByConfig(impactHint, cfg, undefined, undefined, target)
    
    const testability = mapTestabilityByConfig(
      impactHint,
      cfg,
      undefined,
      undefined,
      target
    )
    
    const coveragePct = coverageData?.[target.path]?.lineCoverage
    const coverageScore = mapCoverageScore(coveragePct, cfg)
    
    // 计算总分和优先级
    const result = computeScore(
      { BC, CC, ER, ROI, testability, coverageScore },
      target,
      cfg
    )
    
    // 匹配层级
    const layer = matchLayer(target, cfg)
    
    scored.push({
      ...target,
      BC,
      CC,
      ER,
      ROI,
      testability,
      coverageScore,
      score: result.score,
      priority: result.priority,
      layer: (result.layer !== 'N/A' ? result.layer : layer) as Layer,
      dependencyCount: depGraph.nodes.size
    } as ScoredTarget)
  }
  
  return scored
}

/**
 * CLI 主函数
 */
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const configPath = (args.config as string) || 'ai-test.config.jsonc'
  const reportPath = (args.report as string) || 'reports/ut_scores.md'
  const format = (args.format as string) || 'md'
  
  console.log('🎯 Loading configuration...')
  const cfg = loadConfig(configPath)
  
  console.log('📊 Loading targets and Git data...')
  // 这里需要从扫描器获取 targets 和 gitData
  // 简化实现：假设从文件加载
  const targetsFile = (args.targets as string) || 'reports/targets.json'
  const targets: FunctionTarget[] = loadJson(targetsFile) || []
  
  if (targets.length === 0) {
    console.warn('⚠️  No targets found. Run scanner first.')
    process.exit(0)
  }
  
  console.log(`📝 Found ${targets.length} targets`)
  
  // 模拟 Git 数据（实际应该从 git-analyzer 获取）
  const gitData = new Map<string, GitSignals>()
  
  console.log('🔢 Scoring targets...')
  const scored = await scoreTargets(targets, cfg, gitData)
  
  console.log('📄 Generating report...')
  const statusMap = readExistingStatus(reportPath)
  
  let output: string
  if (format === 'csv') {
    output = formatCSV(scored)
  } else {
    output = formatMarkdown(scored, statusMap)
  }
  
  writeFileSync(reportPath, output, 'utf-8')
  console.log(`✅ Report saved to: ${reportPath}`)
  
  // 统计输出
  const p0 = scored.filter(r => r.priority === 'P0').length
  const p1 = scored.filter(r => r.priority === 'P1').length
  const p2 = scored.filter(r => r.priority === 'P2').length
  const p3 = scored.filter(r => r.priority === 'P3').length
  
  console.log('\n📊 Summary:')
  console.log(`  Total: ${scored.length}`)
  console.log(`  P0 (Must Test): ${p0}`)
  console.log(`  P1 (High Priority): ${p1}`)
  console.log(`  P2 (Medium Priority): ${p2}`)
  console.log(`  P3 (Low Priority): ${p3}`)
}

// 如果直接运行此文件，执行 CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
}

// 导出供其他模块使用
export * from './types.js'
export * from './utils.js'
export * from './config-loader.js'
export * from './metrics/index.js'
export * from './calculator.js'
export * from './dependency-graph.js'
export * from './formatters/index.js'

