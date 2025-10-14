#!/usr/bin/env node

/**
 * AI-Unit-Test-Generator CLI
 * 
 * Commands:
 *   init     - Initialize configuration file
 *   analyze  - AI-powered codebase analysis
 *   scan     - Scan code and generate priority scoring
 *   generate - Generate unit tests
 */

import { program } from 'commander'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import type { InitOptions, AnalyzeOptions, ScanCommandOptions, GenerateOptions, ParallelOptions } from './types/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '..')

// 读取版本号
const pkgJson = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf-8'))

program
  .name('ai-test')
  .description('AI-powered unit test generator with smart priority scoring')
  .version(pkgJson.version)
  .addHelpText('after', `
Quick Start:
  1. $ ai-test init              # Create config file
  2. $ ai-test analyze           # Let AI analyze your codebase (optional)
  3. $ ai-test scan              # Scan & score functions
  4. $ ai-test generate          # Generate tests

Examples:
  $ ai-test init
  $ ai-test analyze
  $ ai-test scan --skip-git
  $ ai-test generate -n 20 --all

Documentation: https://github.com/YuhengZhou/ai-unit-test-generator
  `)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 命令 1: init - 初始化配置
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
program
  .command('init')
  .description('Initialize ai-test configuration file')
  .option('-c, --config <path>', 'Config file path', 'ai-test.config.jsonc')
  .action(async (options: InitOptions) => {
    const { init } = await import('./workflows/init.js')
    await init(options)
  })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 命令 1.5: init-best-practices - 生成测试规范
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
program
  .command('init-best-practices')
  .description('Generate project-specific testing best practices')
  .option('--inline', 'Generate inline config instead of separate file')
  .option('-c, --config <path>', 'Config file path', 'ai-test.config.jsonc')
  .addHelpText('after', `
Modes:
  - File mode (default): Generates best_practices.md file
  - Inline mode (--inline): Embeds config in ai-test.config.jsonc

How it works:
  1. Analyzes your project structure and package.json
  2. Detects test framework (jest/vitest/mocha)
  3. Extracts patterns from existing tests (if any)
  4. Uses AI to generate testing standards
  5. Outputs either Markdown file or inline config

Examples:
  $ ai-test init-best-practices            # Generate best_practices.md
  $ ai-test init-best-practices --inline   # Embed in config file
  `)
  .action(async (options: { inline?: boolean; config?: string }) => {
    const { analyzeProject, generateBestPracticesFile, generateBestPracticesInline } = await import('./workflows/init-best-practices.js')
    const { detectConfig, readConfig } = await import('./utils/config-manager.js')
    const { existsSync, writeFileSync } = await import('node:fs')
    const { join } = await import('node:path')

    const rootDir = process.cwd()
    const configPath = join(rootDir, options.config || 'ai-test.config.jsonc')

    console.log('🔍 Analyzing project...')
    const analysis = await analyzeProject(rootDir)
    console.log(`   Test framework: ${analysis.testFramework}`)
    console.log(`   Test file pattern: ${analysis.testFilePattern}`)
    console.log(`   Existing tests: ${analysis.hasExistingTests ? 'Yes' : 'No'}`)

    if (options.inline) {
      // Inline mode: Embed in config file
      console.log('\n🤖 Generating inline config...')
      const inlineConfig = await generateBestPracticesInline(rootDir, analysis)

      // Update config file
      const existingPath = detectConfig(configPath)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = existingPath ? readConfig(existingPath) as any : {} as any
      config.bestPractices = {
        enabled: true,
        source: 'inline',
        inline: inlineConfig
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
      console.log(`✅ Updated ${options.config || 'ai-test.config.jsonc'}`)
      console.log('\nInline configuration:')
      console.log(`  - Test framework: ${inlineConfig.testFramework}`)
      console.log(`  - File pattern: ${inlineConfig.testFilePattern}`)
      console.log(`  - Mock strategy: ${inlineConfig.mockStrategy}`)
      console.log(`  - Coverage goal: ${inlineConfig.coverageGoal}%`)
      console.log(`  - Custom rules: ${inlineConfig.customRules.length}`)
    } else {
      // File mode: Generate Markdown file
      const outputPath = join(rootDir, 'best_practices.md')

      if (existsSync(outputPath)) {
        console.log(`\n⚠️  best_practices.md already exists`)
        console.log('   Run with --inline to use inline mode instead')
        process.exit(1)
      }

      console.log('\n🤖 Generating best practices file...')
      const content = await generateBestPracticesFile(rootDir, analysis)

      writeFileSync(outputPath, content, 'utf8')
      console.log(`✅ Generated best_practices.md`)

      // Update config file to point to the file
      const existingPath = detectConfig(configPath)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = existingPath ? readConfig(existingPath) as any : {} as any
      config.bestPractices = {
        enabled: true,
        source: 'file',
        filePath: './best_practices.md'
      }
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
      console.log(`✅ Updated ${options.config || 'ai-test.config.jsonc'}`)
    }
  })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 命令 2: analyze - AI 配置分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
program
  .command('analyze')
  .description('AI-powered codebase analysis for scoring optimization')
  .option('-c, --config <path>', 'Config file path')
  .option('-o, --output <dir>', 'Output directory', 'reports')
  .addHelpText('after', `
How it works:
  1. Samples representative code from your codebase
  2. Calls Cursor Agent to analyze business logic
  3. Generates scoring suggestions (business critical paths, high risk modules)
  4. Interactive review - you choose which suggestions to apply
  5. Updates ai-test.config.jsonc with approved suggestions

Note: Requires cursor-agent CLI to be installed
  `)
  .action(async (options: AnalyzeOptions) => {
    const { analyze } = await import('./workflows/analyze.js')
    await analyze(options)
  })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 命令 3: scan - 扫描代码并打分
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
program
  .command('scan')
  .description('Scan code and generate priority scoring report')
  .option('-c, --config <path>', 'Config file path')
  .option('-o, --output <dir>', 'Output directory', 'reports')
  .option('--skip-git', 'Skip Git signals generation')
  .addHelpText('after', `
Generates:
  - reports/targets.json       (AST + complexity data)
  - reports/git_signals.json   (Git history signals)
  - reports/ut_scores.md       (Human-readable report)
  - reports/ut_scores.csv      (Machine-readable scores)

Scoring modes:
  - Layered: Different weights for each layer (foundation, business, state, UI)
  - Legacy: Unified weights across all code

AI enhancement:
  - If you ran 'ai-test analyze', scores will automatically use AI suggestions
  - AI-identified business critical paths get higher priority
  `)
  .action(async (options: ScanCommandOptions) => {
    const { scan } = await import('./workflows/scan.js')
    await scan(options)
  })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 命令 4: generate - 生成测试
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
program
  .command('generate')
  .description('Generate unit tests for untested functions')
  .option('-n, --count <number>', 'Number of functions to generate', parseInt, 10)
  .option('-p, --priority <level>', 'Priority filter (P0, P1, P2, P3). If not specified, generates by score order')
  .option('--all', 'Generate all remaining TODO functions')
  .option('--no-iterative', 'Disable iterative improvement mode (default: enabled)')
  .option('--max-iterations <number>', 'Maximum iterations for iterative mode', parseInt, 3)
  .option('--samples <number>', '🎲 Samples per iteration (N-Sample Generation)', parseInt, 1)
  .option('--dry-run', '🔍 Dry run mode: Preview actions without executing (Qodo Cover style)')
  .option('--report <path>', 'Report file path', 'reports/ut_scores.md')
  .addHelpText('after', `
Examples:
  $ ai-test generate                 # Generate top 10 with auto-improvement (default)
  $ ai-test generate -n 20           # Generate top 20 with auto-improvement
  $ ai-test generate -p P0           # Only P0 functions (if any)
  $ ai-test generate -p P1 -n 15     # Only P1 functions, up to 15
  $ ai-test generate --all           # Generate all TODO functions
  $ ai-test generate --no-iterative  # Disable auto-improvement (one-shot mode)
  $ ai-test generate --samples 3     # 🎲 N-Sample: Generate 3 candidates, pick best
  $ ai-test generate --dry-run       # 🔍 Preview actions without executing (Qodo Cover style)

Default behavior (v2.1+):
  - 🔄 Iterative improvement enabled by default (Meta TestGen-LLM style)
  - Generates functions in descending score order
  - Auto-improves until quality standards met or max iterations (3)
  - Use --no-iterative for one-shot generation

Iterative Mode (Default):
  - Generate → Check Quality → Collect Feedback → Regenerate
  - Repeats until: Quality standard met OR Max iterations reached
  - Quality standards:
    * 75% build success (TypeScript compilation)
    * 57% test pass rate
    * 25% coverage increase
  - Max 3 iterations by default (configurable with --max-iterations)
  - Reference: Meta TestGen-LLM (2024)

N-Sample Generation (Advanced):
  - Generate N candidates per iteration, select best one
  - Scoring: Build (40%) + Tests Pass (30%) + Coverage (30%)
  - Increases success rate at cost of time
  - Recommended: --samples 3 for critical functions
  - Reference: Meta TestGen-LLM Section 4.2

Dry Run Mode (Qodo Cover Style):
  - Preview all actions before execution
  - No files will be created or modified
  - All actions logged in reports/actions/actions.log
  - Perfect for CI/CD pipelines and review
  - Reference: Qodo Cover - Safety & Audit

Features:
  - Automatic test generation using Cursor Agent
  - Jest integration with coverage tracking
  - Failure retry with hints
  - Auto-marking DONE on success
  - Action logging and audit trail (NEW)
  `)
  .action(async (options: GenerateOptions) => {
    const { generate } = await import('./workflows/generate.js')
    await generate(options)
  })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 命令 5: parallel - 并行生成测试 (v2.4.0)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
program
  .command('parallel')
  .description('🚀 Parallel test generation (v2.4.0) - 2-3x faster')
  .option('-n, --count <number>', 'Number of functions to generate', parseInt)
  .option('-p, --priority <level>', 'Priority filter (P0, P1, P2, P3)')
  .option('-c, --concurrency <number>', 'Concurrent batches (default: 3, max: 5)', parseInt, 3)
  .option('--report <path>', 'Report file path', 'reports/ut_scores.md')
  .addHelpText('after', `
🚀 Parallel Generation (NEW in v2.4.0):
  - 2-3x faster than sequential generation
  - Uses p-limit for controlled concurrency
  - Groups functions by file for better context
  - Independent batch processing (Prompt → AI → Test → Verify)
  - Detailed progress tracking and summary report

Examples:
  $ ai-test parallel                   # Generate all TODO functions (3 concurrent)
  $ ai-test parallel -n 30             # Generate top 30 functions
  $ ai-test parallel -p P0 -c 5        # All P0 functions, 5 concurrent batches
  $ ai-test parallel -n 50 -c 4        # Top 50 functions, 4 concurrent

Strategy:
  - Functions grouped by file (same file = same batch)
  - Batch size: 3-10 functions (auto-balanced)
  - Max concurrency: 5 (避免 API 限流)
  - Each batch: Independent Prompt + AI + Extract + Test
  - Results merged and status auto-updated

Benefits:
  ✅ 2-3x faster than sequential
  ✅ Better resource utilization
  ✅ Automatic batch optimization
  ✅ Detailed telemetry and logging

Reference:
  - Qodo Cover: Parallel test generation strategy
  - AutoTestGen: Batch processing optimization
  `)
  .action(async (options: ParallelOptions) => {
    const { parallelGenerate } = await import('./workflows/parallel-generate.js')
    await parallelGenerate(options)
  })

program.parse()
