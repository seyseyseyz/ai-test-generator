#!/usr/bin/env node
/**
 * 测试重构后的功能
 */

import { analyzeProject } from './dist/workflows/init-best-practices.js'
import { analyzeMockRequirements, formatMocksForPrompt } from './dist/core/mock-analyzer.js'
import { Project } from 'ts-morph'

console.log('🧪 测试重构后的功能\n')

// ============================================================================
// 测试 1: 项目分析
// ============================================================================
console.log('📋 测试 1: 项目分析')
console.log('─'.repeat(60))

try {
  const analysis = await analyzeProject(process.cwd())
  console.log('✅ 项目分析成功:')
  console.log(`   - 测试框架: ${analysis.testFramework}`)
  console.log(`   - 文件模式: ${analysis.testFilePattern}`)
  console.log(`   - 已有测试: ${analysis.hasExistingTests ? '是' : '否'}`)
  console.log(`   - 示例数量: ${analysis.testExamples.length}\n`)
} catch (error) {
  console.error('❌ 项目分析失败:', error.message)
  process.exit(1)
}

// ============================================================================
// 测试 2: Mock 分析（简化模式）
// ============================================================================
console.log('📋 测试 2: Mock 分析（简化模式）')
console.log('─'.repeat(60))

try {
  const project = new Project({ skipAddingFilesFromTsConfig: true })
  
  // 分析一个实际文件
  const testFile = 'src/ai/client.ts'
  const sourceFile = project.addSourceFileAtPath(testFile)
  const functions = sourceFile.getFunctions()
  
  if (functions.length > 0) {
    const targetFunc = functions[0]
    console.log(`📄 分析函数: ${targetFunc.getName()} (来自 ${testFile})`)
    
    const mocks = analyzeMockRequirements(targetFunc)
    console.log(`✅ 检测到 ${mocks.length} 种依赖类型\n`)
    
    if (mocks.length > 0) {
      const formatted = formatMocksForPrompt(mocks)
      console.log('格式化输出:')
      console.log(formatted)
    } else {
      console.log('   无外部依赖（纯函数）\n')
    }
  } else {
    console.log('⚠️  该文件没有函数定义\n')
  }
} catch (error) {
  console.error('❌ Mock 分析失败:', error.message)
  process.exit(1)
}

// ============================================================================
// 测试 3: Boundary Detector 已移除
// ============================================================================
console.log('📋 测试 3: 验证 Boundary Detector 已移除')
console.log('─'.repeat(60))

try {
  // 尝试导入，应该失败
  await import('./dist/core/boundary-detector.js')
  console.error('❌ Boundary Detector 仍然存在！')
  process.exit(1)
} catch (error) {
  console.log('✅ Boundary Detector 已成功移除\n')
}

console.log('─'.repeat(60))
console.log('✅ 所有测试通过！\n')

