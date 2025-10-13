/**
 * Testing 模块：测试运行与失败分析
 * 
 * 提供测试执行和失败报告分析功能
 * 支持多种测试框架（目前实现：Jest）
 */

export { main as runTests } from './runner.mjs'
export { main as analyzeFailures } from './analyzer.mjs'
export * from './stability-checker.mjs'

// 🆕 v2.3.0: Cobertura 覆盖率解析（Keploy 风格）
export * from './coverage-parser.mjs'

