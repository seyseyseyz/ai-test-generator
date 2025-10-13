/**
 * 覆盖率解析器（Keploy 风格）
 * 
 * 支持 Cobertura XML 格式（Keploy 要求）和 Jest coverage-final.json（后备）
 * 提供行级覆盖率数据，精确定位未覆盖行。
 * 
 * 参考:
 * - Keploy ut-gen: https://github.com/keploy/keploy/blob/main/README-UnitGen.md
 * - Cobertura: http://cobertura.github.io/cobertura/
 * 
 * @module coverage-parser
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
// Local Type Definitions
// ============================================================================

/** Uncovered line information */
export interface UncoveredLine {
  file: string
  lineNumber: number
  hits: number
  isBranch?: boolean
}

/** Internal file coverage details with additional fields */
interface InternalFileCoverage {
  totalLines: number
  coveredLines: number
  uncoveredLines: number[]
  coverage: number
  branchPoints?: number
  coveredBranches?: number
  branchCoverage?: number
  statements?: Record<string, number>
  branches?: Record<string, number[]>
  functions?: Record<string, number>
}

/** Coverage data (generic) */
export interface CoverageData {
  format: string
  lineRate: number
  branchRate?: number
  linesCovered: number
  linesValid: number
  uncoveredLines: UncoveredLine[]
  filesCoverage: Record<string, InternalFileCoverage>
  error?: string
}

/** Coverage comparison result */
export interface CoverageDiff {
  lineRateDiff: number
  linesCoveredDiff: number
  uncoveredLinesReduced: number
  newlyCovered: UncoveredLine[]
  stillUncovered: UncoveredLine[]
}

// ============================================================================
// Cobertura XML Parser
// ============================================================================

/**
 * 解析 Cobertura XML 覆盖率报告
 * @param xmlPath - coverage.xml 文件路径
 * @returns 覆盖率数据
 */
export async function parseCoberturaXml(xmlPath: string): Promise<CoverageData> {
  if (!existsSync(xmlPath)) {
    throw new Error(`Cobertura XML not found: ${xmlPath}`)
  }
  
  const xml = readFileSync(xmlPath, 'utf-8')
  
  // 动态导入 xml2js（避免必须依赖）
  let parseStringPromise: (xml: string) => Promise<unknown>
  try {
    // @ts-expect-error - xml2js may not have types
    const xml2js = await import('xml2js')
    parseStringPromise = xml2js.parseStringPromise
  } catch (_error) {
    throw new Error('xml2js not installed. Run: npm install xml2js')
  }
  
  const result = await parseStringPromise(xml) as Record<string, unknown>
  
  const coverageRoot = result.coverage as Record<string, unknown>
  const coverageAttrs = (coverageRoot.$ || {}) as Record<string, string>
  
  const coverage: CoverageData = {
    format: 'cobertura',
    lineRate: parseFloat(coverageAttrs['line-rate'] || '0'),
    branchRate: parseFloat(coverageAttrs['branch-rate'] || '0'),
    linesCovered: parseInt(coverageAttrs['lines-covered'] || '0'),
    linesValid: parseInt(coverageAttrs['lines-valid'] || '0'),
    uncoveredLines: [],
    filesCoverage: {}
  }
  
  // 解析每个包（package）
  const packagesArray = (coverageRoot.packages as Record<string, unknown>[] | undefined)?.[0]
  const packages = ((packagesArray as Record<string, unknown>)?.package || []) as Record<string, unknown>[]
  
  for (const pkg of packages) {
    const classesArray = (pkg.classes as Record<string, unknown>[] | undefined)?.[0]
    const classes = ((classesArray as Record<string, unknown>)?.class || []) as Record<string, unknown>[]
    
    for (const cls of classes) {
      const clsAttrs = (cls.$ || {}) as Record<string, string>
      const filename: string = clsAttrs.filename || ''
      const linesArray = (cls.lines as Record<string, unknown>[] | undefined)?.[0]
      const lines = ((linesArray as Record<string, unknown>)?.line || []) as Record<string, unknown>[]
      
      const fileCoverage: InternalFileCoverage = {
        totalLines: lines.length,
        coveredLines: 0,
        uncoveredLines: [],
        branchPoints: 0,
        coveredBranches: 0,
        coverage: 0
      }
      
      for (const line of lines) {
        const lineAttrs = (line.$ || {}) as Record<string, string>
        const lineNumber = parseInt(lineAttrs.number || '0')
        const hits = parseInt(lineAttrs.hits || '0')
        const isBranch = lineAttrs.branch === 'true'
        
        if (isBranch && fileCoverage.branchPoints !== undefined) {
          fileCoverage.branchPoints++
          const branchRate = lineAttrs['condition-coverage']
          if (branchRate && branchRate.includes('100%') && fileCoverage.coveredBranches !== undefined) {
            fileCoverage.coveredBranches++
          }
        }
        
        if (hits === 0) {
          // 未覆盖行
          coverage.uncoveredLines.push({
            file: filename,
            lineNumber,
            hits,
            isBranch
          })
          fileCoverage.uncoveredLines.push(lineNumber)
        } else {
          fileCoverage.coveredLines++
        }
      }
      
      fileCoverage.coverage = fileCoverage.totalLines > 0 
        ? fileCoverage.coveredLines / fileCoverage.totalLines 
        : 0
      
      fileCoverage.branchCoverage = (fileCoverage.branchPoints || 0) > 0
        ? (fileCoverage.coveredBranches || 0) / (fileCoverage.branchPoints || 1)
        : 1
      
      coverage.filesCoverage[filename] = fileCoverage
    }
  }
  
  return coverage
}

