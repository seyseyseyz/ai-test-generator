// @ts-nocheck
/**
 * 交互式 AI 建议审核器
 * 支持：一键全接受、一键全拒绝、部分接受（输数字）
 */

import readline from 'readline'

/**
 * 创建 readline 接口
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
}

/**
 * 询问用户输入
 */
function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve))
}

/**
 * 获取分类图标
 */
function getCategoryIcon(category) {
  const icons = {
    businessCriticalPaths: '🔴',
    highRiskModules: '⚠️',
    testabilityAdjustments: '✅'
  }
  return icons[category] || '📝'
}

/**
 * 获取分类名称
 */
function getCategoryName(category) {
  const names = {
    businessCriticalPaths: 'Business Critical Paths',
    highRiskModules: 'High Risk Modules',
    testabilityAdjustments: 'Testability Adjustments'
  }
  return names[category] || category
}

/**
 * 格式化单个建议（紧凑格式）
 */
function formatSuggestion(item, index, category) {
  let scoreInfo = ''
  
  if (category === 'businessCriticalPaths') {
    scoreInfo = `BC=${item.suggestedBC}`
  } else if (category === 'highRiskModules') {
    scoreInfo = `ER=${item.suggestedER}`
  } else if (category === 'testabilityAdjustments') {
    scoreInfo = `Adj=${item.adjustment}`
  }
  
  const confidence = `${(item.confidence * 100).toFixed(0)}%`
  
  return `  [${index}] ${item.pattern} | ${scoreInfo} | Conf: ${confidence}\n      → ${item.reason}`
}

/**
 * 显示所有建议（紧凑视图）
 */
function displayAllSuggestions(validated) {
  const categories = ['businessCriticalPaths', 'highRiskModules', 'testabilityAdjustments']
  const totalSuggestions = Object.values(validated).reduce((sum, arr) => sum + arr.length, 0)
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`\n🤖 AI Analysis Results: ${totalSuggestions} suggestions\n`)
  
  let globalIndex = 1
  const indexMapping = [] // [{ globalIndex, category, localIndex }, ...]
  
  for (const category of categories) {
    const items = validated[category] || []
    if (items.length === 0) continue
    
    const icon = getCategoryIcon(category)
    const name = getCategoryName(category)
    
    console.log(`\n${icon} ${name} (${items.length}):`)
    
    items.forEach((item, localIndex) => {
      console.log(formatSuggestion(item, globalIndex, category))
      indexMapping.push({ globalIndex, category, localIndex })
      globalIndex++
    })
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  
  return { totalSuggestions, indexMapping }
}

/**
 * 解析用户输入
 */
function parseUserInput(input, totalCount) {
  const trimmed = input.trim().toLowerCase()
  
  // 全接受
  if (trimmed === 'a' || trimmed === 'all') {
    return { type: 'accept_all' }
  }
  
  // 全拒绝
  if (trimmed === 'r' || trimmed === 'reject') {
    return { type: 'reject_all' }
  }
  
  // 部分接受（数字列表）
  const numbers = input.split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n >= 1 && n <= totalCount)
  
  if (numbers.length > 0) {
    return { type: 'partial', indices: numbers }
  }
  
  return { type: 'invalid' }
}

/**
 * 显示最终总结
 */
function displayFinalSummary(result, validated) {
  const totalSuggested = Object.values(validated).reduce((sum, arr) => sum + arr.length, 0)
  const totalAccepted = Object.values(result).reduce((sum, arr) => sum + arr.length, 0)
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`\n📊 Final Summary:`)
  console.log(`   🔴 Business Critical Paths: ${result.businessCriticalPaths.length}/${validated.businessCriticalPaths?.length || 0}`)
  console.log(`   ⚠️  High Risk Modules: ${result.highRiskModules.length}/${validated.highRiskModules?.length || 0}`)
  console.log(`   ✅ Testability Adjustments: ${result.testabilityAdjustments.length}/${validated.testabilityAdjustments?.length || 0}`)
  console.log(`   Total: ${totalAccepted}/${totalSuggested} accepted\n`)
  
  if (totalAccepted > 0) {
    console.log(`💡 These suggestions will be added to ai-test.config.jsonc`)
    console.log(`   and will take effect on next: ai-test scan`)
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
}

/**
 * 交互式审核（简化版）
 * @param {Object} validated - 已验证的建议
 * @returns {Object|null} - 用户批准的建议，或 null（取消）
 */
export async function interactiveReview(validated) {
  const rl = createInterface()
  
  try {
    // 1. 显示所有建议
    const { totalSuggestions, indexMapping } = displayAllSuggestions(validated)
    
    if (totalSuggestions === 0) {
      console.log('⚠️  No suggestions to review.')
      rl.close()
      return null
    }
    
    // 2. 询问用户操作
    const userInput = await ask(rl,
      `❓ Choose action:\n` +
      `   [a] Accept all ${totalSuggestions} suggestions\n` +
      `   [r] Reject all\n` +
      `   Or input numbers (comma-separated, e.g. 1,3,5-8)\n` +
      `\n> `
    )
    
    const parsed = parseUserInput(userInput, totalSuggestions)
    
    // 3. 处理用户选择
    const result = {
      businessCriticalPaths: [],
      highRiskModules: [],
      testabilityAdjustments: []
    }
    
    if (parsed.type === 'accept_all') {
      // 全接受
      result.businessCriticalPaths = validated.businessCriticalPaths || []
      result.highRiskModules = validated.highRiskModules || []
      result.testabilityAdjustments = validated.testabilityAdjustments || []
      
      console.log(`\n✅ Accepted all ${totalSuggestions} suggestions`)
      
    } else if (parsed.type === 'reject_all') {
      // 全拒绝
      console.log(`\n❌ Rejected all suggestions`)
      rl.close()
      return null
      
    } else if (parsed.type === 'partial') {
      // 部分接受
      const selectedIndices = new Set(parsed.indices)
      
      indexMapping.forEach(({ globalIndex, category, localIndex }) => {
        if (selectedIndices.has(globalIndex)) {
          const item = validated[category][localIndex]
          result[category].push(item)
        }
      })
      
      const totalAccepted = Object.values(result).reduce((sum, arr) => sum + arr.length, 0)
      console.log(`\n✅ Accepted ${totalAccepted}/${totalSuggestions} suggestions`)
      
      if (totalAccepted === 0) {
        console.log(`⚠️  No valid suggestions selected`)
        rl.close()
        return null
      }
      
    } else {
      // 无效输入
      console.log(`\n❌ Invalid input. No changes made.`)
      rl.close()
      return null
    }
    
    // 4. 显示最终总结
    displayFinalSummary(result, validated)
    
    // 5. 最终确认
    const confirm = await ask(rl, `💾 Apply these changes? (y/n)\n> `)
    
    rl.close()
    
    if (confirm.trim().toLowerCase() === 'y') {
      return result
    } else {
      console.log(`\n❌ Changes discarded.`)
      return null
    }
    
  } catch (err) {
    rl.close()
    throw err
  }
}

