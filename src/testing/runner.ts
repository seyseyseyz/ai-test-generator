#!/usr/bin/env node
// @ts-nocheck
/**
 * 运行 Jest，产出 JSON 与覆盖率
 */

import { spawn } from 'node:child_process'

function runJest(args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['jest', '--json', '--outputFile=reports/jest-report.json', '--coverage', ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    child.on('close', code => code === 0 ? resolve(0) : reject(new Error(`jest exited ${code}`)))
    child.on('error', reject)
  })
}

async function main(argv = process.argv) {
  const extra = argv.slice(2)
  try {
    await runJest(extra)
    process.exit(0)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()


