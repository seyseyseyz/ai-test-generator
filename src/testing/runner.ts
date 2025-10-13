#!/usr/bin/env node
/**
 * 运行 Jest，产出 JSON 与覆盖率
 */

import { spawn } from 'node:child_process'

/**
 * 运行 Jest 测试
 * @param args - Jest 命令行参数
 * @returns Promise，成功时 resolve，失败时 reject
 */
function runJest(args: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['jest', '--json', '--outputFile=reports/jest-report.json', '--coverage', ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    child.on('close', code => code === 0 ? resolve(0) : reject(new Error(`jest exited ${code}`)))
    child.on('error', reject)
  })
}

/**
 * CLI 入口
 * @param argv - 命令行参数
 */
async function main(argv: string[] = process.argv): Promise<void> {
  const extra = argv.slice(2)
  try {
    await runJest(extra)
    process.exit(0)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
