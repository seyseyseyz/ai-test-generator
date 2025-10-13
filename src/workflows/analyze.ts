// @ts-nocheck
/**
 * Analyze 工作流：AI 分析代码库并生成配置建议
 */

import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { detectConfig } from '../utils/config-manager.js'
import { sampleCodeFiles, analyzeProjectStructure } from '../ai/sampler.js'
import { buildProjectContext } from '../ai/context-builder.js'
import { buildAnalysisPrompt } from '../ai/analyzer-prompt.js'
import { validateAndSanitize } from '../ai/validator.js'
import { interactiveReview } from '../ai/reviewer.js'
import { applyAISuggestions } from '../ai/config-writer.js'

/**
 * AI 分析工作流
 */
export async function analyze(options) {
  const { config, output } = options
  
  // 1. 检查配置是否存在
  console.log('🔍 Step 1: Checking configuration...')
  const configPath = detectConfig(config)
  
  if (!configPath) {
    console.error('❌ Config not found. Run `ai-test init` first.')
    process.exit(1)
  }
  
  console.log(`   Using config: ${configPath}\n`)
  
  // 2. 分析项目结构
  console.log('📊 Step 2: Analyzing project structure...')
  const stats = await analyzeProjectStructure()
  console.log(`   Total files: ${stats.totalFiles}`)
  console.log(`   Total lines: ${stats.totalLines}`)
  console.log(`   Avg lines/file: ${stats.avgLinesPerFile}\n`)
  
  // 3. 智能采样代码
  console.log('🎯 Step 3: Sampling representative code...')
  const samples = await sampleCodeFiles()
  console.log(`   Selected ${samples.length} files across layers\n`)
  
  // 4. 构建项目上下文
  console.log('📦 Step 4: Reading project context...')
  const projectCtx = await buildProjectContext()
  console.log(`   Framework: ${projectCtx.framework}`)
  if (projectCtx.platforms.length > 0) {
    console.log(`   Platforms: ${projectCtx.platforms.join(', ')}`)
  }
  if (projectCtx.uiLibraries.length > 0) {
    console.log(`   UI Libraries: ${projectCtx.uiLibraries.join(', ')}`)
  }
  if (projectCtx.stateManagement.length > 0) {
    console.log(`   State: ${projectCtx.stateManagement.join(', ')}`)
  }
  if (projectCtx.testingTools.length > 0) {
    console.log(`   Testing: ${projectCtx.testingTools.join(', ')}`)
  }
  if (projectCtx.criticalDeps.length > 0) {
    console.log(`   Critical deps: ${projectCtx.criticalDeps.join(', ')}`)
  }
  console.log()
  
  // 5. 构建 AI Prompt
  console.log('✍️  Step 5: Building AI analysis prompt...')
  const prompt = buildAnalysisPrompt(samples, stats, projectCtx)
  
  // 保存 prompt 到临时文件
  const promptPath = 'prompt_analyze.txt'
  writeFileSync(promptPath, prompt, 'utf-8')
  console.log(`   Prompt saved to: ${promptPath}\n`)
  
  // 6. 调用 Cursor Agent
  console.log('🤖 Step 6: Calling Cursor Agent...')
  console.log('   Cursor will analyze the full codebase using its index...')
  console.log('   This may take 1-2 minutes...\n')
  
  const responseText = await callCursorAgent(promptPath)
  
  if (!responseText) {
    console.error('❌ AI analysis failed or returned empty response')
    process.exit(1)
  }
  
  // 7. 解析并验证响应
  console.log('✅ Step 7: Validating AI suggestions...')
  
  let parsed
  try {
    // 尝试提取 JSON（AI 可能返回 markdown 包装）
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                      responseText.match(/```\s*([\s\S]*?)\s*```/)
    
    const jsonText = jsonMatch ? jsonMatch[1] : responseText
    parsed = JSON.parse(jsonText)
  } catch (err) {
    console.error('❌ Failed to parse AI response as JSON')
    console.error('   Response preview:', responseText.slice(0, 500))
    process.exit(1)
  }
  
  const validated = validateAndSanitize(parsed)
  
  const totalSuggestions = Object.values(validated).reduce((sum, arr) => sum + arr.length, 0)
  console.log(`   Validated ${totalSuggestions} suggestions\n`)
  
  if (totalSuggestions === 0) {
    console.log('⚠️  No valid suggestions from AI. Please check the response.')
    process.exit(0)
  }
  
  // 8. 交互式审核
  console.log('📝 Step 8: Interactive review...\n')
  const approved = await interactiveReview(validated)
  
  if (approved === null) {
    console.log('\n❌ No changes saved.')
    process.exit(0)
  }
  
  // 9. 写入配置
  console.log('\n💾 Step 9: Updating configuration...')
  
  try {
    await applyAISuggestions(configPath, approved)
    console.log('✅ Config updated!')
    console.log('\n💡 Next: Run `ai-test scan` to recalculate scores with AI enhancements.')
  } catch (err) {
    console.error(`❌ Failed to update config: ${err.message}`)
    process.exit(1)
  }
}

/**
 * 调用 Cursor Agent
 */
async function callCursorAgent(promptPath) {
  return new Promise((resolve, reject) => {
    // 读取 prompt
    let prompt
    try {
      prompt = readFileSync(promptPath, 'utf-8')
    } catch (err) {
      reject(new Error(`Failed to read prompt file: ${err.message}`))
      return
    }
    
    // 调用 cursor-agent --print（通过 stdin 传递 prompt）
    const child = spawn('cursor-agent', ['--print'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      shell: true,
      cwd: process.cwd()
    })
    
    const chunks = []
    child.stdout.on('data', (d) => chunks.push(Buffer.from(d)))
    
    // 写入 prompt 到 stdin
    child.stdin.write(prompt)
    child.stdin.end()
    
    // 超时处理（10 分钟）
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('cursor-agent timeout after 600s'))
    }, 600000)
    
    child.on('close', (code) => {
      clearTimeout(timeout)
      
      if (code !== 0) {
        reject(new Error(`cursor-agent exited with code ${code}`))
        return
      }
      
      const response = Buffer.concat(chunks).toString('utf-8')
      resolve(response)
    })
    
    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Failed to spawn cursor-agent: ${err.message}`))
    })
  })
}

