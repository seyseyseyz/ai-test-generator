#!/usr/bin/env node
// @ts-nocheck

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split('=') : [a, argv[i + 1]]
      args[k.replace(/^--/, '')] = v === undefined || v.startsWith('--') ? true : v
      if (v !== undefined && !v.startsWith('--') && !a.includes('=')) i++
    }
  }
  return args
}

function run(cmd) {
  const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim()
  return out
}

function loadJson(p) { if (!p || !existsSync(p)) return null; try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }

function assertGitRepo() {
  try {
    const inside = run('git rev-parse --is-inside-work-tree')
    if (inside !== 'true') throw new Error('not a git work tree')
  } catch (e) {
    throw new Error('Not inside a git repository. Ensure git is initialized and files are tracked.')
  }
}

function gitFiles(pattern = 'src') {
  const out = run(`git ls-files "${pattern}"`)
  const files = out ? out.split('\n').filter(Boolean) : []
  if (!files.length) throw new Error(`No tracked files under '${pattern}'. Ensure files are added to git.`)
  return files
}

function detectMultiPlatform(filePath, content) {
  if (filePath.includes('.h5.') || filePath.includes('.crn.')) return true
  if (!content) return false
  return content.includes('xEnv') || content.includes('xUa')
}

function topCategory(path) {
  const parts = path.replace(/\\/g, '/').split('/')
  const idx = parts.indexOf('src')
  return idx >= 0 && idx + 1 < parts.length ? parts[idx + 1] : parts[0]
}

// P1-1: 重命名为 inCategory（文件是否属于核心类别白名单）
function computeInCategory(path, categories = []) {
  const cat = topCategory(path)
  return categories.includes(cat)
}

// P2-2: 批量获取 Git 数据优化
function collectCommitsBatch(files) {
  const byFile = {}
  files.forEach(f => { byFile[f] = { c30: 0, c90: 0, c180: 0, authors: new Set() } })
  
  // 一次性获取所有 commits（180天内）
  const log180 = run('git log --since="180 days ago" --pretty=format:"%H|%an|%ar" --name-only').split('\n\n')
  const now = Date.now()
  const day30 = 30 * 24 * 60 * 60 * 1000
  const day90 = 90 * 24 * 60 * 60 * 1000
  
  for (const block of log180) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    const [hash, author, relTime] = (lines[0] || '').split('|')
    if (!hash) continue
    
    const daysAgo = parseRelativeTime(relTime)
    const isIn30 = daysAgo <= 30
    const isIn90 = daysAgo <= 90
    
    for (let i = 1; i < lines.length; i++) {
      const file = lines[i].trim()
      if (!file || !byFile[file]) continue
      if (isIn30) {
        byFile[file].c30++
        byFile[file].authors.add(author)
      }
      if (isIn90) byFile[file].c90++
      byFile[file].c180++
    }
  }
  
  return byFile
}

function parseRelativeTime(rel) {
  if (!rel) return 999
  const match = rel.match(/(\d+)\s+(day|week|month|year)/)
  if (!match) return 999
  const [, num, unit] = match
  const n = Number(num)
  if (unit.startsWith('day')) return n
  if (unit.startsWith('week')) return n * 7
  if (unit.startsWith('month')) return n * 30
  if (unit.startsWith('year')) return n * 365
  return 999
}

function collectWithExec(files, config) {
  const results = {}
  const crossCats = config?.crossModuleCategories || []
  
  // P2-2: 批量获取所有 commits
  const batchData = collectCommitsBatch(files)
  
  for (const file of files) {
    const data = batchData[file] || { c30: 0, c90: 0, c180: 0, authors: new Set() }
    const commits30d = data.c30
    const commits90d = data.c90
    const commits180d = data.c180
    const authors30d = data.authors.size
    
    let content = ''
    try { content = readFileSync(join(process.cwd(), file), 'utf8') } catch {}
    const multiPlatform = detectMultiPlatform(file, content)
    
    // P1-1: 改名为 inCategory
    const inCategory = computeInCategory(file, crossCats)
    results[file] = { commits30d, commits90d, commits180d, authors30d, inCategory, multiPlatform }
  }
  return results
}

function main() {
  const args = parseArgs(process.argv)
  const outPath = args.out
  const config = loadJson('ut_scoring_config.json') || {}

  assertGitRepo()
  const files = gitFiles('src')
  const results = collectWithExec(files, config)

  const json = JSON.stringify(results, null, 2)
  if (outPath) writeFileSync(outPath, json)
  else process.stdout.write(json)
}

main()
