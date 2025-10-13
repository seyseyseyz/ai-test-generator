#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GitSignals, AITestConfig } from '../types/index.js'
import { parseArgs, showError } from '../shared/cli-utils.js'
import { loadJson, writeFile } from '../shared/file-utils.js'
import { runCommand } from '../shared/process-utils.js'
import { getTopCategory } from '../shared/path-utils.js'

/**
 * Commit data for a single file
 */
interface FileCommitData {
  c30: number
  c90: number
  c180: number
  authors: Set<string>
}

/**
 * Verify current directory is a git repository
 */
function assertGitRepo(): void {
  try {
    const inside = runCommand('git rev-parse --is-inside-work-tree')
    if (inside !== 'true') throw new Error('not a git work tree')
  } catch (e) {
    throw new Error('Not inside a git repository. Ensure git is initialized and files are tracked.')
  }
}

/**
 * Get tracked files from git
 */
function gitFiles(pattern: string = 'src'): string[] {
  const out = runCommand(`git ls-files "${pattern}"`)
  const files = out ? out.split('\n').filter(Boolean) : []
  if (!files.length) {
    throw new Error(`No tracked files under '${pattern}'. Ensure files are added to git.`)
  }
  return files
}

/**
 * Detect if file is multi-platform
 */
function detectMultiPlatform(filePath: string, content: string): boolean {
  if (filePath.includes('.h5.') || filePath.includes('.crn.')) return true
  if (!content) return false
  return content.includes('xEnv') || content.includes('xUa')
}

/**
 * Check if file belongs to core categories
 * P1-1: Renamed to inCategory
 */
function computeInCategory(path: string, categories: string[] = []): boolean {
  const cat = getTopCategory(path)
  return categories.includes(cat)
}

/**
 * P2-2: Batch collect Git commit data for optimization
 */
function collectCommitsBatch(files: string[]): Record<string, FileCommitData> {
  const byFile: Record<string, FileCommitData> = {}
  files.forEach(f => { 
    byFile[f] = { c30: 0, c90: 0, c180: 0, authors: new Set() } 
  })
  
  // 一次性获取所有 commits（180天内）
  const log180 = runCommand('git log --since="180 days ago" --pretty=format:"%H|%an|%ar" --name-only')
    .split('\n\n')
  
  for (const block of log180) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    const firstLine = lines[0] || ''
    const [hash, author, relTime] = firstLine.split('|')
    if (!hash) continue
    
    const daysAgo = parseRelativeTime(relTime || '')
    const isIn30 = daysAgo <= 30
    const isIn90 = daysAgo <= 90
    
    for (let i = 1; i < lines.length; i++) {
      const file = lines[i]?.trim()
      if (!file || !byFile[file]) continue
      
      if (isIn30) {
        byFile[file].c30++
        if (author) {
          byFile[file].authors.add(author)
        }
      }
      if (isIn90) byFile[file].c90++
      byFile[file].c180++
    }
  }
  
  return byFile
}

/**
 * Parse relative time string to days
 */
function parseRelativeTime(rel: string): number {
  if (!rel) return 999
  const match = rel.match(/(\d+)\s+(day|week|month|year)/)
  if (!match) return 999
  
  const [, num, unit] = match
  if (!unit) return 999
  
  const n = Number(num)
  if (unit.startsWith('day')) return n
  if (unit.startsWith('week')) return n * 7
  if (unit.startsWith('month')) return n * 30
  if (unit.startsWith('year')) return n * 365
  return 999
}

/**
 * Collect Git data with exec optimization
 */
function collectWithExec(files: string[], config: AITestConfig | null): Record<string, GitSignals> {
  const results: Record<string, GitSignals> = {}
  const crossCats = (config as any)?.crossModuleCategories || []
  
  // P2-2: Batch collect all commits
  const batchData = collectCommitsBatch(files)
  
  for (const file of files) {
    const data = batchData[file] || { c30: 0, c90: 0, c180: 0, authors: new Set() }
    const commits30d = data.c30
    const commits90d = data.c90
    const commits180d = data.c180
    const authors30d = data.authors.size
    
    let content = ''
    try { 
      content = readFileSync(join(process.cwd(), file), 'utf8') 
    } catch {}
    const multiPlatform = detectMultiPlatform(file, content)
    
    // P1-1: Renamed to inCategory
    const inCategory = computeInCategory(file, crossCats)
    results[file] = { 
      commits30d, 
      commits90d, 
      commits180d, 
      authors30d, 
      inCategory, 
      multiPlatform 
    }
  }
  return results
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs()
  const outPath = typeof args.out === 'string' ? args.out : undefined
  const config = loadJson<AITestConfig>('ut_scoring_config.json', null)

  try {
    assertGitRepo()
    const files = gitFiles('src')
    const results = collectWithExec(files, config)

    const json = JSON.stringify(results, null, 2)
    if (outPath) {
      writeFile(outPath, json)
    } else {
      process.stdout.write(json)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    showError(message)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
