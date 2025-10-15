/**
 * Workflows 模块：编排工作流
 * 
 * 提供批量测试生成和全自动化流程编排
 * 组合 Core、AI 和 Testing 模块实现端到端工作流
 */

// 主要工作流
export * from './init.js'
export * from './analyze.js'
export * from './scan.js'
export * from './generate.js'
export * from './iterative-improve.js'

// 🆕 v2.4.0: 并行生成工作流
export * from './parallel-generate.js'

// 🆕 v3.1.0: Best Practices 生成
export * from './init-best-practices.js'

// 🆕 v3.1.0: 实时验证生成
export * from './generate-with-validation.js'

// 🆕 v3.1.0: 覆盖率驱动生成 (Keploy 风格)
export * from './coverage-driven-generate.js'

// 批处理工作流（内部使用）
// export { main as runBatch } from './batch.js' // CLI only
// export { main as runAll } from './all.js' // CLI only

