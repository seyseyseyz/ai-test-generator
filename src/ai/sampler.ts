/**
// @ts-nocheck
 * 代码文件采样工具
 * 智能选择代表性代码文件供 AI 分析
 */

import { readFileSync, statSync } from 'node:fs'
import fg from 'fast-glob'

/**
 * 智能采样代码文件
 * @returns {Array} 采样结果
 */
export async function sampleCodeFiles() {
  const samples = []
  
  // 策略 1: 按目录分层采样（确保覆盖各层）
  const layers = {
    services: await fg('src/services/**/*.{ts,tsx}'),
    components: await fg('src/components/**/*.{ts,tsx}'),
    utils: await fg('src/utils/**/*.{ts,tsx}'),
    atoms: await fg('src/atoms/**/*.{ts,tsx}'),
    stores: await fg('src/stores/**/*.{ts,tsx}'),
    hooks: await fg('src/hooks/**/*.{ts,tsx}'),
    context: await fg('src/context/**/*.{ts,tsx}')
  }
  
  for (const [layer, files] of Object.entries(layers)) {
    if (files.length === 0) continue
    
    // 每层选 2-3 个文件
    const selected = files
      .map(f => ({
        path: f,
        size: statSync(f).size,
        name: f.split('/').pop()
      }))
      .sort((a, b) => b.size - a.size) // 按文件大小排序
      .slice(0, 3)
    
    for (const file of selected) {
      samples.push({
        path: file.path,
        layer,
        reason: `${layer}_representative`,
        preview: readFileSync(file.path, 'utf-8').slice(0, 1500) // 前1500字符
      })
    }
  }
  
  // 策略 2: 关键词匹配（业务关键代码）
  const keywords = ['payment', 'order', 'booking', 'checkout', 'price', 'cart', 'hotel', 'room']
  const criticalFiles = await fg('src/**/*.{ts,tsx}')
  
  for (const keyword of keywords) {
    const matched = criticalFiles.filter(f => f.toLowerCase().includes(keyword))
    if (matched.length > 0) {
      const file = matched[0] // 取第一个
      if (!samples.find(s => s.path === file)) {
        samples.push({
          path: file,
          layer: 'business',
          reason: `critical_keyword_${keyword}`,
          preview: readFileSync(file, 'utf-8').slice(0, 1500)
        })
      }
    }
  }
  
  // 去重
  const uniqueSamples = samples.filter((s, i, arr) => 
    arr.findIndex(x => x.path === s.path) === i
  )
  
  return uniqueSamples.slice(0, 25) // 最多 25 个样本
}

/**
 * 分析项目结构
 */
export async function analyzeProjectStructure() {
  const allFiles = await fg('src/**/*.{ts,tsx,js,jsx}')
  
  let totalLines = 0
  for (const file of allFiles) {
    try {
      const content = readFileSync(file, 'utf-8')
      totalLines += content.split('\n').length
    } catch {}
  }
  
  return {
    totalFiles: allFiles.length,
    totalLines,
    avgLinesPerFile: Math.round(totalLines / allFiles.length)
  }
}

