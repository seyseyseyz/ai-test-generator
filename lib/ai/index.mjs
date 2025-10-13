/**
 * AI 模块：AI 交互与测试生成
 * 
 * 提供 Prompt 构建、AI 调用和测试提取功能
 * 支持多种 LLM（目前实现：cursor-agent）
 * 
 * AI 分析功能：代码库分析、配置优化建议
 */

// 测试生成相关
export { buildBatchPrompt, runCLI as buildPrompt } from './prompt-builder.mjs'
export { main as callAI } from './client.mjs'
export { extractTests } from './extractor.mjs'

// AI 分析相关
export * from './sampler.mjs'
export * from './context-builder.mjs'
export * from './analyzer-prompt.mjs'
export * from './validator.mjs'
export * from './reviewer.mjs'
export * from './config-writer.mjs'

