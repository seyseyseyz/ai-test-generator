/**
 * AI 模块：AI 交互与测试生成
 * 
 * 提供 Prompt 构建、AI 调用和测试提取功能
 * 支持多种 LLM（目前实现：cursor-agent）
 * 
 * AI 分析功能：代码库分析、配置优化建议
 */

// 测试生成相关
export { buildBatchPrompt, runCLI as buildPrompt } from './prompt-builder.js'
// export { main as callAI } from './client.js' // CLI only, not exported
export { extractTests } from './extractor.js'

// AI 分析相关
export * from './sampler.js'
export * from './context-builder.js'
export * from './analyzer-prompt.js'
export * from './validator.js'
export * from './reviewer.js'
export * from './config-writer.js'

