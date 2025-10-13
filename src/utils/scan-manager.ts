/**
 * 扫描结果管理工具
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
// Type Definitions
// ============================================================================

/** Options for needsRescan function */
export interface NeedsRescanOptions {
  force?: boolean
  targetsPath: string
  scoresPath?: string
  configPath?: string
}

// ============================================================================
// File Change Detection
// ============================================================================

/**
 * 检查源代码是否有变化
 * @param targetsPath - 目标文件路径
 * @param srcDir - 源代码目录
 * @returns 是否有变化
 */
export function hasSourceCodeChanged(targetsPath: string, srcDir: string = 'src'): boolean {
  if (!existsSync(targetsPath)) {
    return true
  }
  
  const targetsTime = statSync(targetsPath).mtimeMs
  return checkDirectoryRecursive(srcDir, targetsTime)
}

/**
 * 递归检查目录中的文件修改时间
 * @param dir - 目录路径
 * @param compareTime - 比较时间戳
 * @returns 是否有文件新于比较时间
 */
function checkDirectoryRecursive(dir: string, compareTime: number): boolean {
  if (!existsSync(dir)) {
    return false
  }
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      
      if (entry.isDirectory()) {
        // 跳过不需要检查的目录
        if (['node_modules', 'dist', '.git', 'reports', 'coverage'].includes(entry.name)) {
          continue
        }
        
        if (checkDirectoryRecursive(fullPath, compareTime)) {
          return true
        }
      } else if (entry.isFile()) {
        // 只检查代码文件
        if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          continue
        }
        
        const fileTime = statSync(fullPath).mtimeMs
        if (fileTime > compareTime) {
          console.log(`   Detected change: ${fullPath}`)
          return true
        }
      }
    }
  } catch (_err) {
    // 忽略权限错误等
    console.warn(`   Warning: Could not access ${dir}`)
  }
  
  return false
}

/**
 * 检查配置文件是否有变化
 * @param configPath - 配置文件路径
 * @param scoresPath - 打分结果文件路径
 * @returns 配置是否新于打分结果
 */
export function hasConfigChanged(configPath: string, scoresPath: string): boolean {
  if (!existsSync(configPath) || !existsSync(scoresPath)) {
    return false
  }
  
  return statSync(configPath).mtimeMs > statSync(scoresPath).mtimeMs
}

// ============================================================================
// Rescan Decision Logic
// ============================================================================

/**
 * 检查是否需要重新扫描
 * @param options - 扫描选项
 * @returns 是否需要重新扫描
 */
export function needsRescan(options: NeedsRescanOptions): boolean {
  const { force, targetsPath, scoresPath, configPath } = options
  
  // 1. 强制重扫
  if (force) {
    return true
  }
  
  // 2. 目标文件不存在
  if (!existsSync(targetsPath)) {
    return true
  }
  
  // 3. 打分结果不存在
  if (scoresPath && !existsSync(scoresPath)) {
    return true
  }
  
  // 4. 源代码有变化
  if (hasSourceCodeChanged(targetsPath)) {
    return true
  }
  
  // 5. 配置文件有变化
  if (configPath && scoresPath && hasConfigChanged(configPath, scoresPath)) {
    return true
  }
  
  return false
}

// ============================================================================
// File Age Utilities
// ============================================================================

/**
 * 获取文件的年龄（小时）
 * @param filePath - 文件路径
 * @returns 文件年龄（小时），如果文件不存在返回 Infinity
 */
export function getFileAgeHours(filePath: string): number {
  if (!existsSync(filePath)) {
    return Infinity
  }
  
  const stats = statSync(filePath)
  return (Date.now() - stats.mtimeMs) / (1000 * 60 * 60)
}
