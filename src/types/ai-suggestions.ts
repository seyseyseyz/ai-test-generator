/**
 * AI Suggestions and Validation types
 * @packageDocumentation
 */

/**
 * Business critical path suggestion
 */
export interface BusinessCriticalPath {
  pattern: string
  confidence: number
  reason: string
  suggestedBC: number
  evidence: string[]
}

/**
 * High risk module suggestion
 */
export interface HighRiskModule {
  pattern: string
  confidence: number
  reason: string
  suggestedER: number
  evidence: string[]
}

/**
 * Testability adjustment suggestion
 */
export interface TestabilityAdjustment {
  pattern: string
  confidence: number
  reason: string
  adjustment: string
  evidence: string[]
}

/**
 * Complete AI suggestions structure
 */
export interface AISuggestions {
  businessCriticalPaths: BusinessCriticalPath[]
  highRiskModules: HighRiskModule[]
  testabilityAdjustments: TestabilityAdjustment[]
}

/**
 * Union type for all suggestion items
 */
export type SuggestionItem = BusinessCriticalPath | HighRiskModule | TestabilityAdjustment

/**
 * Category keys for suggestions
 */
export type CategoryKey = keyof AISuggestions

/**
 * AI response validation schema
 */
export interface SuggestionSchema {
  minConfidence: number
  maxCount: number
  requiredFields: string[]
  validators: Record<string, (value: unknown) => boolean>
}

/**
 * Generic validator function type
 */
export type Validator = (value: unknown) => boolean

