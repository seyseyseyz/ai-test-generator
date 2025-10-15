/**
 * Best Practices Initialization
 * 
 * Automatically generates project-specific testing standards by analyzing
 * the existing codebase, test framework, and test patterns.
 * 
 * Supports two modes:
 * 1. File mode: Generates a standalone best_practices.md file (default)
 * 2. Inline mode: Embeds configuration in ai-test.config.jsonc
 * 
 * @module workflows/init-best-practices
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import fg from 'fast-glob'
import { runOnce } from '../ai/client.js'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Project analysis result
 */
export interface ProjectAnalysis {
  testFramework: 'jest' | 'mocha' | 'vitest' | 'unknown'
  testFilePattern: string
  hasExistingTests: boolean
  testExamples: string[]
}

/**
 * Inline best practices configuration
 */
export interface BestPracticesInline {
  testFramework: string
  testFilePattern: string
  namingConvention: string
  mockStrategy: string
  coverageGoal: number
  customRules: string[]
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Analyze project to extract testing patterns
 * 
 * @param rootDir - Project root directory
 * @returns Analysis result
 * 
 * @example
 * ```typescript
 * const analysis = await analyzeProject(process.cwd())
 * console.log(`Test framework: ${analysis.testFramework}`)
 * console.log(`Has tests: ${analysis.hasExistingTests}`)
 * ```
 */
export async function analyzeProject(rootDir: string): Promise<ProjectAnalysis> {
  // 1. Detect test framework from package.json
  const packageJsonPath = join(rootDir, 'package.json')
  if (!existsSync(packageJsonPath)) {
    throw new Error('package.json not found')
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

  let testFramework: ProjectAnalysis['testFramework'] = 'unknown'
  if (deps['jest']) testFramework = 'jest'
  else if (deps['vitest']) testFramework = 'vitest'
  else if (deps['mocha']) testFramework = 'mocha'

  // 2. Detect test file pattern
  const testFiles = await fg('**/*.{test,spec}.{ts,js,tsx,jsx}', {
    cwd: rootDir,
    ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**']
  })

  const testFilePattern = testFiles.length > 0
    ? (testFiles[0] && testFiles[0].includes('.test.')) ? '*.test.ts' : '*.spec.ts'
    : '*.test.ts'

  // 3. Extract test examples (up to 3)
  const testExamples = testFiles.slice(0, 3).map(file => {
    const fullPath = join(rootDir, file)
    return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : ''
  }).filter(content => content.length > 0)

  return {
    testFramework,
    testFilePattern,
    hasExistingTests: testFiles.length > 0,
    testExamples
  }
}

/**
 * Generate best practices as Markdown file
 * 
 * @param rootDir - Project root directory
 * @param analysis - Project analysis result
 * @returns Generated Markdown content
 * 
 * @example
 * ```typescript
 * const analysis = await analyzeProject(process.cwd())
 * const markdown = await generateBestPracticesFile(process.cwd(), analysis)
 * fs.writeFileSync('best_practices.md', markdown)
 * ```
 */
export async function generateBestPracticesFile(
  rootDir: string,
  analysis: ProjectAnalysis
): Promise<string> {
  const prompt = buildFilePrompt(rootDir, analysis)
  const result = await runOnce({ prompt, temperature: 0.3 })
  return readFileSync(result.out, 'utf8')
}

/**
 * Generate best practices as inline configuration
 * 
 * @param rootDir - Project root directory
 * @param analysis - Project analysis result
 * @returns Generated inline configuration
 * 
 * @example
 * ```typescript
 * const analysis = await analyzeProject(process.cwd())
 * const config = await generateBestPracticesInline(process.cwd(), analysis)
 * console.log(config.testFramework)
 * ```
 */
export async function generateBestPracticesInline(
  rootDir: string,
  analysis: ProjectAnalysis
): Promise<BestPracticesInline> {
  const prompt = buildInlinePrompt(rootDir, analysis)
  const result = await runOnce({ prompt, temperature: 0.3 })
  const aiResponse = readFileSync(result.out, 'utf8')
  
  // Parse JSON response
  try {
    const parsed = JSON.parse(aiResponse)
    return parsed as BestPracticesInline
  } catch (error) {
    throw new Error(`Failed to parse AI response as JSON: ${error}`)
  }
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for file-based best practices generation
 */
function buildFilePrompt(rootDir: string, analysis: ProjectAnalysis): string {
  return `
# Task: Generate Testing Best Practices Document

Analyze this project and generate a comprehensive best_practices.md file.

## Project Information

- **Test Framework**: ${analysis.testFramework}
- **Test File Pattern**: ${analysis.testFilePattern}
- **Has Existing Tests**: ${analysis.hasExistingTests}
- **Project Directory**: ${rootDir}

${analysis.testExamples.length > 0 ? `
## Existing Test Examples

${analysis.testExamples.map((example, i) => `
### Example ${i + 1}

\`\`\`typescript
${example.slice(0, 500)}
\`\`\`
`).join('\n')}
` : ''}

## Requirements

Generate a comprehensive best_practices.md file that includes:

1. **Test Framework Configuration**
   - Setup and installation instructions
   - Configuration file examples

2. **Naming Conventions**
   - Test file naming (based on existing tests if available)
   - Test suite and test case naming
   - Variable naming in tests

3. **Code Style and Import Organization**
   - Import order and grouping
   - Code formatting standards
   - TypeScript usage guidelines

4. **Mock Strategies**
   - When and how to mock dependencies
   - Recommended mocking libraries
   - Code examples for common scenarios

5. **Test Structure**
   - Arrange-Act-Assert pattern
   - Setup and teardown best practices
   - Test organization (describe/it blocks)

6. **Coverage Goals**
   - Target coverage percentages
   - What to test and what to skip
   - Critical path identification

7. **Project-Specific Rules**
   - Any patterns identified from existing tests
   - Special considerations for this codebase

## Output Format

- Use Markdown format
- Include clear section headings
- Provide code examples where appropriate
- Be concise but comprehensive
- Focus on actionable guidance

Generate the best_practices.md content now:
`.trim()
}

/**
 * Build prompt for inline best practices generation
 */
function buildInlinePrompt(rootDir: string, analysis: ProjectAnalysis): string {
  return `
# Task: Generate Testing Best Practices Configuration

Analyze this project and generate structured best practices configuration.

## Project Information

- **Test Framework**: ${analysis.testFramework}
- **Test File Pattern**: ${analysis.testFilePattern}
- **Has Existing Tests**: ${analysis.hasExistingTests}
- **Project Directory**: ${rootDir}

${analysis.testExamples.length > 0 ? `
## Existing Test Examples

${analysis.testExamples.map((example, i) => `
### Example ${i + 1}

\`\`\`typescript
${example.slice(0, 300)}
\`\`\`
`).join('\n')}
` : ''}

## Requirements

Generate a JSON object with these fields:

\`\`\`json
{
  "testFramework": "jest|vitest|mocha",
  "testFilePattern": "*.test.ts|*.spec.ts",
  "namingConvention": "should_describe_behavior|describe what it does",
  "mockStrategy": "jest.mock|vi.mock|sinon",
  "coverageGoal": 80,
  "customRules": [
    "Rule 1: ...",
    "Rule 2: ..."
  ]
}
\`\`\`

## Guidelines

- Keep customRules concise (max 5 rules, each < 100 chars)
- Use patterns from existing tests if available
- Be specific and actionable
- Focus on the most important practices

**IMPORTANT**: Output ONLY the JSON object, no additional text.

Generate the JSON configuration now:
`.trim()
}


