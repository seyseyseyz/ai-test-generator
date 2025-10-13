#!/usr/bin/env node
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

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

// ============================================================================
// Constants
// ============================================================================

const BACKUP_DIR = 'reports/backups'
const MAX_BACKUPS_PER_FILE = 5  // 每个文件最多保留 5 个备份

// ============================================================================
// Type Definitions
// ============================================================================

/** Backup information */
export interface BackupInfo {
  file: string
  path: string
  size: number
  created: Date
  age: number
}

/** Backup result (success) */
export interface BackupResultSuccess {
  backed: true
  reason: string
  backupPath: string
  originalSize: number
  timestamp: string
}

/** Backup result (failure) */
export interface BackupResultFailure {
  backed: false
  reason: string
  backupPath: null
  error?: Error
}

/** Backup result (union type) */
export type BackupResult = BackupResultSuccess | BackupResultFailure

/** Restore result (success) */
export interface RestoreResultSuccess {
  restored: true
  targetPath: string
  backupPath: string
  timestamp: string
}

/** Restore result (failure) */
export interface RestoreResultFailure {
  restored: false
  error: string
}

/** Restore result (union type) */
export type RestoreResult = RestoreResultSuccess | RestoreResultFailure

/** Safe write file options */
export interface SafeWriteOptions {
  backup?: boolean
  encoding?: BufferEncoding
}

/** Safe write result */
export interface SafeWriteResult {
  success: boolean
  filePath: string
  backupResult: BackupResult | null
  size: number
}

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * 初始化备份目录
 */
function initBackupDir(): void {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

/**
 * 生成备份路径
 * @param filePath - 原文件路径
 * @returns 备份文件路径
 */
function getBackupPath(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = basename(filePath)
  const hash = createHash('md5').update(filePath).digest('hex').substring(0, 8)
  
  return join(BACKUP_DIR, `${fileName}.${hash}.${timestamp}.backup`)
}

/**
 * 清理旧备份（保留最新 N 个）
 * @param filePath - 原文件路径
 */
function cleanupOldBackups(filePath: string): void {
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
    .sort((a, b) => b.time.getTime() - a.time.getTime())  // 按时间倒序
  
  // 删除超出数量的备份
  if (backups.length > MAX_BACKUPS_PER_FILE) {
    backups.slice(MAX_BACKUPS_PER_FILE).forEach(backup => {
      try {
        unlinkSync(backup.path)
      } catch (_error) {
        console.warn(`Failed to delete old backup: ${backup.file}`)
      }
    })
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 备份文件
 * @param filePath - 要备份的文件路径
 * @returns 备份结果
 */
export function backupFile(filePath: string): BackupResult {
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
    const message = error instanceof Error ? error.message : String(error)
    return {
      backed: false,
      reason: `Backup failed: ${message}`,
      backupPath: null,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * 列出文件的所有备份
 * @param filePath - 原文件路径
 * @returns 备份信息数组
 */
export function listBackups(filePath: string): BackupInfo[] {
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
    .sort((a, b) => b.created.getTime() - a.created.getTime())  // 最新的在前
}

/**
 * 恢复备份
 * @param backupPath - 备份文件路径
 * @param targetPath - 目标文件路径
 * @returns 恢复结果
 */
export function restoreBackup(backupPath: string, targetPath: string): RestoreResult {
  if (!existsSync(backupPath)) {
    return {
      restored: false,
      error: `Backup file not found: ${backupPath}`
    }
  }
  
  try {
    // 先备份当前文件（如果存在）
    if (existsSync(targetPath)) {
      const currentBackup = backupFile(targetPath)
      if (currentBackup.backed) {
        console.log(`Current file backed up to: ${currentBackup.backupPath}`)
      }
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
    const message = error instanceof Error ? error.message : String(error)
    return {
      restored: false,
      error: message
    }
  }
}

/**
 * 获取最新备份
 * @param filePath - 原文件路径
 * @returns 最新备份信息，如果没有备份则返回 null
 */
export function getLatestBackup(filePath: string): BackupInfo | null {
  const backups = listBackups(filePath)
  return backups.length > 0 ? backups[0]! : null
}

/**
 * 安全写入文件（自动备份）
 * @param filePath - 文件路径
 * @param content - 文件内容
 * @param options - 写入选项
 * @returns 写入结果
 * @throws 如果写入失败且无法恢复
 */
export function safeWriteFile(
  filePath: string, 
  content: string, 
  options: SafeWriteOptions = {}
): SafeWriteResult {
  const { 
    backup = true,
    encoding = 'utf-8'
  } = options
  
  let backupResult: BackupResult | null = null
  
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
 * @param filePath - 原文件路径
 */
export function showBackupHistory(filePath: string): void {
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

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * CLI 工具
 * @param argv - 命令行参数
 */
async function main(argv: string[] = process.argv): Promise<void> {
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
