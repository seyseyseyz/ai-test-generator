/**
 * 评分系统的类型定义
 */

import type { Layer } from '../../types/index.js'

// 重新导出 FunctionTarget
export type { FunctionTarget } from '../../types/index.js'

/**
 * 评分配置
 */
export interface ScoringConfig {
  mode?: 'layered' | 'unified'
  layers?: Record<Layer, LayerConfig>
  weights?: ScoringWeights
  thresholds?: ScoringThresholds
  mainChainPaths?: string[]
  aiEnhancement?: {
    analyzed?: boolean
    analyzedAt?: string
    suggestions?: AISuggestions
  }
}

/**
 * 层级配置
 */
export interface LayerConfig {
  patterns: string[]
  weights: LayerWeights
  thresholds: PriorityThresholds
}

/**
 * 层级权重
 */
export interface LayerWeights {
  BC: number
  CC: number
  ER: number
  testability: number
  dependencyCount: number
  coverage: number
}

/**
 * 优先级阈值
 */
export interface PriorityThresholds {
  P0: number
  P1: number
  P2: number
}

/**
 * 评分权重
 */
export interface ScoringWeights {
  BC?: number
  CC?: number
  ER?: number
  ROI?: number
  coverage?: number
}

/**
 * 评分阈值
 */
export interface ScoringThresholds {
  P0?: number
  P1?: number
  P2?: number
}

/**
 * AI 建议
 */
export interface AISuggestions {
  businessCriticalPaths?: SuggestionItem[]
  highRiskModules?: SuggestionItem[]
  testabilityAdjustments?: SuggestionItem[]
}

/**
 * 建议项
 */
export interface SuggestionItem {
  pattern: string
  confidence: number
  reason: string
  evidence?: string[]
  suggestedBC?: number
  suggestedER?: number
  adjustment?: string
}

/**
 * 评分指标
 */
export interface ScoringMetrics {
  BC: number
  CC: number
  ER: number
  ROI?: number
  testability?: number
  dependencyCount?: number
  coverageScore?: number
  cyclomatic?: number
  cognitive?: number
}

/**
 * 评分后的目标
 */
export interface ScoredTarget {
  name: string
  path: string
  type: string
  exported: boolean
  BC: number
  CC: number
  ER: number
  ROI?: number
  testability?: number
  score: number
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  layer?: Layer
  coverageScore?: number
  dependencyCount?: number
}

/**
 * 依赖图数据
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>
  edges: Map<string, Set<string>>
}

/**
 * 依赖节点
 */
export interface DependencyNode {
  filePath: string
  imports: string[]
  exports: string[]
}

/**
 * Git 信号数据
 */
export interface GitSignals {
  totalCommits: number
  recentCommits: number
  uniqueAuthors: number
  avgTimeGap: number
  crossModuleRefs: number
}

/**
 * 影响提示
 */
export interface ImpactHint {
  hasExternal?: boolean
  hasAsync?: boolean
  hasTryCatch?: boolean
  hasComplexLogic?: boolean
}

/**
 * 代码指标提供者
 */
export interface MetricsProvider {
  byFunc?: Record<string, FunctionMetrics>
}

/**
 * 函数指标
 */
export interface FunctionMetrics {
  cyclomatic: number
  cognitive?: number
}

/**
 * 覆盖率数据
 */
export interface CoverageData {
  [filePath: string]: {
    lineCoverage?: number
    branchCoverage?: number
    functionCoverage?: number
  }
}

/**
 * 评分结果行
 */
export interface ScoringRow {
  target: ScoredTarget
  status?: string
}

/**
 * ESLint 认知复杂度数据
 */
export interface ESLintCognitiveData {
  [filePath: string]: {
    [functionName: string]: number
  }
}

