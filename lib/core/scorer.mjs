#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

async function req(mod, hint) { try { return await import(mod) } catch { throw new Error(`${mod} not installed. Run: npm i -D ${hint || mod}`) } }

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split('=') : [a, argv[i + 1]]
      args[k.replace(/^--/, '')] = v === undefined || v.startsWith('--') ? true : v
      if (v !== undefined && !v.startsWith('--') && !a.includes('=')) i++
    }
  }
  return args
}

function loadJson(p) {
  if (!p || !existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

function toFixedDown(num, digits = 2) { const m = Math.pow(10, digits); return Math.floor(num * m) / m }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }

// 匹配 AI 建议的模式（支持 glob 语法）
function matchPattern(filePath, pattern) {
  if (!pattern || !filePath) return false
  
  // 移除开头的 src/ 如果存在（标准化路径）
  const normalizedPath = filePath.replace(/^src\//, '')
  
  // 简单 glob 匹配：支持 ** 和 *
  const regexPattern = pattern
    .replace(/\./g, '\\.')         // . 转义
    .replace(/\*\*/g, '__DSTAR__') // ** 临时占位
    .replace(/\*/g, '[^/]*')       // * 匹配非斜杠字符
    .replace(/__DSTAR__/g, '.*')   // ** 匹配任意字符
  
  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(normalizedPath) || regex.test(filePath)
}

function stripJsonComments(s) {
  return String(s)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
}

// 根据路径匹配层级（作为 fallback）
function matchLayerByPath(filePath, cfg) {
  const layers = cfg?.layers || {}
  
  // 按配置文件中定义的顺序遍历层级（foundation → business → state → ui）
  const layerOrder = ['foundation', 'business', 'state', 'ui']
  
  for (const layerKey of layerOrder) {
    const layerDef = layers[layerKey]
    if (!layerDef) continue
    
    const patterns = layerDef.patterns || []
    for (const pattern of patterns) {
      // 简单的 glob 匹配：支持 ** 和 *
      const regexPattern = pattern
        .replace(/\./g, '\\.')         // . 转义
        .replace(/\*\*/g, '__DSTAR__') // ** 临时占位
        .replace(/\*/g, '[^/]*')       // * 匹配单层目录
        .replace(/__DSTAR__/g, '.*')   // ** 匹配任意层级目录
      const regex = new RegExp(`^${regexPattern}$`)
      if (regex.test(filePath)) {
        return layerKey
      }
    }
  }
  
  // 如果都不匹配，尝试配置中的其他层级
  for (const [layerKey, layerDef] of Object.entries(layers)) {
    if (layerOrder.includes(layerKey)) continue // 已经检查过了
    const patterns = layerDef.patterns || []
    for (const pattern of patterns) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '__DSTAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DSTAR__/g, '.*')
      const regex = new RegExp(`^${regexPattern}$`)
      if (regex.test(filePath)) {
        return layerKey
      }
    }
  }
  
  return 'unknown'
}

// 综合判断层级：基于代码特征（roiHint）+ 路径约定
function matchLayer(target, cfg) {
  const { path, type, roiHint = {} } = target
  
  // ===== 第一优先级：明确的状态管理路径约定 =====
  // atoms/stores 是明确的架构约定，优先识别
  if (path.match(/\/(atoms|stores)\//)) {
    return 'state'
  }
  
  // ===== 第二优先级：基于代码特征（roiHint）=====
  
  // UI 层：needsUI = true（代码中包含 JSX 或 React Hooks）
  if (roiHint.needsUI === true) {
    // 排除 context（虽然有 JSX 但本质是状态管理）
    if (path.match(/\/context\//)) {
      return 'state'
    }
    return 'ui'
  }
  
  // Foundation 层：纯函数 + 依赖可注入（真正的工具函数）
  if (roiHint.isPure === true && roiHint.dependenciesInjectable === true) {
    return 'foundation'
  }
  
  // Foundation 层：纯函数（即使依赖不可注入，如某些 utils）
  // 但排除状态管理相关的纯函数（如 createStore）
  if (roiHint.isPure === true && !path.match(/\/(atoms|stores|context)\//)) {
    return 'foundation'
  }
  
  // Business 层：非纯函数 + 不需要 UI（业务逻辑、API 调用）
  if (roiHint.isPure === false && roiHint.needsUI === false) {
    // 排除状态管理
    if (!path.match(/\/(atoms|stores|context)\//)) {
      return 'business'
    }
  }
  
  // ===== 第三优先级：基于类型 =====
  
  // component 类型一定是 UI 层
  if (type === 'component') {
    return 'ui'
  }
  
  // hook 类型：根据位置判断
  if (type === 'hook') {
    // 在 components/pages 下的 hook 是 UI 层
    if (path.match(/\/(components|pages)\//)) {
      return 'ui'
    }
    // 独立的 hook 更可能是业务逻辑
    return 'business'
  }
  
  // ===== 第四优先级：路径 fallback =====
  return matchLayerByPath(path, cfg)
}
function loadConfig(pathFromArg) {
  const paths = [pathFromArg, 'ai-test.config.jsonc', 'ai-test.config.json']
  for (const p of paths) {
    if (!p) continue
    try {
      if (existsSync(p)) {
        const raw = readFileSync(p, 'utf8')
        return JSON.parse(stripJsonComments(raw))
      }
    } catch {}
  }
  return {}
}
function pickWeight(cfg, key, def) { return cfg?.weights?.[key] ?? def }
function pickThreshold(cfg, key, def) { return cfg?.thresholds?.[key] ?? def }

function isMainChain(path, cfg) { const arr = (cfg?.mainChainPaths || []).map(s => String(s).toLowerCase()); const lower = (path || '').toLowerCase(); return arr.some(s => lower.includes(s)) }

function mapBCByConfig({ name, path, impactHint }, cfg, overrides) {
  const key = `${path}#${name}`
  if (overrides?.BC?.[key] !== undefined) return overrides.BC[key]
  const lower = `${name} ${path} ${impactHint || ''}`.toLowerCase()
  let bc = 3
  const kw = cfg?.bcKeywords || {}
  const ordered = Object.keys(kw).map(Number).sort((a,b)=>b-a)
  for (const score of ordered) { const list = kw[String(score)] || []; if (list.some(token => lower.includes(String(token).toLowerCase()))) { bc = score; break } }
  if (!isMainChain(path, cfg)) { const cap = cfg?.bcCapForNonMainChain ?? 8; if (bc > cap) bc = cap }
  return bc
}

function mapCCFromMetrics(metrics, cfg, eslintCognitive, target, overrides) {
  const key = `${target.path}#${target.name}`
  if (overrides?.CC?.[key] !== undefined) return overrides.CC[key]
  if (!metrics) throw new Error('Function-level metrics missing')
  
  const cyclo = metrics?.cyclomatic ?? 0
  const fusion = cfg?.ccFusion || {}
  let cc = 3
  
  // P0-1: CC融合认知复杂度（默认策略）
  const cognitive = eslintCognitive?.[key]
  if (cognitive !== undefined) {
    // 融合 cyclomatic + cognitive
    const wC = fusion.wC ?? 0.7
    const wK = fusion.wK ?? 0.3
    const fused = wC * cyclo + wK * cognitive
    cc = clamp(Math.floor(fused / 5) + 3, 2, fusion.cap ?? 10)
  } else {
    // 该函数未被 ESLint 分析（可能太简单），仅用 cyclomatic
    let base = 3
    const ranges = cfg?.ccMapping?.cyclomatic || []
    for (const r of ranges) {
      const gte = r.gte ?? -Infinity, lte = r.lte ?? Infinity, gt = r.gt, eq = r.eq
      let hit = false
      if (typeof eq === 'number') hit = cyclo === eq
      else if (typeof gt === 'number') hit = cyclo > gt
      else hit = cyclo >= gte && cyclo <= lte
      if (hit) { base = r.score; break }
    }
    let adj = 0
    for (const r of (cfg?.ccMapping?.adjustments || [])) { 
      const val = metrics?.[r.field]
      if (val === undefined || val === null) continue
      const op = r.op || '>='
      if ((op === '>=') && val >= r.value) adj += r.delta || 1
      else if ((op === '>') && val > r.value) adj += r.delta || 1
      else if ((op === '==') && val === r.value) adj += r.delta || 1
    }
    cc = clamp(base + Math.min(adj, 3), 2, cfg?.ccMapping?.cap ?? 10)
  }
  
  // P1-2: 修复内部函数 LOC 加成读取配置路径
  const internal = target.internal === true
  const loc = target.loc || 0
  const ccAdjust = cfg?.ccAdjust || {}
  const locBonusThreshold = ccAdjust.locBonusThreshold ?? 50
  const locBonus = ccAdjust.locBonus ?? 1
  if (internal && loc >= locBonusThreshold) {
    cc = clamp(cc + locBonus, 2, cfg?.ccMapping?.cap ?? 10)
  }
  
  return cc
}

function mapLikelihoodFromGitByConfig(git, depGraphData, cfg) {
  const rules = cfg?.likelihoodRules || []
  const c30 = git?.commits30d ?? 0, c90 = git?.commits90d ?? 0, c180 = git?.commits180d ?? 0
  let score = cfg?.fallbacks?.ERLikelihood ?? 3
  for (const r of rules) {
    if (r.field === 'commits30d') { if (r.op === '>=') { if (c30 >= r.value) { score = r.score; break } } if (r.op === 'between') { if (c30 >= r.min && c30 <= r.max) { score = r.score; break } } }
    if (r.field === 'fallback90d' && r.op === 'gt') { if (c30 === 0 && c90 > r.value) { score = r.score; break } }
    if (r.field === 'fallback180dZero' && r.op === 'eq') { if (c90 === 0 && c180 === 0 && r.value === true) { score = r.score; break } }
  }
  
  // P0-2: depGraph 提升（基于真实依赖图）
  const depCfg = cfg?.depGraph || {}
  if (depCfg.enable && depGraphData) {
    const { crossModuleScore, fanOut, fanIn } = depGraphData
    if (crossModuleScore >= (depCfg.neighborCategoryBoost ?? 2)) score = clamp(score + 1, 1, cfg?.boostRules?.cap ?? 5)
    if ((fanOut + fanIn) >= (depCfg.degreeBoost ?? 8)) score = clamp(score + 1, 1, cfg?.boostRules?.cap ?? 5)
  }
  
  // Git 辅助信号提升
  const boostCfg = cfg?.boostRules || {}
  const boosted = ((git?.authors30d ?? 0) >= (boostCfg.authors30dGte ?? 999)) || git?.inCategory || git?.multiPlatform
  if (boosted) score = clamp(score + 1, 1, boostCfg.cap ?? 5)
  return score
}

function mapImpactFromHintByConfig(hint, cfg, localMap) {
  if (localMap?.[hint] !== undefined) return localMap[hint]
  const lower = (hint || '').toLowerCase()
  const impactKw = cfg?.impactKeywords || {}
  const ordered = Object.keys(impactKw).map(Number).sort((a,b)=>b-a)
  for (const score of ordered) { const list = impactKw[String(score)] || []; if (list.some(token => lower.includes(String(token).toLowerCase()))) return score }
  return 3
}

function mapERFromGitAndImpactConfig(git, impactHint, depGraphData, cfg, overrides, localImpact, target) {
  const key = `${target.path}#${target.name}`
  if (overrides?.ER?.[key] !== undefined) return overrides.ER[key]
  const likelihood = mapLikelihoodFromGitByConfig(git, depGraphData, cfg)
  const impact = mapImpactFromHintByConfig(impactHint, cfg, localImpact)
  const matrix = cfg?.erMatrix || {}
  return matrix?.[likelihood]?.[impact] ?? 6
}

function mapROIByConfig(hint, cfg, localMap, overrides, target) {
  const key = `${target.path}#${target.name}`
  if (overrides?.ROI?.[key] !== undefined) return overrides.ROI[key]
  if (localMap?.[hint] !== undefined) return localMap[hint]
  const r = cfg?.roiRules || {}
  if (hint?.isPure) return r.pure ?? 10
  if (hint?.dependenciesInjectable) return r.injectable ?? 9
  if (hint?.multiPlatformStrong) return r.nativeOrNetwork ?? 5
  if (hint?.needsUI) return r.needsUI ?? 3
  return r.multiContext ?? 7
}

// 映射 testability（本质上就是 ROI 的重命名）
function mapTestabilityByConfig(hint, cfg, localMap, overrides, target) {
  const key = `${target.path}#${target.name}`
  if (overrides?.Testability?.[key] !== undefined) return overrides.Testability[key]
  if (localMap?.[hint] !== undefined) return localMap[hint]
  const r = cfg?.testabilityRules || cfg?.roiRules || {}
  if (hint?.isPure) return r.pure ?? 10
  if (hint?.dependenciesInjectable) return r.injectable ?? 9
  if (hint?.multiPlatformStrong) return r.nativeOrNetwork ?? 5
  if (hint?.needsUI) return r.needsUI ?? 3
  return r.multiContext ?? 7
}

// 计算依赖计数分数（被多少个模块引用）
function mapDependencyCount(depGraphData, cfg) {
  if (!depGraphData) return 2 // 默认分数
  
  const fanIn = depGraphData.fanIn || 0
  const mapping = cfg?.dependencyCountMapping || [
    { "gte": 10, "score": 10 },
    { "gte": 5, "lt": 10, "score": 8 },
    { "gte": 3, "lt": 5, "score": 6 },
    { "gte": 1, "lt": 3, "score": 4 },
    { "eq": 0, "score": 2 }
  ]
  
  for (const rule of mapping) {
    if (rule.eq !== undefined && fanIn === rule.eq) return rule.score
    if (rule.gte !== undefined && rule.lt !== undefined) {
      if (fanIn >= rule.gte && fanIn < rule.lt) return rule.score
    }
    if (rule.gte !== undefined && rule.lt === undefined) {
      if (fanIn >= rule.gte) return rule.score
    }
  }
  
  return 2
}
// 传统评分（兼容旧配置）
function computeScoreLegacy({ BC, CC, ER, ROI, coverageScore }, cfg) { 
  const s = BC * pickWeight(cfg,'BC',0.4)
    + CC * pickWeight(cfg,'CC',0.3)
    + ER * pickWeight(cfg,'ER',0.2)
    + ROI * pickWeight(cfg,'ROI',0.1)
    + (typeof coverageScore === 'number' ? coverageScore * pickWeight(cfg,'coverage',0) : 0)
  const score = toFixedDown(s, (cfg?.round?.digits ?? 2))
  const P0 = pickThreshold(cfg,'P0',8.5), P1 = pickThreshold(cfg,'P1',6.5), P2 = pickThreshold(cfg,'P2',4.5)
  let priority = 'P3'
  if (score >= P0) priority = 'P0'
  else if (score >= P1) priority = 'P1'
  else if (score >= P2) priority = 'P2'
  return { score, priority, layer: 'N/A' }
}

// 分层评分（新方法）
function computeScoreLayered({ BC, CC, ER, testability, dependencyCount, coverageScore }, target, cfg) {
  const layer = target.layer || 'unknown'
  const layerDef = cfg?.layers?.[layer]
  
  if (!layerDef) {
    // 如果没有层级定义，回退到传统评分
    return computeScoreLegacy({ BC, CC, ER, ROI: testability }, cfg)
  }
  
  const weights = layerDef.weights || {}
  let score = 0
  
  // 根据层级定义的权重计算分数
  if (weights.businessCriticality !== undefined) score += BC * weights.businessCriticality
  if (weights.complexity !== undefined) score += CC * weights.complexity
  if (weights.errorRisk !== undefined) score += ER * weights.errorRisk
  if (weights.testability !== undefined) score += testability * weights.testability
  if (weights.dependencyCount !== undefined) score += dependencyCount * weights.dependencyCount
  if (weights.coverage !== undefined && typeof coverageScore === 'number') score += coverageScore * weights.coverage
  
  score = toFixedDown(score, cfg?.round?.digits ?? 2)
  
  // 使用层级特定的阈值
  const thresholds = layerDef.thresholds || { P0: 8.0, P1: 6.5, P2: 4.5 }
  let priority = 'P3'
  if (score >= thresholds.P0) priority = 'P0'
  else if (score >= thresholds.P1) priority = 'P1'
  else if (score >= thresholds.P2) priority = 'P2'
  
  return { score, priority, layer, layerName: layerDef.name }
}

// 统一评分入口
function computeScore(metrics, target, cfg) {
  const mode = cfg?.scoringMode || 'legacy'
  
  if (mode === 'layered') {
    return computeScoreLayered(metrics, target, cfg)
  } else {
    return computeScoreLegacy(metrics, cfg)
  }
}

// 覆盖率百分比到覆盖率分数（Coverage Score）映射
function mapCoverageScore(pct, cfg) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return cfg?.coverageScoring?.naScore ?? 5
  }
  const mapping = cfg?.coverageScoring?.mapping
  if (Array.isArray(mapping) && mapping.length) {
    const ordered = mapping.slice().sort((a,b)=> (a.lte ?? 1e9) - (b.lte ?? 1e9))
    for (const rule of ordered) {
      if (typeof rule.lte === 'number' && pct <= rule.lte) return rule.score
    }
  }
  if (pct <= 0) return 10
  if (pct <= 40) return 8
  if (pct <= 70) return 6
  if (pct <= 90) return 3
  return 1
}

function defaultMd(rows, statusMap = new Map()) {
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
    md += `| ${status} | ${r.score} | ${r.priority} | ${r.name} | ${r.type} | ${r.layerName || r.layer} | ${r.path} | ${typeof r.coveragePct === 'number' ? r.coveragePct.toFixed(1) + '%':'N/A'} | ${r.coverageScore ?? 'N/A'} | ${r.BC} | ${r.CC} | ${r.ER} | ${r.testability || r.ROI} | ${r.dependencyCount || 'N/A'} |\n` 
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

function defaultCsv(rows) {
  // 按总分降序排序（高分在前）
  const sorted = [...rows].sort((a, b) => b.score - a.score)
  
  const head = ['status','score','priority','name','path','type','layer','layerName','coveragePct','coverageScore','BC','CC','ER','testability','dependencyCount'].join(',')
  const body = sorted.map(r => [
    'TODO',
    r.score,
    r.priority,
    r.name,
    r.path,
    r.type,
    r.layer || 'N/A',
    r.layerName || 'N/A',
    (typeof r.coveragePct === 'number' ? r.coveragePct.toFixed(1) + '%' : 'N/A'),
    (r.coverageScore ?? 'N/A'),
    r.BC,
    r.CC,
    r.ER,
    r.testability || r.ROI,
    r.dependencyCount || 'N/A'
  ].join(',')).join('\n')
  return head + '\n' + body + '\n'
}

async function buildFuncMetricsProvider(targets) {
  const tsMorph = await req('ts-morph','ts-morph')
  const escomplex = await req('escomplex','escomplex')
  const { Project, SyntaxKind } = tsMorph
  const project = new Project({ skipAddingFilesFromTsConfig: true })
  const byPath = new Map(); targets.forEach(t => { if (!byPath.has(t.path)) byPath.set(t.path, true) }); Array.from(byPath.keys()).forEach(p => project.addSourceFileAtPathIfExists(p))
  const byFunc = {}
  const skipped = []
  for (const t of targets) {
    const sf = project.getSourceFile(t.path); if (!sf) { process.stderr.write(`⚠️  Source not found: ${t.path}\n`); continue }
    let node = sf.getFunction(t.name)
    if (!node) { const v = sf.getVariableDeclaration(t.name); const init = v?.getInitializer(); if (init && (init.getKind() === SyntaxKind.FunctionExpression || init.getKind() === SyntaxKind.ArrowFunction)) node = init }
    if (!node) { skipped.push(`${t.name} in ${t.path}`); continue }
    const text = node.getText(); let cyclomatic = 0
    try { const res = escomplex.analyzeModule ? escomplex.analyzeModule(text) : null; cyclomatic = res?.aggregate?.cyclomatic ?? 0 } catch { skipped.push(`${t.name} (escomplex failed)`); continue }
    byFunc[`${t.path}#${t.name}`] = { cyclomatic }
  }
  if (skipped.length > 0) process.stdout.write(`⚠️  Skipped ${skipped.length} targets (not functions or parse failed)\n`)
  return { project, byFunc }
}

function pickMetricsForTarget(provider, target) { const key = `${target.path}#${target.name}`; const func = provider?.byFunc?.[key]; if (!func) return { cyclomatic: 1 }; return func }

// P0-2: 构建文件依赖图
function buildDepGraph(project, cfg) {
  const categories = cfg?.crossModuleCategories || []
  const graph = new Map()
  
  function topCategory(path) {
    const parts = path.replace(/\\/g, '/').split('/')
    const idx = parts.indexOf('src')
    return idx >= 0 && idx + 1 < parts.length ? parts[idx + 1] : parts[0]
  }
  
  for (const sf of project.getSourceFiles()) {
    const path = sf.getFilePath().replace(process.cwd() + '/', '')
    const deps = new Set()
    const cat = topCategory(path)
    
    for (const imp of sf.getImportDeclarations()) {
      const modSpec = imp.getModuleSpecifierValue()
      if (!modSpec.startsWith('.')) continue
      const impSf = imp.getModuleSpecifierSourceFile()
      if (!impSf) continue
      const resolved = sf.getDirectory().getRelativePathTo(impSf)
      if (resolved) deps.add(resolved)
    }
    
    const depCats = new Set()
    deps.forEach(d => {
      const dCat = topCategory(d)
      if (dCat !== cat && categories.includes(dCat)) depCats.add(dCat)
    })
    
    graph.set(path, {
      category: cat,
      deps: Array.from(deps),
      crossModuleScore: depCats.size,
      fanOut: deps.size,
      fanIn: 0
    })
  }
  
  // 计算 fanIn
  for (const [path, data] of graph.entries()) {
    data.deps.forEach(dep => {
      if (graph.has(dep)) graph.get(dep).fanIn++
    })
  }
  
  return graph
}

// P0-1: 加载 ESLint cognitive complexity
function loadESLintCognitive(eslintJsonPath) {
  const eslint = loadJson(eslintJsonPath)
  if (!eslint || !Array.isArray(eslint)) return null
  const cognitive = {}
  
  for (const file of eslint) {
    const filePath = file.filePath?.replace(process.cwd() + '/', '')
    if (!file.messages || !filePath) continue
    
    // 读取源文件以匹配函数名
    let sourceLines = null
    try {
      sourceLines = readFileSync(file.filePath, 'utf8').split('\n')
    } catch {
      continue
    }
    
    for (const msg of file.messages) {
      if (msg.ruleId === 'sonarjs/cognitive-complexity' && msg.message) {
        const complexityMatch = msg.message.match(/from\s+(\d+)\s+to/)
        if (!complexityMatch) continue
        const complexity = Number(complexityMatch[1])
        
        // 从消息行号附近查找函数名
        const line = msg.line - 1 // 0-based
        const contextLines = sourceLines.slice(Math.max(0, line - 2), line + 3).join('\n')
        
        // 匹配各种函数定义
        const patterns = [
          /export\s+(?:const|function)\s+(\w+)/,  // export const/function name
          /const\s+(\w+)\s*=\s*\(/,               // const name = (
          /function\s+(\w+)\s*\(/,                // function name(
          /(\w+)\s*:\s*\([^)]*\)\s*=>/,          // name: () =>
          /export\s+default\s+function\s+(\w+)/  // export default function name
        ]
        
        let fnName = null
        for (const pattern of patterns) {
          const match = contextLines.match(pattern)
          if (match) {
            fnName = match[1]
            break
          }
        }
        
        if (fnName) {
          cognitive[`${filePath}#${fnName}`] = complexity
        }
      }
    }
  }
  return Object.keys(cognitive).length ? cognitive : null
}

async function main() {
  const args = parseArgs(process.argv)
  const gitPath = args.git
  const targetsPath = args.targets
  const outMd = args['out-md']
  const outCsv = args['out-csv']
  const configPath = args['config']
  const coverageJsonPath = args['coverage'] || 'coverage/coverage-summary.json'

  // P2-1: 基本输入校验
  const cfg = loadConfig(configPath)
  if (!cfg || typeof cfg !== 'object') throw new Error('Invalid config file')
  
  // 根据评分模式验证配置
  const mode = cfg.scoringMode || 'legacy'
  if (mode === 'layered') {
    if (!cfg.layers || typeof cfg.layers !== 'object') throw new Error('Layered mode requires cfg.layers')
  } else {
    if (!cfg.weights || !cfg.thresholds) throw new Error('Legacy mode requires cfg.weights and cfg.thresholds')
  }
  
  // Git signals 可选（--skip-git 时为空对象）
  const gitSignals = loadJson(gitPath) || {}
  
  const targets = loadJson(targetsPath)
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('Missing or empty targets array')

  // P0-3: 加载项目内校准数据
  const hintMaps = cfg?.hintMaps || {}
  const localImpact = loadJson(hintMaps.impactLocal)
  const localROI = loadJson(hintMaps.roiLocal)
  const overrides = loadJson(cfg?.overrides)

  // P0-1: 加载 ESLint cognitive
  const eslintCognitive = loadESLintCognitive('reports/eslint.json') || null
  if (!eslintCognitive) {
    process.stdout.write('⚠️  ESLint cognitive complexity not available, using cyclomatic only\n')
  }

  const funcProvider = await buildFuncMetricsProvider(targets)
  
  // P0-2: 构建依赖图
  const depGraph = cfg?.depGraph?.enable ? buildDepGraph(funcProvider.project, cfg) : null

  // 读取覆盖率汇总（如果存在）
  let coverageSummary = null
  if (existsSync(coverageJsonPath)) {
    try { coverageSummary = JSON.parse(readFileSync(coverageJsonPath, 'utf8')) } catch {}
  }

  const rows = []
  for (const t of targets) {
    const { name, path, type = 'function', impactHint = '', roiHint = {}, internal = false, loc = 0 } = t
    const metrics = pickMetricsForTarget(funcProvider, t)
    const git = gitSignals[path] || null
    const depGraphData = depGraph?.get(path) || null

    const BC = mapBCByConfig({ name, path, impactHint }, cfg, overrides)
    const CC = mapCCFromMetrics(metrics, cfg, eslintCognitive, t, overrides)
    
    // P0-4: 先计算 likelihood，再应用平台调整
    let likelihood = 0
    if (git) {
      const rules = cfg?.likelihoodRules || []
      const c30 = git?.commits30d ?? 0, c90 = git?.commits90d ?? 0, c180 = git?.commits180d ?? 0
      likelihood = cfg?.fallbacks?.ERLikelihood ?? 3
      for (const r of rules) {
        if (r.field === 'commits30d') { if (r.op === '>=') { if (c30 >= r.value) { likelihood = r.score; break } } if (r.op === 'between') { if (c30 >= r.min && c30 <= r.max) { likelihood = r.score; break } } }
        if (r.field === 'fallback90d' && r.op === 'gt') { if (c30 === 0 && c90 > r.value) { likelihood = r.score; break } }
        if (r.field === 'fallback180dZero' && r.op === 'eq') { if (c90 === 0 && c180 === 0 && r.value === true) { likelihood = r.score; break } }
      }
    }
    
    // 应用平台调整（仅当 likelihood < 4 时）
    const plat = cfg?.ccMapping?.platformAdjust
    let CCFinal = CC
    if (git?.multiPlatform && likelihood < (plat?.skipIfLikelihoodGte ?? 4)) {
      CCFinal = clamp(CC + (plat?.delta ?? 0), 2, plat?.cap ?? 10)
    }
    
    const ER = mapERFromGitAndImpactConfig(git, impactHint, depGraphData, cfg, overrides, localImpact, t)
    const ROI = mapROIByConfig(roiHint, cfg, localROI, overrides, t)
    const testability = mapTestabilityByConfig(roiHint, cfg, localROI, overrides, t)
    const dependencyCount = mapDependencyCount(depGraphData, cfg)

    // 计算覆盖率分数（用于打分）
    let coveragePct = null
    let coverageScore = null
    if (coverageSummary) {
      const fileKey = Object.keys(coverageSummary).find(k => k.endsWith(path))
      const fileCov = fileKey ? coverageSummary[fileKey] : null
      const linesPct = fileCov?.lines?.pct
      if (typeof linesPct === 'number') coveragePct = linesPct
      coverageScore = mapCoverageScore(linesPct, cfg)
    }

    // 根据代码特征和路径匹配层级（如果还没有匹配）
    if (!t.layer || t.layer === 'unknown') {
      t.layer = matchLayer(t, cfg)  // 传入整个 target，而不是路径
    }

    // ✅ AI 增强：应用 AI 分析建议（如果启用且已分析）
    let enhancedBC = BC
    let enhancedER = ER
    let enhancedTestability = testability
    
    if (cfg?.aiEnhancement?.enabled && cfg?.aiEnhancement?.analyzed && cfg?.aiEnhancement?.suggestions) {
      const suggestions = cfg.aiEnhancement.suggestions
      
      // 匹配 businessCriticalPaths（提升 BC）
      if (suggestions.businessCriticalPaths && Array.isArray(suggestions.businessCriticalPaths)) {
        for (const item of suggestions.businessCriticalPaths) {
          if (matchPattern(path, item.pattern)) {
            enhancedBC = Math.max(enhancedBC, item.suggestedBC)
            break // 只应用第一个匹配
          }
        }
      }
      
      // 匹配 highRiskModules（提升 ER）
      if (suggestions.highRiskModules && Array.isArray(suggestions.highRiskModules)) {
        for (const item of suggestions.highRiskModules) {
          if (matchPattern(path, item.pattern)) {
            enhancedER = Math.max(enhancedER, item.suggestedER)
            break
          }
        }
      }
      
      // 匹配 testabilityAdjustments（调整 testability）
      if (suggestions.testabilityAdjustments && Array.isArray(suggestions.testabilityAdjustments)) {
        for (const item of suggestions.testabilityAdjustments) {
          if (matchPattern(path, item.pattern)) {
            const adj = parseInt(item.adjustment)
            if (!isNaN(adj)) {
              enhancedTestability = clamp(enhancedTestability + adj, 0, 10)
            }
            break
          }
        }
      }
    }

    let { score, priority, layer, layerName } = computeScore({ 
      BC: enhancedBC, 
      CC: CCFinal, 
      ER: enhancedER, 
      ROI, 
      testability: enhancedTestability, 
      dependencyCount, 
      coverageScore 
    }, t, cfg)

    // 覆盖率加权（可选）：对低覆盖文件小幅加分
    if (coverageSummary) {
      const cfgBoost = cfg?.coverageBoost || { enable: false }
      if (cfgBoost.enable && typeof coveragePct === 'number') {
        const threshold = cfgBoost.threshold ?? 60
        const maxBoost = cfgBoost.maxBoost ?? 0.5
        if (coveragePct < threshold) {
          const ratio = (threshold - coveragePct) / Math.max(threshold, 1)
          const delta = toFixedDown(Math.min(maxBoost, ratio * (cfgBoost.scale ?? 0.5)), 2)
          score = toFixedDown(score + delta, cfg?.round?.digits ?? 2)
          // 重新判定优先级
          const layerDef = cfg?.layers?.[layer]
          const thresholds = (layerDef?.thresholds) || { P0: pickThreshold(cfg,'P0',8.5), P1: pickThreshold(cfg,'P1',6.5), P2: pickThreshold(cfg,'P2',4.5) }
          if (score >= thresholds.P0) priority = 'P0'
          else if (score >= thresholds.P1) priority = 'P1'
          else if (score >= thresholds.P2) priority = 'P2'
        }
      }
    }
    
    rows.push({ 
      name, 
      path, 
      type, 
      layer: layer || 'N/A',
      layerName: layerName || 'N/A',
      BC: enhancedBC,  // 使用 AI 增强后的值
      CC: CCFinal, 
      ER: enhancedER,  // 使用 AI 增强后的值
      ROI, 
      testability: enhancedTestability,  // 使用 AI 增强后的值
      dependencyCount,
      coveragePct: coveragePct ?? 'N/A',
      coverageScore: coverageScore ?? 'N/A',
      score, 
      priority
    })
  }

  // 保留旧状态（DONE/SKIP）
  const statusMap = readExistingStatus(outMd)
  
  if (outMd) writeFileSync(outMd, defaultMd(rows, statusMap))
  if (outCsv) writeFileSync(outCsv, defaultCsv(rows))
}

/**
 * 读取现有报告的状态信息
 */
function readExistingStatus(mdPath) {
  const statusMap = new Map()
  
  if (!mdPath || !existsSync(mdPath)) {
    return statusMap
  }
  
  try {
    const content = readFileSync(mdPath, 'utf-8')
    const lines = content.split('\n')
    
    for (const line of lines) {
      // 匹配表格行: | Status | ... | Name | ... | Path |
      if (line.includes('| DONE |') || line.includes('| SKIP |')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean)
        if (parts.length >= 4) {
          const status = parts[0] // DONE 或 SKIP
          const name = parts[3]   // Name 列
          const path = parts[6]   // Path 列
          const key = `${path}#${name}`
          statusMap.set(key, status)
        }
      }
    }
  } catch (err) {
    // 忽略读取错误，返回空 map
  }
  
  return statusMap
}

main()