// ============================================================================
// Jest JSON Parser
// ============================================================================

/**
 * 解析 Jest 的 coverage-final.json（后备方案）
 * @param jsonPath - coverage-final.json 文件路径
 * @returns 覆盖率数据
 */
export function parseJestCoverageJson(jsonPath: string): CoverageData {
  if (!existsSync(jsonPath)) {
    throw new Error(`Coverage JSON not found: ${jsonPath}`)
  }
  
  const coverageData: Record<string, unknown> = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  
  const coverage: CoverageData = {
    format: 'jest-json',
    lineRate: 0,
    linesCovered: 0,
    linesValid: 0,
    uncoveredLines: [],
    filesCoverage: {}
  }
  
  let totalLines = 0
  let coveredLines = 0
  
  for (const [filePath, fileDataRaw] of Object.entries(coverageData)) {
    const fileData = fileDataRaw as Record<string, unknown>
    const statementMap = (fileData.statementMap || {}) as Record<string, unknown>
    const s = (fileData.s || {}) as Record<string, number>  // statement execution counts
    
    const uncoveredLines: number[] = []
    let fileTotal = 0
    let fileCovered = 0
    
    for (const [stmtId, count] of Object.entries(s)) {
      fileTotal++
      
      if (count === 0) {
        const stmt = statementMap[stmtId] as { start?: { line?: number } } | undefined
        const lineNumber = stmt?.start?.line || 0
        
        uncoveredLines.push(lineNumber)
        coverage.uncoveredLines.push({
          file: filePath,
          lineNumber,
          hits: 0
        })
      } else {
        fileCovered++
      }
    }
    
    totalLines += fileTotal
    coveredLines += fileCovered
    
    const b = fileData.b as Record<string, number[]> | undefined
    
    coverage.filesCoverage[filePath] = {
      totalLines: fileTotal,
      coveredLines: fileCovered,
      uncoveredLines: [...new Set(uncoveredLines)].sort((a, b) => a - b),
      coverage: fileTotal > 0 ? fileCovered / fileTotal : 0,
      statements: fileData.s as Record<string, number> || {},
      branches: fileData.b as Record<string, number[]> || {},
      functions: fileData.f as Record<string, number> || {},
      branchCoverage: b ? calculateBranchCoverage(b) : 0
    }
  }
  
  coverage.lineRate = totalLines > 0 ? coveredLines / totalLines : 0
  coverage.linesCovered = coveredLines
  coverage.linesValid = totalLines
  
  return coverage
}

