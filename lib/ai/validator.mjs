/**
 * AI 响应验证器
 */

const SCHEMA = {
  businessCriticalPaths: {
    minConfidence: 0.85,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'suggestedBC', 'evidence'],
    validators: {
      pattern: (v) => /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v) => v >= 0.85 && v <= 1.0,
      suggestedBC: (v) => [8, 9, 10].includes(v),
      reason: (v) => v.length > 0 && v.length <= 200,
      evidence: (v) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  },
  highRiskModules: {
    minConfidence: 0.75,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'suggestedER', 'evidence'],
    validators: {
      pattern: (v) => /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v) => v >= 0.75 && v <= 1.0,
      suggestedER: (v) => [7, 8, 9, 10].includes(v),
      reason: (v) => v.length > 0 && v.length <= 200,
      evidence: (v) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  },
  testabilityAdjustments: {
    minConfidence: 0.80,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'adjustment', 'evidence'],
    validators: {
      pattern: (v) => /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v) => v >= 0.80 && v <= 1.0,
      adjustment: (v) => ['-2', '-1', '+1', '+2'].includes(v),
      reason: (v) => v.length > 0 && v.length <= 200,
      evidence: (v) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  }
}

/**
 * 验证单个建议
 */
function validateSuggestion(item, schema) {
  // 检查必需字段
  for (const field of schema.requiredFields) {
    if (!(field in item)) {
      return false
    }
  }
  
  // 检查置信度
  if (item.confidence < schema.minConfidence) {
    return false
  }
  
  // 运行字段验证器
  for (const [field, validator] of Object.entries(schema.validators)) {
    if (field in item && !validator(item[field])) {
      return false
    }
  }
  
  return true
}

/**
 * 验证并清洗 AI 响应
 */
export function validateAndSanitize(parsed) {
  const result = {
    businessCriticalPaths: [],
    highRiskModules: [],
    testabilityAdjustments: []
  }
  
  if (!parsed || typeof parsed !== 'object' || !parsed.suggestions) {
    console.warn('⚠️  Invalid AI response structure')
    return result
  }
  
  const suggestions = parsed.suggestions
  
  for (const [key, items] of Object.entries(suggestions)) {
    const schema = SCHEMA[key]
    if (!schema || !Array.isArray(items)) continue
    
    const validated = items
      .filter(item => validateSuggestion(item, schema))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, schema.maxCount)
    
    result[key] = validated
  }
  
  return result
}

