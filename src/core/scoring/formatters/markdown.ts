/**
 * Markdown 格式化器
 */

import { readFileSync, existsSync } from 'node:fs'
import type { ScoredTarget } from '../types.js'

/**
 * 生成 Markdown 报告
 */
export function formatMarkdown(
  rows: ScoredTarget[],
  statusMap: Map<string, string> = new Map()
): string {
  // 按总分降序排序（高分在前）
  const sorted = [...rows].sort((a, b) => b.score - a.score)
  
  let md = '<!-- UT Priority Scoring Report -->\n'
  md += '<!-- Format: Status can be "TODO" | "DONE" | "SKIP" -->\n'
  md += '<!-- You can mark status by replacing TODO with DONE or SKIP -->\n\n'
  md += '| Status | Score | Priority | Name | Type | Layer | Path | Coverage | CS | BC | CC | ER | Testability | DepCount |\n'
  md += '|--------|-------|----------|------|------|-------|------|----------|----|----|----|----|-----------|----------|\n'
  
  sorted.forEach(r => {
    // 从状态映射中查找现有状态，否则默认为 TODO
    const key = `${r.path}#${r.name}`
    const status = statusMap.get(key) || 'TODO'
    const coveragePct = (r as any).coveragePct
    const layerName = (r as any).layerName
    md += `| ${status} | ${r.score} | ${r.priority} | ${r.name} | ${r.type} | ${layerName || r.layer} | ${r.path} | ${typeof coveragePct === 'number' ? coveragePct.toFixed(1) + '%':'N/A'} | ${r.coverageScore ?? 'N/A'} | ${r.BC} | ${r.CC} | ${r.ER} | ${r.testability || r.ROI} | ${r.dependencyCount || 'N/A'} |\n` 
  })
  
  // 添加统计信息
  md += '\n---\n\n'
  md += '## 📊 Summary\n\n'
  const p0 = sorted.filter(r => r.priority === 'P0').length
  const p1 = sorted.filter(r => r.priority === 'P1').length
  const p2 = sorted.filter(r => r.priority === 'P2').length
  const p3 = sorted.filter(r => r.priority === 'P3').length
  md += `- **Total Targets**: ${sorted.length}\n`
  md += `- **P0 (Must Test)**: ${p0}\n`
  md += `- **P1 (High Priority)**: ${p1}\n`
  md += `- **P2 (Medium Priority)**: ${p2}\n`
  md += `- **P3 (Low Priority)**: ${p3}\n\n`
  md += '## 🎯 Quick Commands\n\n'
  md += '```bash\n'
  md += '# View P0 targets only\n'
  md += 'grep "| TODO.*P0 |" reports/ut_scores.md\n\n'
  md += '# Mark a target as DONE (example)\n'
  md += 'sed -i "" "s/| TODO | 9.3 | P0 | findRecommendRoom/| DONE | 9.3 | P0 | findRecommendRoom/" reports/ut_scores.md\n\n'
  md += '# Count remaining TODO items\n'
  md += 'grep -c "| TODO |" reports/ut_scores.md\n'
  md += '```\n'
  
  return md 
}

/**
 * 读取现有 Markdown 文件中的状态
 */
export function readExistingStatus(mdPath: string): Map<string, string> {
  const statusMap = new Map<string, string>()
  
  if (!existsSync(mdPath)) {
    return statusMap
  }
  
  try {
    const content = readFileSync(mdPath, 'utf-8')
    const lines = content.split('\n')
    
    for (const line of lines) {
      // 匹配表格行：| STATUS | ... | NAME | ... | PATH | ...
      const match = line.match(/^\|\s*(TODO|DONE|SKIP)\s*\|[^|]*\|[^|]*\|\s*([^|]+)\s*\|[^|]*\|[^|]*\|\s*([^|]+)\s*\|/)
      if (match) {
        const status = match[1] as string
        const name = match[2]?.trim() || ''
        const path = match[3]?.trim() || ''
        if (!name || !path) continue
        const key = `${path}#${name}`
        statusMap.set(key, status)
      }
    }
  } catch (error) {
    console.error(`Failed to read existing status from ${mdPath}:`, error)
  }
  
  return statusMap
}