/**
 * 计算分支覆盖率
 * @param branches - 分支覆盖数据
 * @returns 分支覆盖率（0-1）
 */
function calculateBranchCoverage(branches: Record<string, number[]>): number {
  let total = 0
  let covered = 0
  
  for (const branchArray of Object.values(branches)) {
    for (const branchHits of branchArray) {
      total++
      if (branchHits > 0) covered++
    }
  }
  
  return total > 0 ? covered / total : 0
}

// ============================================================================
// High-Level Functions
// ============================================================================

/**
 * 查找未覆盖行（自动选择最佳格式）
 * @param coverageDir - 覆盖率目录（默认: coverage）
 * @returns 覆盖率数据
 */
export async function findUncoveredLines(coverageDir: string = 'coverage'): Promise<CoverageData> {
  const coberturaPath = join(coverageDir, 'cobertura-coverage.xml')
  const jestJsonPath = join(coverageDir, 'coverage-final.json')
  
  try {
    // 优先使用 Cobertura（Keploy 风格）
    if (existsSync(coberturaPath)) {
      console.log('📊 Using Cobertura XML for line-level coverage (Keploy style)')
      return await parseCoberturaXml(coberturaPath)
    }
    
    // 后备：Jest JSON
    if (existsSync(jestJsonPath)) {
      console.log('📊 Using Jest coverage-final.json (fallback)')
      return parseJestCoverageJson(jestJsonPath)
    }
    
    throw new Error('No coverage data found. Expected: cobertura-coverage.xml or coverage-final.json')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('❌ Coverage parsing failed:', message)
    return {
      format: 'none',
      lineRate: 0,
      linesCovered: 0,
      linesValid: 0,
      uncoveredLines: [],
      filesCoverage: {},
      error: message
    }
  }
}

/**
 * 获取特定文件的未覆盖行
 * @param filePath - 文件路径
 * @param coverageDir - 覆盖率目录
 * @returns 未覆盖行号列表
 */
export async function getUncoveredLinesForFile(filePath: string, coverageDir: string = 'coverage'): Promise<number[]> {
  const coverage = await findUncoveredLines(coverageDir)
  
  if (coverage.filesCoverage[filePath]) {
    return coverage.filesCoverage[filePath]?.uncoveredLines || []
  }
  
  // 尝试匹配文件路径（可能有路径差异）
  for (const [path, data] of Object.entries(coverage.filesCoverage)) {
    if (path.endsWith(filePath) || filePath.endsWith(path)) {
      return data.uncoveredLines || []
    }
  }
  
  return []
}

// ============================================================================
// Reporting Functions
// ============================================================================

/**
 * 生成覆盖率报告摘要
 * @param coverage - 覆盖率数据
 * @returns 报告文本
 */
export function generateCoverageSummary(coverage: CoverageData): string {
  if (!coverage || coverage.error) {
    return `❌ No coverage data available${coverage.error ? ': ' + coverage.error : ''}`
  }
  
  const linePercent = (coverage.lineRate * 100).toFixed(2)
  const branchPercent = coverage.branchRate 
    ? (coverage.branchRate * 100).toFixed(2) 
    : 'N/A'
  
  let summary = `📊 Coverage Summary (${coverage.format}):\n`
  summary += `  Line Coverage: ${linePercent}% (${coverage.linesCovered}/${coverage.linesValid})\n`
  
  if (coverage.branchRate !== undefined) {
    summary += `  Branch Coverage: ${branchPercent}%\n`
  }
  
  summary += `  Uncovered Lines: ${coverage.uncoveredLines.length}\n`
  
  // 按文件分组
  const fileCount = Object.keys(coverage.filesCoverage).length
  if (fileCount > 0) {
    summary += `  Files Analyzed: ${fileCount}\n`
    
    // 显示覆盖率最低的文件
    const sortedFiles = Object.entries(coverage.filesCoverage)
      .sort((a, b) => a[1].coverage - b[1].coverage)
      .slice(0, 5)
    
    if (sortedFiles.length > 0) {
      summary += `\n  Lowest Coverage Files:\n`
      for (const [file, data] of sortedFiles) {
        const fileName = file.split('/').pop() || file
        const percent = (data.coverage * 100).toFixed(1)
        const uncoveredCount = data.uncoveredLines?.length || 0
        summary += `    - ${fileName}: ${percent}% (${uncoveredCount} uncovered lines)\n`
      }
    }
  }
  
  return summary
}

