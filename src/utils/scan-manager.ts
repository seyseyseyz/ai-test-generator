// @ts-nocheck
/**
 * 扫描结果管理工具
 */

import { existsSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 检查源代码是否有变化
 */
export function hasSourceCodeChanged(targetsPath, srcDir = 'src') {
  if (!existsSync(targetsPath)) {
    return true
  }
  
  const targetsTime = statSync(targetsPath).mtimeMs
  return checkDirectoryRecursive(srcDir, targetsTime)
}

/**
 * 递归检查目录中的文件修改时间
 */
function checkDirectoryRecursive(dir, compareTime) {
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
  } catch (err) {
    // 忽略权限错误等
    console.warn(`   Warning: Could not access ${dir}`)
  }
  
  return false
}

/**
 * 检查配置文件是否有变化
 */
export function hasConfigChanged(configPath, scoresPath) {
  if (!existsSync(configPath) || !existsSync(scoresPath)) {
    return false
  }
  
  return statSync(configPath).mtimeMs > statSync(scoresPath).mtimeMs
}

/**
 * 检查是否需要重新扫描
 * @returns {boolean}
 */
export function needsRescan(options) {
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

/**
 * 获取文件的年龄（小时）
 */
export function getFileAgeHours(filePath) {
  if (!existsSync(filePath)) {
    return Infinity
  }
  
  const stats = statSync(filePath)
  return (Date.now() - stats.mtimeMs) / (1000 * 60 * 60)
}

