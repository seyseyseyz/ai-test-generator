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

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * 解析 Cobertura XML 覆盖率报告
 * @param {string} xmlPath - coverage.xml 文件路径
 * @returns {Promise<Object>} 覆盖率数据
 */
export async function parseCoberturaXml(xmlPath) {
  if (!existsSync(xmlPath)) {
    throw new Error(`Cobertura XML not found: ${xmlPath}`)
  }
  
  const xml = readFileSync(xmlPath, 'utf-8')
  
  // 动态导入 xml2js（避免必须依赖）
  let parseStringPromise
  try {
    const xml2js = await import('xml2js')
    parseStringPromise = xml2js.parseStringPromise
  } catch (error) {
    throw new Error('xml2js not installed. Run: npm install xml2js')
  }
  
  const result = await parseStringPromise(xml)
  
  const coverage = {
    format: 'cobertura',
    lineRate: parseFloat(result.coverage.$.['line-rate']),
    branchRate: parseFloat(result.coverage.$.['branch-rate']),
    linesCovered: parseInt(result.coverage.$.['lines-covered']),
    linesValid: parseInt(result.coverage.$.['lines-valid']),
    uncoveredLines: [],
    filesCoverage: {}
  }
  
  // 解析每个包（package）
  const packages = result.coverage.packages?.[0]?.package || []
  
  for (const pkg of packages) {
    const classes = pkg.classes?.[0]?.class || []
    
    for (const cls of classes) {
      const filename = cls.$.filename
      const lines = cls.lines?.[0]?.line || []
      
      const fileCoverage = {
        totalLines: lines.length,
        coveredLines: 0,
        uncoveredLines: [],
        branchPoints: 0,
        coveredBranches: 0
      }
      
      for (const line of lines) {
        const lineNumber = parseInt(line.$.number)
        const hits = parseInt(line.$.hits)
        const isBranch = line.$.branch === 'true'
        
        if (isBranch) {
          fileCoverage.branchPoints++
          const branchRate = line.$.['condition-coverage']
          if (branchRate && branchRate.includes('100%')) {
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
      
      fileCoverage.branchCoverage = fileCoverage.branchPoints > 0
        ? fileCoverage.coveredBranches / fileCoverage.branchPoints
        : 1
      
      coverage.filesCoverage[filename] = fileCoverage
    }
  }
  
  return coverage
}

/**
 * 解析 Jest 的 coverage-final.json（后备方案）
 * @param {string} jsonPath - coverage-final.json 文件路径
 * @returns {Object} 覆盖率数据
 */
export function parseJestCoverageJson(jsonPath) {
  if (!existsSync(jsonPath)) {
    throw new Error(`Coverage JSON not found: ${jsonPath}`)
  }
  
  const coverageData = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  
  const coverage = {
    format: 'jest-json',
    uncoveredLines: [],
    filesCoverage: {}
  }
  
  let totalLines = 0
  let coveredLines = 0
  
  for (const [filePath, fileData] of Object.entries(coverageData)) {
    const statementMap = fileData.statementMap
    const s = fileData.s  // statement execution counts
    
    const uncoveredLines = []
    let fileTotal = 0
    let fileCovered = 0
    
    for (const [stmtId, count] of Object.entries(s)) {
      fileTotal++
      
      if (count === 0) {
        const stmt = statementMap[stmtId]
        const lineNumber = stmt.start.line
        
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
    
    coverage.filesCoverage[filePath] = {
      totalLines: fileTotal,
      coveredLines: fileCovered,
      uncoveredLines: [...new Set(uncoveredLines)].sort((a, b) => a - b),
      coverage: fileTotal > 0 ? fileCovered / fileTotal : 0,
      statements: fileData.s,
      branches: fileData.b,
      functions: fileData.f,
      branchCoverage: fileData.b ? calculateBranchCoverage(fileData.b) : 0
    }
  }
  
  coverage.lineRate = totalLines > 0 ? coveredLines / totalLines : 0
  coverage.linesCovered = coveredLines
  coverage.linesValid = totalLines
  
  return coverage
}

/**
 * 计算分支覆盖率
 */
function calculateBranchCoverage(branches) {
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

/**
 * 查找未覆盖行（自动选择最佳格式）
 * @param {string} coverageDir - 覆盖率目录（默认: coverage）
 * @returns {Promise<Object>} 覆盖率数据
 */
export async function findUncoveredLines(coverageDir = 'coverage') {
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
    console.error('❌ Coverage parsing failed:', error.message)
    return {
      format: 'none',
      lineRate: 0,
      uncoveredLines: [],
      filesCoverage: {},
      error: error.message
    }
  }
}

/**
 * 获取特定文件的未覆盖行
 * @param {string} filePath - 文件路径
 * @param {string} coverageDir - 覆盖率目录
 * @returns {Promise<Array<number>>} 未覆盖行号列表
 */
export async function getUncoveredLinesForFile(filePath, coverageDir = 'coverage') {
  const coverage = await findUncoveredLines(coverageDir)
  
  if (coverage.filesCoverage[filePath]) {
    return coverage.filesCoverage[filePath].uncoveredLines
  }
  
  // 尝试匹配文件路径（可能有路径差异）
  for (const [path, data] of Object.entries(coverage.filesCoverage)) {
    if (path.endsWith(filePath) || filePath.endsWith(path)) {
      return data.uncoveredLines
    }
  }
  
  return []
}

/**
 * 生成覆盖率报告摘要
 * @param {Object} coverage - 覆盖率数据
 * @returns {string} 报告文本
 */
export function generateCoverageSummary(coverage) {
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
        const fileName = file.split('/').pop()
        const percent = (data.coverage * 100).toFixed(1)
        summary += `    - ${fileName}: ${percent}% (${data.uncoveredLines.length} uncovered lines)\n`
      }
    }
  }
  
  return summary
}

/**
 * 生成未覆盖行的详细报告（用于 Prompt）
 * @param {Object} coverage - 覆盖率数据
 * @param {number} maxLines - 最大显示行数
 * @returns {string} 详细报告
 */
export function generateUncoveredLinesReport(coverage, maxLines = 20) {
  if (!coverage || coverage.uncoveredLines.length === 0) {
    return '✅ All lines are covered!'
  }
  
  let report = `## Uncovered Lines (Total: ${coverage.uncoveredLines.length})\n\n`
  report += `Focus on covering these lines to increase coverage:\n\n`
  
  // 按文件分组
  const byFile = {}
  for (const line of coverage.uncoveredLines) {
    if (!byFile[line.file]) byFile[line.file] = []
    byFile[line.file].push(line)
  }
  
  let count = 0
  for (const [file, lines] of Object.entries(byFile)) {
    const fileName = file.split('/').pop()
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
 * @param {Object} before - 之前的覆盖率
 * @param {Object} after - 之后的覆盖率
 * @returns {Object} 变化数据
 */
export function compareCoverage(before, after) {
  const diff = {
    lineRateDiff: after.lineRate - before.lineRate,
    linesCoveredDiff: after.linesCovered - before.linesCovered,
    uncoveredLinesReduced: before.uncoveredLines.length - after.uncoveredLines.length,
    newlyCovered: [],
    stillUncovered: []
  }
  
  // 找出新覆盖的行
  const beforeSet = new Set(before.uncoveredLines.map(l => `${l.file}:${l.lineNumber}`))
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
 * @param {Object} coverage - 覆盖率数据
 * @param {number} threshold - 目标覆盖率（0-100）
 * @returns {boolean} 是否达标
 */
export function isCoverageMetThreshold(coverage, threshold = 80) {
  if (!coverage || coverage.error) return false
  
  const percent = coverage.lineRate * 100
  return percent >= threshold
}

