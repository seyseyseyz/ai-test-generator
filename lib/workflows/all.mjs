#!/usr/bin/env node
/**
 * 循环所有批次：每批 N 个，直到没有 TODO
 */

import { readFileSync, existsSync } from 'fs'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgRoot = join(__dirname, '../..')

function sh(cmd, args = []) { return new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: 'inherit', cwd: process.cwd() })
  child.on('close', code => code === 0 ? resolve(0) : reject(new Error(`${cmd} exited ${code}`)))
  child.on('error', reject)
})}

function countTodos(path = 'reports/ut_scores.md') {
  if (!existsSync(path)) return 0
  const md = readFileSync(path, 'utf8')
  return (md.match(/\|\s*TODO\s*\|/g) || []).length
}

async function main(argv = process.argv) {
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
      await sh('node', [join(pkgRoot, 'lib/workflows/batch.mjs'), priority, String(batchSize), String(skip)])
    } catch (err) {
      console.error('Batch failed:', err.message)
    }

    skip += batchSize
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()


