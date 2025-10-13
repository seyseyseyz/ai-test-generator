/**
 * ai-test-generator - AI-powered unit test generator with smart priority scoring
 * 
 * @example
 * ```javascript
 * // 使用 Core 模块进行代码分析
 * import { scanCode, scoreTargets } from 'ai-test-generator'
 * 
 * // 使用 AI 模块生成测试
 * import { buildPrompt, callAI, extractTests } from 'ai-test-generator/ai'
 * 
 * // 使用 Workflows 模块进行批量生成
 * import { runBatch, runAll } from 'ai-test-generator/workflows'
 * ```
 */

// 导出核心模块（最常用）
export * from './core/index.mjs'

// 导出其他模块（通过子路径导入）
// import * from 'ai-test-generator/ai'
// import * from 'ai-test-generator/testing'
// import * from 'ai-test-generator/workflows'
// import * from 'ai-test-generator/utils'

