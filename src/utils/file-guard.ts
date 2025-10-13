#!/usr/bin/env node
// @ts-nocheck
/**
 * File Guard - 文件写入保护
 * 
 * 借鉴 Qodo Cover 的最小权限原则：
 * - 只允许写入测试文件
 * - 阻止修改源代码
 * - 提供详细的错误信息
 * 
 * Reference: Qodo Cover - Minimum Privilege Principle
 */

import { basename, extname, dirname, resolve, relative } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * 允许的测试文件模式
 */
const ALLOWED_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,     // *.test.ts, *.test.js
  /\.spec\.(ts|tsx|js|jsx)$/,     // *.spec.ts, *.spec.js
  /__tests__\/.*\.(ts|tsx|js|jsx)$/, // __tests__/**/*.ts
]

/**
 * 允许的测试目录
 */
const ALLOWED_DIRS = [
  '__tests__',
  'tests',
  'test',
  '__mocks__',
]

/**
 * 禁止的文件模式（即使在测试目录）
 */
const FORBIDDEN_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
]

/**
 * 检查文件路径是否安全
 */
export function isAllowedPath(filePath) {
  const normalizedPath = resolve(filePath)
  const relativePath = relative(process.cwd(), normalizedPath)
  
  // 1. 检查是否在禁止目录
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(relativePath)) {
      return {
        allowed: false,
        reason: `Forbidden directory: ${pattern}`,
        category: 'forbidden_dir'
      }
    }
  }
  
  // 2. 检查文件名模式（最重要）
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(relativePath)) {
      return {
        allowed: true,
        reason: 'Valid test file pattern',
        category: 'valid_pattern'
      }
    }
  }
  
  // 3. 检查是否在允许的测试目录
  const pathParts = relativePath.split('/')
  for (const allowedDir of ALLOWED_DIRS) {
    if (pathParts.includes(allowedDir)) {
      // 在测试目录内，但文件名不符合模式
      return {
        allowed: false,
        reason: `File in test directory but wrong naming: ${basename(filePath)} (expected *.test.ts or *.spec.ts)`,
        category: 'wrong_naming',
        suggestion: `Rename to: ${basename(filePath, extname(filePath))}.test${extname(filePath)}`
      }
    }
  }
  
  // 4. 都不匹配 - 不允许
  return {
    allowed: false,
    reason: 'Not a test file. Only test files can be created/modified.',
    category: 'not_test_file',
    suggestion: `Move to __tests__/ or rename to *.test.ts`
  }
}

/**
 * 守卫文件写入操作
 * @throws {Error} 如果文件不允许写入
 */
export function guardWrite(filePath) {
  const check = isAllowedPath(filePath)
  
  if (!check.allowed) {
    const error = new Error(
      `❌ File Guard: Write operation blocked\n\n` +
      `File: ${filePath}\n` +
      `Reason: ${check.reason}\n` +
      (check.suggestion ? `Suggestion: ${check.suggestion}\n` : '') +
      `\n` +
      `🔒 Security: Only test files can be created/modified.\n` +
      `This prevents accidental modification of source code.\n` +
      `\n` +
      `Allowed patterns:\n` +
      `  - *.test.ts / *.test.js\n` +
      `  - *.spec.ts / *.spec.js\n` +
      `  - __tests__/**/*.ts\n` +
      `\n` +
      `Reference: Qodo Cover - Minimum Privilege Principle`
    )
    error.code = 'FILE_GUARD_BLOCKED'
    error.category = check.category
    error.filePath = filePath
    throw error
  }
  
  return check
}

/**
 * 批量检查文件路径
 */
export function guardWriteMultiple(filePaths) {
  const results = {
    allowed: [],
    blocked: []
  }
  
  for (const filePath of filePaths) {
    try {
      const check = guardWrite(filePath)
      results.allowed.push({ filePath, check })
    } catch (error) {
      results.blocked.push({ filePath, error })
    }
  }
  
  return results
}

/**
 * 获取安全的测试文件路径
 * 如果输入不安全，自动转换为安全路径
 */
export function getSafeTestPath(sourcePath) {
  // 移除扩展名
  const ext = extname(sourcePath)
  const base = basename(sourcePath, ext)
  const dir = dirname(sourcePath)
  
  // 如果已经是测试文件，直接返回
  const check = isAllowedPath(sourcePath)
  if (check.allowed) {
    return sourcePath
  }
  
  // 转换为测试文件路径
  const testFileName = `${base}.test${ext}`
  
  // 优先放在 __tests__ 目录
  const testsDir = `${dir}/__tests__`
  const safePath = `${testsDir}/${testFileName}`
  
  return safePath
}

/**
 * CLI 工具 - 检查文件路径
 */
async function main(argv = process.argv) {
  const filePaths = argv.slice(2)
  
  if (filePaths.length === 0) {
    console.log(`
Usage: node file-guard.mjs <file1> [file2] [...]

Examples:
  node file-guard.mjs src/utils/format.test.ts  ✅
  node file-guard.mjs src/utils/format.ts       ❌
  node file-guard.mjs __tests__/format.test.ts  ✅
`)
    process.exit(0)
  }
  
  console.log('🔍 Checking file paths...\n')
  
  const results = guardWriteMultiple(filePaths)
  
  // 显示允许的文件
  if (results.allowed.length > 0) {
    console.log('✅ Allowed files:')
    results.allowed.forEach(({ filePath, check }) => {
      console.log(`   ${filePath}`)
      console.log(`   → ${check.reason}`)
    })
    console.log()
  }
  
  // 显示被阻止的文件
  if (results.blocked.length > 0) {
    console.log('❌ Blocked files:')
    results.blocked.forEach(({ filePath, error }) => {
      console.log(`   ${filePath}`)
      console.log(`   → ${error.message.split('\n')[2]}`) // 只显示原因
    })
    console.log()
  }
  
  // 退出码
  process.exit(results.blocked.length > 0 ? 1 : 0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

