/**
// @ts-nocheck
 * AI 响应验证器
 */

import type { AISuggestions, SuggestionSchema } from '../types/ai-suggestions.js'

const SCHEMA: Record<string, SuggestionSchema> = {
  businessCriticalPaths: {
    minConfidence: 0.85,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'suggestedBC', 'evidence'],
    validators: {
      pattern: (v: any) => /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v: any) => v >= 0.85 && v <= 1.0,
      suggestedBC: (v: any) => [8, 9, 10].includes(v),
      reason: (v: any) => v.length > 0 && v.length <= 200,
      evidence: (v: any) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  },
  highRiskModules: {
    minConfidence: 0.75,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'suggestedER', 'evidence'],
    validators: {
      pattern: (v: any) => /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v: any) => v >= 0.75 && v <= 1.0,
      suggestedER: (v: any) => [7, 8, 9, 10].includes(v),
      reason: (v: any) => v.length > 0 && v.length <= 200,
      evidence: (v: any) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  },
  testabilityAdjustments: {
    minConfidence: 0.80,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'adjustment', 'evidence'],
    validators: {
      pattern: (v: any) => /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v: any) => v >= 0.80 && v <= 1.0,
      adjustment: (v: any) => ['-2', '-1', '+1', '+2'].includes(v),
      reason: (v: any) => v.length > 0 && v.length <= 200,
      evidence: (v: any) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  }
}

/**
 * 验证单个建议
 */
function validateSuggestion(item: Record<string, any>, schema: SuggestionSchema): boolean {
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
    if (field in item && !(validator as any)(item[field])) {
      return false
    }
  }
  
  return true
}

/**
 * 验证并清洗 AI 响应
 */
export function validateAndSanitize(parsed: { suggestions?: any }): AISuggestions {
  const result: AISuggestions = {
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
    if (key === 'businessCriticalPaths' || key === 'highRiskModules' || key === 'testabilityAdjustments') {
      const schema = SCHEMA[key]
      if (!schema || !Array.isArray(items)) continue
      
      const validated = items
        .filter(item => validateSuggestion(item, schema))
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, schema.maxCount)
      
      result[key] = validated as any
    }
  }
  
  return result
}

