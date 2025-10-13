#!/usr/bin/env node
// @ts-nocheck
/**
 * Backup Manager - 自动备份管理器
 * 
 * 借鉴 Qodo Cover 的做法：
 * - 写文件前自动备份
 * - 保留历史版本
 * - 支持一键回滚
 * 
 * Reference: Qodo Cover - Auto Backup System
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { createHash } from 'crypto'

const BACKUP_DIR = 'reports/backups'
const MAX_BACKUPS_PER_FILE = 5  // 每个文件最多保留 5 个备份

/**
 * 初始化备份目录
 */
function initBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

/**
 * 生成备份路径
 */
function getBackupPath(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = basename(filePath)
  const hash = createHash('md5').update(filePath).digest('hex').substring(0, 8)
  
  return join(BACKUP_DIR, `${fileName}.${hash}.${timestamp}.backup`)
}

/**
 * 备份文件
 */
export function backupFile(filePath) {
  initBackupDir()
  
  // 文件不存在，无需备份
  if (!existsSync(filePath)) {
    return {
      backed: false,
      reason: 'File does not exist (new file)',
      backupPath: null
    }
  }
  
  const backupPath = getBackupPath(filePath)
  
  try {
    copyFileSync(filePath, backupPath)
    
    // 清理旧备份
    cleanupOldBackups(filePath)
    
    return {
      backed: true,
      reason: 'File backed up successfully',
      backupPath,
      originalSize: statSync(filePath).size,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      backed: false,
      reason: `Backup failed: ${error.message}`,
      backupPath: null,
      error
    }
  }
}

/**
 * 清理旧备份（保留最新 N 个）
 */
function cleanupOldBackups(filePath) {
  const fileName = basename(filePath)
  const hash = createHash('md5').update(filePath).digest('hex').substring(0, 8)
  
  // 找到该文件的所有备份
  const backups = readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith(`${fileName}.${hash}.`))
    .map(file => ({
      file,
      path: join(BACKUP_DIR, file),
      time: statSync(join(BACKUP_DIR, file)).mtime
    }))
    .sort((a, b) => b.time - a.time)  // 按时间倒序
  
  // 删除超出数量的备份
  if (backups.length > MAX_BACKUPS_PER_FILE) {
    backups.slice(MAX_BACKUPS_PER_FILE).forEach(backup => {
      try {
        unlinkSync(backup.path)
      } catch (error) {
        console.warn(`Failed to delete old backup: ${backup.file}`)
      }
    })
  }
}

/**
 * 列出文件的所有备份
 */
export function listBackups(filePath) {
  if (!existsSync(BACKUP_DIR)) {
    return []
  }
  
  const fileName = basename(filePath)
  const hash = createHash('md5').update(filePath).digest('hex').substring(0, 8)
  
  return readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith(`${fileName}.${hash}.`))
    .map(file => {
      const path = join(BACKUP_DIR, file)
      const stats = statSync(path)
      return {
        file,
        path,
        size: stats.size,
        created: stats.mtime,
        age: Date.now() - stats.mtime.getTime()
      }
    })
    .sort((a, b) => b.created - a.created)  // 最新的在前
}

/**
 * 恢复备份
 */
export function restoreBackup(backupPath, targetPath) {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`)
  }
  
  try {
    // 先备份当前文件（如果存在）
    if (existsSync(targetPath)) {
      const currentBackup = backupFile(targetPath)
      console.log(`Current file backed up to: ${currentBackup.backupPath}`)
    }
    
    // 恢复备份
    copyFileSync(backupPath, targetPath)
    
    return {
      restored: true,
      targetPath,
      backupPath,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      restored: false,
      error: error.message
    }
  }
}

/**
 * 获取最新备份
 */
export function getLatestBackup(filePath) {
  const backups = listBackups(filePath)
  return backups.length > 0 ? backups[0] : null
}

/**
 * 安全写入文件（自动备份）
 */
export function safeWriteFile(filePath, content, options = {}) {
  const { 
    backup = true,
    encoding = 'utf-8'
  } = options
  
  let backupResult = null
  
  // 1. 备份
  if (backup && existsSync(filePath)) {
    backupResult = backupFile(filePath)
    if (backupResult.backed) {
      console.log(`📦 Backup created: ${backupResult.backupPath}`)
    }
  }
  
  // 2. 写入
  try {
    // 确保目录存在
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    writeFileSync(filePath, content, encoding)
    
    return {
      success: true,
      filePath,
      backupResult,
      size: Buffer.byteLength(content, encoding)
    }
  } catch (error) {
    // 3. 写入失败，尝试恢复备份
    if (backupResult && backupResult.backed) {
      console.error('❌ Write failed, restoring backup...')
      const restore = restoreBackup(backupResult.backupPath, filePath)
      if (restore.restored) {
        console.log('✅ Backup restored successfully')
      }
    }
    
    throw error
  }
}

/**
 * 显示备份历史
 */
export function showBackupHistory(filePath) {
  const backups = listBackups(filePath)
  
  if (backups.length === 0) {
    console.log(`No backups found for: ${filePath}`)
    return
  }
  
  console.log(`\n📦 Backup History for: ${filePath}\n`)
  console.log(`Total backups: ${backups.length}`)
  console.log(`Max backups: ${MAX_BACKUPS_PER_FILE}\n`)
  
  backups.forEach((backup, idx) => {
    const age = Math.floor(backup.age / 1000 / 60)  // minutes
    const sizeKB = (backup.size / 1024).toFixed(2)
    console.log(`${idx + 1}. ${backup.file}`)
    console.log(`   Created: ${backup.created.toISOString()}`)
    console.log(`   Age: ${age} minutes ago`)
    console.log(`   Size: ${sizeKB} KB`)
    console.log(`   Path: ${backup.path}`)
    console.log()
  })
}

/**
 * CLI 工具
 */
async function main(argv = process.argv) {
  const [cmd, ...args] = argv.slice(2)
  
  if (!cmd) {
    console.log(`
Usage:
  node backup-manager.mjs backup <file>      # Backup a file
  node backup-manager.mjs list <file>        # List backups
  node backup-manager.mjs restore <backup>   # Restore a backup
  node backup-manager.mjs history <file>     # Show backup history

Examples:
  node backup-manager.mjs backup src/utils/format.test.ts
  node backup-manager.mjs list src/utils/format.test.ts
  node backup-manager.mjs restore reports/backups/format.test.ts.abc123.backup
`)
    return
  }
  
  switch (cmd) {
    case 'backup': {
      const filePath = args[0]
      if (!filePath) {
        console.error('Error: File path required')
        process.exit(1)
      }
      const result = backupFile(filePath)
      console.log(JSON.stringify(result, null, 2))
      break
    }
    
    case 'list': {
      const filePath = args[0]
      if (!filePath) {
        console.error('Error: File path required')
        process.exit(1)
      }
      const backups = listBackups(filePath)
      console.log(JSON.stringify(backups, null, 2))
      break
    }
    
    case 'restore': {
      const backupPath = args[0]
      const targetPath = args[1]
      if (!backupPath || !targetPath) {
        console.error('Error: Backup path and target path required')
        process.exit(1)
      }
      const result = restoreBackup(backupPath, targetPath)
      console.log(JSON.stringify(result, null, 2))
      break
    }
    
    case 'history': {
      const filePath = args[0]
      if (!filePath) {
        console.error('Error: File path required')
        process.exit(1)
      }
      showBackupHistory(filePath)
      break
    }
    
    default:
      console.error(`Unknown command: ${cmd}`)
      process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

