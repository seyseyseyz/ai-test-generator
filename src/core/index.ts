/**
 * Core 模块：代码分析与评分引擎
 * 
 * 提供核心的代码扫描、Git 历史分析和优先级评分功能
 * 该模块不依赖 AI，可独立使用
 */

// export { main as scanCode } from './scanner.js' // CLI only
// export { main as analyzeGit } from './git-analyzer.js' // CLI only
export * from './scanner.js'
export * from './git-analyzer.js'

// 🆕 v2.3.0: 竞品特性（Keploy/Qodo 启发）
export * from './mock-analyzer.js'

// 🆕 v2.4.0: Behavior 分类系统（Qodo Cover 风格）
export * from './behavior-classifier.js'

// Re-export scoring module (replaces scorer.js)
export * from './scoring/index.js'

