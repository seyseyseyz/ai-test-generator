/**
 * CSV 格式化器
 */

import type { ScoredTarget } from '../types.js'

/**
 * 生成 CSV 报告
 */
export function formatCSV(rows: ScoredTarget[]): string {
  // 按总分降序排序（高分在前）
  const sorted = [...rows].sort((a, b) => b.score - a.score)
  
  const head = ['status','score','priority','name','path','type','layer','layerName','coveragePct','coverageScore','BC','CC','ER','testability','dependencyCount'].join(',')
  const body = sorted.map(r => {
    const coveragePct = (r as any).coveragePct
    const layerName = (r as any).layerName
    
    return [
      'TODO',
      r.score,
      r.priority,
      r.name,
      r.path,
      r.type,
      r.layer || 'N/A',
      layerName || 'N/A',
      (typeof coveragePct === 'number' ? coveragePct.toFixed(1) + '%' : 'N/A'),
      (r.coverageScore ?? 'N/A'),
      r.BC,
      r.CC,
      r.ER,
      r.testability || r.ROI,
      r.dependencyCount || 'N/A'
    ].join(',')
  }).join('\n')
  
  return head + '\n' + body + '\n'
}

