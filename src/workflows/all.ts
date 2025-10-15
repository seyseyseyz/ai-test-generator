#!/usr/bin/env node
/**
 * 循环所有批次：每批 N 个，直到没有 TODO
 */

import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgRoot = join(__dirname, '../..')

/**
 * 执行 shell 命令
 * @param cmd - 命令
 * @param args - 参数
 * @returns Promise
 */
function sh(cmd: string, args: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd: process.cwd() })
    child.on('close', code => code === 0 ? resolve(0) : reject(new Error(`${cmd} exited ${code}`)))
    child.on('error', reject)
  })
}

/**
 * 统计 TODO 数量
 * @param path - 报告文件路径
 * @returns TODO 数量
 */
function countTodos(path: string = 'reports/ut_scores.md'): number {
  if (!existsSync(path)) return 0
  const md = readFileSync(path, 'utf8')
  return (md.match(/\|\s*TODO\s*\|/g) || []).length
}

/**
 * 主函数
 * @param argv - 命令行参数
 */
async function main(argv: string[] = process.argv): Promise<void> {
  const args = argv.slice(2)
  const priority = args[0] || 'P0'
  const batchSize = Number(args[1] || 10)
  let skip = Number(args[2] || 0)

  while (true) {
    const remain = countTodos()
    if (remain === 0) {
      console.log('✅ All TODO items are done.')
      break
    }
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Batch starting... priority=${priority}, size=${batchSize}, skip=${skip}
Remaining TODO: ${remain}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    try {
      await sh('node', [join(pkgRoot, 'dist/workflows/batch.js'), priority, String(batchSize), String(skip)])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Batch failed:', message)
    }

    skip += batchSize
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
