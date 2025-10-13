#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import { parseArgs } from '../shared/cli-utils.js'
import { loadJson } from '../shared/file-utils.js'
import { requirePackage } from '../shared/process-utils.js'
import { normalizePath, relativizePath } from '../shared/path-utils.js'
import type { AITestConfig, FunctionTarget, FunctionType, Layer } from '../types/index.js'
import type { VariableDeclaration } from 'ts-morph'

/**
 * List TypeScript source files with exclusions
 */
async function listFiles(excludeDirs: string[] = []): Promise<string[]> {
  const fg = (await requirePackage<{ default: (patterns: string | string[], options?: { dot?: boolean }) => Promise<string[]> }>('fast-glob', 'fast-glob')).default
  
  // 基础排除规则
  const baseExcludes = ['!**/*.d.ts', '!**/node_modules/**']
  
  // 添加用户指定的排除目录
  const userExcludes = excludeDirs.map(dir => {
    // 标准化路径：移除前后斜杠，确保以 src/ 开头
    const normalized = dir.replace(/^\/+|\/+$/g, '')
    const prefixed = normalized.startsWith('src/') ? normalized : `src/${normalized}`
    return `!${prefixed}/**`
  })
  
  const patterns = ['src/**/*.{ts,tsx}', ...baseExcludes, ...userExcludes]
  const files = await fg(patterns, { dot: false })
  
  if (!files?.length) throw new Error('No source files found under src (check exclude patterns)')
  return files
}

/**
 * Determine function type by path and name
 */
function decideTypeByPathAndName(filePath: string, exportName: string): FunctionType {
  const p = filePath.toLowerCase()
  if (p.includes('/hooks/') || /^use[A-Z]/.test(exportName)) return 'hook'
  if (p.includes('/components/') || /^[A-Z]/.test(exportName)) return 'component'
  return 'function'
}

/**
 * Determine layer by file path and config
 */
function decideLayer(filePath: string, cfg: AITestConfig | null): Layer | 'unknown' {
  const layers = cfg?.layers as Record<string, { patterns: string[] }> | undefined
  if (!layers) return 'unknown'
  
  // 标准化路径：移除反斜杠，去掉 src/ 前缀
  let normalizedPath = normalizePath(filePath)
  if (normalizedPath.startsWith('src/')) {
    normalizedPath = normalizedPath.substring(4)
  }
  
  // 按优先级匹配层级（从最具体到最通用）
  for (const [layerKey, layerDef] of Object.entries(layers)) {
    const patterns = layerDef.patterns || []
    for (const pattern of patterns) {
      // 简单的 glob 匹配：支持 ** 和 *
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
      const regex = new RegExp(regexPattern)
      if (regex.test(normalizedPath)) {
        return layerKey as Layer
      }
    }
  }
  
  return 'unknown'
}

// Removed buildImpactHint and buildRoiHint - legacy functions

/**
 * Get lines of code between positions
 */
function getLoc(text: string, start: number, end: number): number {
  const slice = text.slice(start, end)
  return slice.split(/\r?\n/).length
}

/**
 * Extract testable targets from source files
 */
