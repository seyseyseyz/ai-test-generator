/**
 * Core 模块：代码分析与评分引擎
 * 
 * 提供核心的代码扫描、Git 历史分析和优先级评分功能
 * 该模块不依赖 AI，可独立使用
 */

export { main as scanCode } from './scanner.mjs'
export { main as analyzeGit } from './git-analyzer.mjs'
export { main as scoreTargets } from './scorer.mjs'

// 🆕 v2.3.0: 竞品特性（Keploy/Qodo 启发）
export * from './boundary-detector.mjs'
export * from './mock-analyzer.mjs'

// 🆕 v2.4.0: Behavior 分类系统（Qodo Cover 风格）
export * from './behavior-classifier.mjs'

