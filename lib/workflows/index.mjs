/**
 * Workflows 模块：编排工作流
 * 
 * 提供批量测试生成和全自动化流程编排
 * 组合 Core、AI 和 Testing 模块实现端到端工作流
 */

// 主要工作流
export * from './init.mjs'
export * from './analyze.mjs'
export * from './scan.mjs'
export * from './generate.mjs'
export * from './iterative-improve.mjs'

// 🆕 v2.4.0: 并行生成工作流
export * from './parallel-generate.mjs'

// 批处理工作流（内部使用）
export { main as runBatch } from './batch.mjs'
export { main as runAll } from './all.mjs'

