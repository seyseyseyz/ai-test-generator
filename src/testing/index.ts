/**
 * Testing 模块：测试运行与失败分析
 * 
 * 提供测试执行和失败报告分析功能
 * 支持多种测试框架（目前实现：Jest）
 */

// export { main as runTests } from './runner.js' // CLI only
// export { main as analyzeFailures } from './analyzer.js' // CLI only
export * from './runner.js'
export * from './analyzer.js'
export * from './stability-checker.js'

// 🆕 v2.3.0: Cobertura 覆盖率解析（Keploy 风格）
export * from './coverage-parser.js'

// 🆕 v3.1.0: Test validation (Qodo 风格)
export * from './validator.js'

// 🆕 v3.1.0: Test deduplication (Keploy 风格)
export * from './deduplicator.js'

