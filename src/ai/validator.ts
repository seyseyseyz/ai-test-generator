/**
 * AI 响应验证器
 */

import type { AISuggestions, SuggestionSchema, SuggestionItem } from '../types/ai-suggestions.js'

type ValidatorValue = string | number | string[] | unknown

const SCHEMA: Record<string, SuggestionSchema> = {
  businessCriticalPaths: {
    minConfidence: 0.85,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'suggestedBC', 'evidence'],
    validators: {
      pattern: (v: ValidatorValue) => typeof v === 'string' && /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v: ValidatorValue) => typeof v === 'number' && v >= 0.85 && v <= 1.0,
      suggestedBC: (v: ValidatorValue) => typeof v === 'number' && [8, 9, 10].includes(v),
      reason: (v: ValidatorValue) => typeof v === 'string' && v.length > 0 && v.length <= 200,
      evidence: (v: ValidatorValue) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  },
  highRiskModules: {
    minConfidence: 0.75,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'suggestedER', 'evidence'],
    validators: {
      pattern: (v: ValidatorValue) => typeof v === 'string' && /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v: ValidatorValue) => typeof v === 'number' && v >= 0.75 && v <= 1.0,
      suggestedER: (v: ValidatorValue) => typeof v === 'number' && [7, 8, 9, 10].includes(v),
      reason: (v: ValidatorValue) => typeof v === 'string' && v.length > 0 && v.length <= 200,
      evidence: (v: ValidatorValue) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  },
  testabilityAdjustments: {
    minConfidence: 0.80,
    maxCount: 10,
    requiredFields: ['pattern', 'confidence', 'reason', 'adjustment', 'evidence'],
    validators: {
      pattern: (v: ValidatorValue) => typeof v === 'string' && /^[a-z0-9_/-]+\/?\*?\*?$/.test(v),
      confidence: (v: ValidatorValue) => typeof v === 'number' && v >= 0.80 && v <= 1.0,
      adjustment: (v: ValidatorValue) => typeof v === 'string' && ['-2', '-1', '+1', '+2'].includes(v),
      reason: (v: ValidatorValue) => typeof v === 'string' && v.length > 0 && v.length <= 200,
      evidence: (v: ValidatorValue) => Array.isArray(v) && v.length >= 2 && v.length <= 3
    }
  }
}

/**
 * 验证单个建议
 */
function validateSuggestion(item: Record<string, unknown>, schema: SuggestionSchema): boolean {
  // 检查必需字段
  for (const field of schema.requiredFields) {
    if (!(field in item)) {
      return false
    }
  }
  
  // 检查置信度
  const confidence = item.confidence
  if (typeof confidence !== 'number' || confidence < schema.minConfidence) {
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
export function validateAndSanitize(parsed: { suggestions?: Record<string, unknown[]> }): AISuggestions {
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
        .filter((item): item is Record<string, unknown> => 
          typeof item === 'object' && item !== null && validateSuggestion(item as Record<string, unknown>, schema)
        )
        .sort((a, b) => {
          const aConf = typeof a.confidence === 'number' ? a.confidence : 0
          const bConf = typeof b.confidence === 'number' ? b.confidence : 0
          return bConf - aConf
        })
        .slice(0, schema.maxCount)
      
      result[key] = validated as SuggestionItem[]
    }
  }
  
  return result
}