/**
 * 生成未覆盖行的详细报告（用于 Prompt）
 * @param coverage - 覆盖率数据
 * @param _maxLines - 最大显示行数（保留用于未来扩展）
 * @returns 详细报告
 */
export function generateUncoveredLinesReport(coverage: CoverageData, _maxLines: number = 20): string {
  if (!coverage || coverage.uncoveredLines.length === 0) {
    return '✅ All lines are covered!'
  }
  
  let report = `## Uncovered Lines (Total: ${coverage.uncoveredLines.length})\n\n`
  report += `Focus on covering these lines to increase coverage:\n\n`
  
  // 按文件分组
  const byFile: Record<string, UncoveredLine[]> = {}
  for (const line of coverage.uncoveredLines) {
    if (!byFile[line.file]) byFile[line.file] = []
    byFile[line.file]!.push(line)
  }
  
  let count = 0
  for (const [file, lines] of Object.entries(byFile)) {
    const fileName = file.split('/').pop() || file
    report += `### ${fileName}\n`
    report += `Uncovered lines: ${lines.map(l => l.lineNumber).sort((a, b) => a - b).join(', ')}\n`
    
    // 显示前几行
    for (const line of lines.slice(0, 3)) {
      if (line.isBranch) {
        report += `  - Line ${line.lineNumber}: **Branch not covered**\n`
      } else {
        report += `  - Line ${line.lineNumber}: Not executed\n`
      }
    }
    
    if (lines.length > 3) {
      report += `  ... and ${lines.length - 3} more lines\n`
    }
    
    report += '\n'
    
    count++
    if (count >= 5) {
      const remaining = Object.keys(byFile).length - 5
      if (remaining > 0) {
        report += `... and ${remaining} more files\n`
      }
      break
    }
  }
  
  report += `\n**Priority**: Generate tests that execute these lines.\n`
  
  return report
}

/**
 * 比较两次覆盖率的变化
 * @param before - 之前的覆盖率
 * @param after - 之后的覆盖率
 * @returns 变化数据
 */
export function compareCoverage(before: CoverageData, after: CoverageData): CoverageDiff {
  const diff: CoverageDiff = {
    lineRateDiff: after.lineRate - before.lineRate,
    linesCoveredDiff: after.linesCovered - before.linesCovered,
    uncoveredLinesReduced: before.uncoveredLines.length - after.uncoveredLines.length,
    newlyCovered: [],
    stillUncovered: []
  }
  
  // 找出新覆盖的行
  const afterSet = new Set(after.uncoveredLines.map(l => `${l.file}:${l.lineNumber}`))
  
  for (const line of before.uncoveredLines) {
    const key = `${line.file}:${line.lineNumber}`
    if (!afterSet.has(key)) {
      diff.newlyCovered.push(line)
    }
  }
  
  diff.stillUncovered = after.uncoveredLines
  
  return diff
}

/**
 * 检查覆盖率是否达标
 * @param coverage - 覆盖率数据
 * @param threshold - 目标覆盖率（0-100）
 * @returns 是否达标
 */
export function isCoverageMetThreshold(coverage: CoverageData, threshold: number = 80): boolean {
  if (!coverage || coverage.error) return false
  
  const percent = coverage.lineRate * 100
  return percent >= threshold
}
