/**
// @ts-nocheck
 * AI 分析 Prompt 构建器
 */

export interface FileSample {
  path: string
  layer: string
  reason: string
  preview: string
}

export interface ProjectStats {
  totalFiles: number
  totalLines: number
  [key: string]: number
}

/**
 * 构建分析 Prompt
 */
export function buildAnalysisPrompt(samples: FileSample[], stats: ProjectStats, projectCtx: Record<string, any>): string {
  return `You are analyzing a ${projectCtx.framework} codebase to identify business-critical paths and high-risk modules.

## 📊 Project Overview

- **Framework**: ${projectCtx.framework}
- **Total Files**: ${stats.totalFiles}
- **Total Lines**: ${stats.totalLines}
- **Key Dependencies**: ${projectCtx.criticalDeps.join(', ') || 'None detected'}

## 📂 Code Samples (${samples.length} files)

${samples.map((s: FileSample, i: number) => `
### Sample ${i + 1}: ${s.path}
**Layer**: ${s.layer}
**Reason**: ${s.reason}

\`\`\`typescript
${s.preview}
\`\`\`
`).join('\n')}

## 🎯 Your Task

**YOU HAVE ACCESS TO THE FULL CODEBASE** via Cursor's indexing. The samples above are just for quick reference.

Please analyze the ENTIRE codebase (not just the samples) and suggest:

1. **businessCriticalPaths**: Which paths handle core business logic?
   - Look for: payment, booking, pricing, checkout, order processing
   - Use your codebase index to find all relevant files
   
2. **highRiskModules**: Which modules have high error risk?
   - Look for: date/time handling, external APIs, money calculations, parsing
   - Check for complex logic, many try-catch blocks
   
3. **testabilityAdjustments**: Which paths are easier/harder to test?
   - Look for: pure functions (easier), heavy dependencies (harder)
   - Consider side effects, I/O operations

## 💡 Use Your Codebase Knowledge

- You can search the codebase using @codebase
- You know the full dependency graph
- You understand the business logic from code context

## OUTPUT SCHEMA

\`\`\`json
{
  "suggestions": {
    "businessCriticalPaths": [
      {
        "pattern": "services/payment/**",
        "confidence": 0.95,
        "reason": "Handles Stripe payment processing",
        "suggestedBC": 10,
        "evidence": [
          "Contains processPayment function with Stripe API calls",
          "Referenced by checkout flow in multiple places",
          "Handles money transactions"
        ]
      }
    ],
    "highRiskModules": [
      {
        "pattern": "utils/date/**",
        "confidence": 0.88,
        "reason": "Complex timezone and date calculations",
        "suggestedER": 8,
        "evidence": [
          "Multiple timezone conversion functions",
          "Handles daylight saving time"
        ]
      }
    ],
    "testabilityAdjustments": [
      {
        "pattern": "utils/**",
        "confidence": 0.92,
        "reason": "Pure utility functions with no side effects",
        "adjustment": "+1",
        "evidence": [
          "All exports are pure functions",
          "No external dependencies observed"
        ]
      }
    ]
  }
}
\`\`\`

## CRITICAL RULES

1. **Output ONLY JSON** - No explanations, no markdown wrapper
2. **Match Schema Exactly** - Any deviation will be rejected
3. **Stay Within Bounds** - All scores must be within specified ranges
4. **Require Evidence** - Each suggestion needs 2-3 concrete evidence points
5. **No Assumptions** - Only suggest what you can directly observe

## CONSTRAINTS

- confidence ≥ 0.70 (businessCriticalPaths ≥ 0.85)
- 2-3 evidence items per suggestion
- Pattern must match actual paths in codebase
- Max 10 suggestions per category
- suggestedBC: 8 | 9 | 10
- suggestedER: 7 | 8 | 9 | 10
- adjustment: "-2" | "-1" | "+1" | "+2"

Output ONLY the JSON, no explanation.`
}