async function extractTargets(files: string[]): Promise<FunctionTarget[]> {
  const { Project: TsMorphProject, SyntaxKind: TsSyntaxKind, SourceFile: TsSourceFile, FunctionDeclaration: TsFunctionDeclaration, VariableDeclaration: TsVariableDeclaration } = await requirePackage<typeof import('ts-morph')>('ts-morph', 'ts-morph')
  const cfg = loadJson<AITestConfig>('ut_scoring_config.json') || {} as AITestConfig
  const internalInclude = cfg.internalInclude === true
  const minLoc = cfg?.internalThresholds?.minLoc ?? 15

  const project = new TsMorphProject({ skipAddingFilesFromTsConfig: true })
  files.forEach(f => project.addSourceFileAtPathIfExists(f))

  const targets: FunctionTarget[] = []
  
  // 辅助函数：判断变量是否为可测试的函数/组件
  function isTestableVariable(v: typeof TsVariableDeclaration.prototype): boolean {
    const init = v.getInitializer()
    if (!init) return false
    const kind = init.getKind()
    // 箭头函数、函数表达式、React组件（JSX）、HOC包装
    if (kind === TsSyntaxKind.ArrowFunction || kind === TsSyntaxKind.FunctionExpression) return true
    if (kind === TsSyntaxKind.CallExpression) {
      const text = init.getText()
      return /(React\.memo|forwardRef|memo|observer)\(/.test(text)
    }
    return false
  }
  
  // ✅ 文件级缓存：避免重复扫描每个文件的导入
  const fileImportsCache = new Map<string, string[]>()
  
  function getCachedFileImports(sf: typeof TsSourceFile.prototype): string[] {
    const filePath = sf.getFilePath()
    if (fileImportsCache.has(filePath)) {
      return fileImportsCache.get(filePath) || []
    }
    
    const imports = sf.getImportDeclarations()
    const criticalKeywords = ['stripe', 'payment', 'auth', 'axios', 'fetch', 'prisma', 'db', 'api', 'jotai', 'zustand']
    const criticalImports = imports
      .map((imp: ReturnType<typeof sf.getImportDeclarations>[number]) => imp.getModuleSpecifierValue())
      .filter((mod: string) => criticalKeywords.some((kw: string) => mod.toLowerCase().includes(kw)))
      .slice(0, 5) // 限制数量
    
    fileImportsCache.set(filePath, criticalImports)
    return criticalImports
  }
  
  /**
   * 函数元数据接口
   */
  interface FunctionMetadata {
    criticalImports: string[]
    businessEntities: string[]
    hasDocumentation: boolean
    documentation: string
    errorHandling: number
    externalCalls: number
    paramCount: number
    returnType: string
  }

  // ✅ 新增：提取函数的 AI 分析元数据
  function extractMetadata(node: typeof TsFunctionDeclaration.prototype | typeof TsVariableDeclaration.prototype | undefined, sf: typeof TsSourceFile.prototype): FunctionMetadata {
    const metadata: FunctionMetadata = {
      criticalImports: [],
      businessEntities: [],
      hasDocumentation: false,
      documentation: '',
      errorHandling: 0,
      externalCalls: 0,
      paramCount: 0,
      returnType: ''
    }
    
    if (!node) return metadata
    
    try {
      // 1. 提取关键导入（使用缓存）
      metadata.criticalImports = getCachedFileImports(sf)
      
      // 2. 提取参数类型（识别业务实体）
      if ('getParameters' in node && typeof node.getParameters === 'function') {
        const params = node.getParameters()
        metadata.paramCount = params.length
        
        // ✅ 从配置读取业务实体关键词（支持项目定制）
        const entityKeywords = (cfg?.aiEnhancement as { entityKeywords?: string[] })?.entityKeywords || 
          ['Payment', 'Order', 'Booking', 'User', 'Hotel', 'Room', 'Cart', 'Price', 'Guest', 'Request', 'Response']
        
        metadata.businessEntities = params
          .map((p: ReturnType<typeof node.getParameters>[number]) => {
            try {
              return p.getType().getText()
            } catch {
              return ''
            }
          })
          .filter((type: string) => entityKeywords.some((kw: string) => type.includes(kw)))
          .slice(0, 3) // 限制数量
      }
      
      // 3. 提取返回类型
      if ('getReturnType' in node && typeof node.getReturnType === 'function') {
        try {
          const returnType = node.getReturnType().getText()
          // 简化类型（避免过长）
          metadata.returnType = returnType.length > 100 ? returnType.slice(0, 100) + '...' : returnType
        } catch {
          // Ignore type extraction errors
        }
      }
      
      // 4. 提取 JSDoc 注释
      if ('getJsDocs' in node && typeof node.getJsDocs === 'function') {
        const jsDocs = node.getJsDocs()
        if (jsDocs.length > 0) {
          metadata.hasDocumentation = true
          metadata.documentation = jsDocs
            .map((doc: ReturnType<typeof node.getJsDocs>[number]) => {
              const comment = doc.getComment()
              return typeof comment === 'string' ? comment : ''
            })
            .filter(Boolean)
            .join(' ')
            .slice(0, 200) // 限制长度
        }
      }
      
      // 5. 统计异常处理（try-catch）
      if ('getDescendantsOfKind' in node && typeof node.getDescendantsOfKind === 'function') {
        metadata.errorHandling = node.getDescendantsOfKind(TsSyntaxKind.TryStatement).length
      }
      
      // 6. 统计外部 API 调用
      if ('getDescendantsOfKind' in node && typeof node.getDescendantsOfKind === 'function') {
        const callExpressions = node.getDescendantsOfKind(TsSyntaxKind.CallExpression)
        metadata.externalCalls = callExpressions.filter((call: ReturnType<typeof node.getDescendantsOfKind>[number]) => {
          try {
            const expr = 'getExpression' in call && typeof call.getExpression === 'function' ? call.getExpression()?.getText() || '' : ''
            return /fetch|axios|\.get\(|\.post\(|\.put\(|\.delete\(/.test(expr)
          } catch {
            return false
          }
        }).length
      }
    } catch (err) {
      // 提取失败不影响主流程
    }
    
    return metadata
  }
  
  for (const sf of project.getSourceFiles()) {
    const absPath = sf.getFilePath()
    const relPath = relativizePath(absPath)
    const content = sf.getFullText()

    // 导出符号 - 仅包含函数和组件
    const exported = Array.from(new Set(sf.getExportSymbols().map((s: ReturnType<typeof sf.getExportSymbols>[number]) => s.getName()).filter(Boolean)))
    const fileLoc = content.split('\n').length
    for (const name of exported) {
      // 检查是否为函数声明
      const fn = sf.getFunction(name as string)
      if (fn) {
        const type = decideTypeByPathAndName(relPath, name as string)
        const layer = decideLayer(relPath, cfg) as Layer
        const metadata = extractMetadata(fn, sf) // ✅ 提取元数据
        targets.push({
          name: name as string,
          path: relPath,
          type,
          layer,
          internal: false,
          loc: fileLoc,
          exported: true,
          metadata // ✅ 添加元数据
        })
        continue
      }
      
      // 检查是否为变量（可能是箭头函数或组件）
          const v = sf.getVariableDeclaration(name as string)
          if (v && isTestableVariable(v)) {
            const type = decideTypeByPathAndName(relPath, name as string)
            const layer = decideLayer(relPath, cfg) as Layer
            const metadata = extractMetadata(v as VariableDeclaration, sf) // ✅ 提取元数据
            targets.push({
              name: name as string,
              path: relPath,
              type,
              layer,
              internal: false,
              loc: fileLoc,
              exported: true,
              metadata // ✅ 添加元数据
            })
          }
      // 其他（interface/type/const/enum）直接跳过
    }

    // 内部顶层命名函数（非导出）
    if (internalInclude) {
      const fnDecls = sf.getFunctions().filter((fn: ReturnType<typeof sf.getFunctions>[number]) => !fn.isExported() && !!fn.getName())
      for (const fn of fnDecls) {
        const name = fn.getName() as string
        const start = fn.getStart()
        const end = fn.getEnd()
        const loc = getLoc(content, start, end)
        if (loc < minLoc) continue
            const type = decideTypeByPathAndName(relPath, name)
            const layer = decideLayer(relPath, cfg) as Layer
            targets.push({
              name,
              path: relPath,
              type,
              layer,
              internal: true,
              loc,
              exported: false
            })
      }
    }
  }
  if (!targets.length) throw new Error('No targets (exported or internal) found. Check config thresholds and sources.')
  return targets
}

async function main(): Promise<void> {
  const args = parseArgs()
  const cfg = loadJson<AITestConfig>('ut_scoring_config.json') || {} as AITestConfig
  
  // 从配置文件和命令行参数获取排除目录
  const configExcludes = cfg?.targetGeneration?.excludeDirs || []
  const excludeArg = args.exclude
  const cliExcludes = (typeof excludeArg === 'string') 
    ? excludeArg.split(',').map((s: string) => s.trim()) 
    : []
  const allExcludes = [...configExcludes, ...cliExcludes]
  
  if (allExcludes.length > 0) {
    process.stdout.write(`Excluding directories: ${allExcludes.join(', ')}\n`)
  }
  
  const files = await listFiles(allExcludes)
  const targets = await extractTargets(files)
  
  const outPath = (typeof args.out === 'string' ? args.out : null) || 'reports/targets.json'
  writeFileSync(outPath, JSON.stringify(targets, null, 2))
  process.stdout.write(`Generated ${targets.length} targets -> ${outPath}\n`)
}

main()
