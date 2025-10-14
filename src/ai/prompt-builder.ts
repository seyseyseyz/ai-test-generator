#!/usr/bin/env node
/**
 * 生成批量测试的 AI Prompt
 * 从评分报告中提取目标，构建包含源码上下文的 Prompt
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error - template file may not have types
import { generateFewShotPrompt } from '../../templates/test-examples.js';
import { type FunctionDeclaration, Project, type SourceFile } from 'ts-morph';
import { analyzeMockRequirements, formatMocksForPrompt } from '../core/mock-analyzer.js';
import { detectConfig, readConfig } from '../utils/config-manager.js';

interface TargetFilter {
  onlyTodo?: boolean
  priority?: string
  layer?: string
  minScore?: number
  onlyPaths?: string[]
  functionNames?: string[]
  limit?: number
  skip?: number
}

interface TestTarget {
  status: string
  score: number
  priority: string
  name: string
  type: string
  layer: string
  path: string
}

interface PromptOptions {
  framework?: string
  testFramework?: string
  customInstructions?: string
  reportPath?: string
}

/**
 * Load best practices from file or inline config
 */
function loadBestPractices(): string | null {
  try {
    const configPath = detectConfig()
    if (!configPath) return null
    
    const config = readConfig(configPath)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bestPractices = (config as any).bestPractices
    if (!bestPractices?.enabled) return null

    // Mode 1: Load from file
    if (bestPractices.source === 'file') {
      const filePath = join(process.cwd(), bestPractices.filePath || 'best_practices.md')
      if (!existsSync(filePath)) return null
      return readFileSync(filePath, 'utf8')
    }

    // Mode 2: Load from inline config
    if (bestPractices.source === 'inline' && bestPractices.inline) {
      const inline = bestPractices.inline
      return `
# Testing Standards (Inline)

- **Test Framework**: ${inline.testFramework}
- **File Pattern**: ${inline.testFilePattern}
- **Naming Convention**: ${inline.namingConvention}
- **Mock Strategy**: ${inline.mockStrategy}
- **Coverage Goal**: ${inline.coverageGoal}%

## Custom Rules

${inline.customRules.map((rule: string, i: number) => `${i + 1}. ${rule}`).join('\n')}
`
    }

    return null
  } catch {
    // If config loading fails, just skip best practices
    return null
  }
}


/**
 * 从 ut_scores.md 中解析测试目标
 */
export function parseTargets(mdPath: string, filter: TargetFilter = {}): TestTarget[] {
  if (!existsSync(mdPath)) {
    throw new Error(`报告文件不存在: ${mdPath}`);
  }
  
  const content = readFileSync(mdPath, 'utf8');
  const lines = content.split('\n');
  const targets: TestTarget[] = [];
  
  lines.forEach((line: string) => {
    // 🆕 v2.4.0: 支持 --only-todo 过滤（只保留 TODO 状态）
    if (filter.onlyTodo && !line.includes('| TODO |')) return;
    
    // 如果没有 onlyTodo，则只过滤 TODO（保持向后兼容）
    if (!filter.onlyTodo && !line.includes('| TODO |')) return;
    
    const parts = line.split('|').map(s => s.trim());
    if (parts.length < 8) return;
    
    const [, _status, score, priority, name, type, layer, path] = parts;
    
    // 应用过滤器
    if (filter.priority && priority !== filter.priority) return;
    if (filter.layer && layer && !layer.includes(filter.layer)) return;
    if (filter.minScore && parseFloat(score || '0') < filter.minScore) return;
    if (filter.onlyPaths && Array.isArray(filter.onlyPaths) && filter.onlyPaths.length > 0) {
      const allow = filter.onlyPaths.some(p => path === p || (path && path.endsWith(p)));
      if (!allow) return;
    }
    
    // 🆕 v2.4.0: 支持 --function-list 过滤（只包含指定函数名）
    if (filter.functionNames && Array.isArray(filter.functionNames) && filter.functionNames.length > 0) {
      if (!filter.functionNames.includes(name || '')) return;
    }
    
    targets.push({ 
      status: _status || '',
      name: name || '',
      type: type || '',
      layer: layer || '',
      path: path || '',
      priority: priority || '',
      score: parseFloat(score || '0')
    });
  });
  
  // 如果没有指定 priority 过滤器，按分数降序排序
  if (!filter.priority) {
    targets.sort((a, b) => b.score - a.score);
  }
  
  return targets;
}

/**
 * 提取函数源码
 */
export function extractFunctionCode(filePath: string, functionName: string): string {
  if (!existsSync(filePath)) {
    return `// 文件不存在: ${filePath}`;
  }
  
  try {
    const content = readFileSync(filePath, 'utf8');
    
    // 多种函数定义模式
    const patterns = [
      new RegExp(`export\\s+(async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)`, 'm'),
      new RegExp(`export\\s+const\\s+${functionName}\\s*=`, 'm'),
      new RegExp(`function\\s+${functionName}\\s*\\([^)]*\\)`, 'm'),
      new RegExp(`const\\s+${functionName}\\s*=`, 'm'),
    ];
    
    let matchIndex = -1;
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        matchIndex = content.indexOf(match[0]);
        break;
      }
    }
    
    if (matchIndex === -1) {
      return `// 未找到函数: ${functionName}`;
    }
    
    // 提取函数体
    let braceCount = 0;
    let inFunction = false;
    let funcCode = '';
    
    for (let i = matchIndex; i < content.length; i++) {
      const char = content[i];
      funcCode += char;
      
      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) break;
      }
      
      // 简单处理箭头函数
      if (funcCode.includes('=>') && !inFunction && char === ';') break;
    }
    
    return funcCode || content.slice(matchIndex, Math.min(matchIndex + 1000, content.length));
  } catch (err) {
      const error = err as Error
      return `// 读取失败: ${error?.message || String(err)}`;
  }
}

/**
 * 构建测试生成 Prompt
 */
export function buildBatchPrompt(targets: TestTarget[], options: PromptOptions = {}): string {
  const {
    framework = 'React + TypeScript',
    testFramework = 'Jest',
    customInstructions = ''
  } = options;
  
  const coverageTarget = 80;
  
  // 预先计算测试文件清单（用于 JSON manifest 与展示）
  const files = targets.map((t: TestTarget) => {
    const testPath = t.path.replace(/\.(ts|tsx|js|jsx)$/i, (m: string) => `.test${m}`)
    return {
      path: testPath,
      source: t.path,
      name: t.name,
      type: t.type,
      layer: t.layer,
      priority: t.priority,
      score: t.score
    }
  })

  // 🆕 Few-shot Learning: 根据第一个目标选择最佳示例
  const fewShotExample = targets.length > 0 ? generateFewShotPrompt(targets[0]) : ''

  // 🆕 v3.1.0: Load best practices
  const bestPractices = loadBestPractices()

  let prompt = `# 批量生成单元测试

你是一个单元测试专家。我需要为以下 ${targets.length} 个函数生成单元测试。

## 项目信息
- 框架：${framework}
- 测试框架：${testFramework} + Testing Library
- 要求：每个函数覆盖率 >= ${coverageTarget}%

${bestPractices ? `
## 📖 Project Testing Standards

${bestPractices}

⚠️ **IMPORTANT**: Follow the above standards strictly when generating tests.

---
` : ''}

${fewShotExample}

## 测试要求
1. 使用 ${testFramework} 的标准语法 (describe、test/it、expect)
2. 覆盖正常情况、边界条件、异常情况
3. 对于 React Hooks，使用 @testing-library/react-hooks
4. 对于 React 组件，使用 @testing-library/react
5. 对于工具函数，直接测试输入输出
6. 必要时使用 mock 模拟依赖
7. 测试文件命名：与原文件同名，加 .test 后缀
8. 严禁修改被测源码与新增依赖；避免使用真实时间/网络/随机数（请使用 fake timers、模块化 mock）

## ⚠️  测试场景分类（AI 自主分析）
**重要**：请基于函数的实际代码逻辑，自行分析以下三类测试场景：

### ✅ Happy Path（主流程）
- 分析函数的核心业务逻辑和设计意图
- 识别正常情况下的预期输入和输出
- 基于函数名、参数、返回值理解业务目的
- **示例**：\`loadJson\` 函数 → "加载有效的 JSONC 文件，正确处理注释并返回解析后的对象"

### ⚠️  Edge Cases（边界情况）
- 分析可能出现的特殊输入或状态
- 识别代码中的条件分支和边界判断（如 \`!filePath\`、空文件、特殊字符）
- 关注参数类型的边界值和极端情况
- **示例**：\`loadJson\` → 文件不存在、空文件路径、JSON 包含注释、空 JSON

### ❌ Error Handling（错误处理）
- 分析代码中的 try-catch、错误返回、异常抛出
- 识别可能失败的操作（文件读取、JSON 解析、网络请求）
- 明确错误处理方式（返回默认值、抛出异常、返回错误对象）
- **示例**：\`loadJson\` → JSON 语法错误返回 defaultValue、文件读取失败返回 defaultValue

**原则**：
- ❌ 不要凭空猜测！必须基于实际代码逻辑分析
- ❌ 不要生成与业务无关的通用测试（如"处理 null/undefined"）
- ✅ 每个场景必须有明确的代码依据（if 条件、try-catch、参数验证等）
- ✅ 场景描述应具体，体现业务价值
${customInstructions ? `\n${customInstructions}\n` : ''}
---

`;

  // 严格输出协议：先输出 JSON manifest，再输出逐文件代码块
  prompt += `## 测试文件清单（JSON Manifest）
请首先输出一个 JSON，包含将要生成的所有测试文件路径与源信息：

\`\`\`json
${JSON.stringify({ version: 1, files }, null, 2)}
\`\`\`

---
`;

  // 🆕 v2.3.0: 使用 ts-morph 进行深度分析（边界检测 + Mock 分析）
  let project: Project | null = null;
  try {
    project = new Project({ skipAddingFilesFromTsConfig: true });
  } catch {
    console.error('⚠️  Warning: ts-morph initialization failed, skipping advanced analysis');
  }

  targets.forEach((target: TestTarget, index: number) => {
    const code = extractFunctionCode(target.path, target.name);
    const testPath = target.path.replace(/\.(ts|tsx|js|jsx)$/i, (m: string) => `.test${m}`)
    
    // 🆕 v2.3.0: Mock 分析
    let mocksText = ''
    
    if (project && existsSync(target.path)) {
      try {
        const sourceFile: SourceFile = project.addSourceFileAtPath(target.path)
        const functions: FunctionDeclaration[] = sourceFile.getFunctions()
        const targetFunc = functions.find((f: FunctionDeclaration) => f.getName() === target.name)
        
        if (targetFunc) {
          // Mock 需求分析
          const mocks = analyzeMockRequirements(targetFunc)
          if (mocks.length > 0) {
            mocksText = `\n${formatMocksForPrompt(mocks)}`
          }
        }
      } catch (error: unknown) {
        const err = error as Error
        console.error(`⚠️  Analysis failed for ${target.name}:`, err?.message || String(error))
      }
    }
    
    prompt += `
## 测试 ${index + 1}/${targets.length}: ${target.name}

**文件路径**: \`${target.path}\`
**函数类型**: ${target.type}
**所属层级**: ${target.layer}
**优先级**: ${target.priority} (分数: ${target.score})

**函数源码**:
\`\`\`typescript
${code}
\`\`\`
${mocksText}
**测试文件路径**: \`${testPath}\`

---
`;
  });
  
  prompt += `
## 输出格式

请严格按照以下顺序与格式输出：

1) 先输出"测试文件清单（JSON Manifest）"——与上文格式一致，包含所有 "path"。
2) 然后依次输出每个测试文件的代码块：

### 测试文件: [文件路径]
\`\`\`typescript
[完整的测试代码]
\`\`\`

### 测试文件: [下一个文件路径]
...

要求：
- 代码块语言可为 ts/tsx/typescript/js/javascript/jsx 之一
- 文件路径必须与 JSON Manifest 中的 path 一致
- 不要省略任何测试文件

---

现在开始生成 ${targets.length} 个测试文件：
`;
  
  return prompt;
}

/**
 * CLI 入口
 */
export function runCLI(argv: string[] = process.argv): void {
  const args = argv.slice(2);
  const filter: TargetFilter = {};
  const options: PromptOptions & { reportPath?: string } = {};
  
  // 解析参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--priority' || arg === '-p') {
      filter.priority = args[++i];
    } else if (arg === '--layer' || arg === '-l') {
      filter.layer = args[++i];
    } else if (arg === '--limit' || arg === '-n') {
      filter.limit = parseInt(args[++i] || '10');
    } else if (arg === '--skip') {
      filter.skip = parseInt(args[++i] || '0');
    } else if (arg === '--min-score') {
      filter.minScore = parseFloat(args[++i] || '0');
    } else if (arg === '--report') {
      options.reportPath = args[++i];
    } else if (arg === '--framework') {
      options.framework = args[++i];
    } else if (arg === '--hints') {
      const hint = args[++i] || '';
      options.customInstructions = (options.customInstructions || '') + `\n${hint}`;
    } else if (arg === '--hints-file') {
      const p = args[++i] || '';
      try { options.customInstructions = (options.customInstructions || '') + `\n${readFileSync(p, 'utf8')}` } catch {
        // Ignore file read errors
      }
    } else if (arg === '--only-paths') {
      const csv = args[++i] || '';
      filter.onlyPaths = csv.split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--function-list') {
      // 🆕 v2.4.0: 支持从文件读取函数名列表（用于并行生成）
      const listPath = args[++i] || '';
      try {
        const functionNames = readFileSync(listPath, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
        filter.functionNames = functionNames;
      } catch (err: unknown) {
        const error = err as Error
        console.error(`⚠️  Failed to read function list: ${error?.message || String(err)}`);
      }
    } else if (arg === '--only-todo') {
      // 🆕 v2.4.0: 只处理 TODO 状态的函数
      filter.onlyTodo = true;
    }
  }
  
  const mdPath = options.reportPath || 'reports/ut_scores.md';
  
  try {
    let targets = parseTargets(mdPath, filter);
    
    // 支持跳过前 N 个（用于分页）
    const skip = Number.isInteger(filter.skip) && filter.skip !== undefined && filter.skip > 0 ? filter.skip : 0;
    if (skip) targets = targets.slice(skip);
    
    if (filter.limit) targets = targets.slice(0, filter.limit);
    
    if (targets.length === 0) {
      console.error('❌ 没有找到匹配的目标\n');
      console.error('用法示例:');
      console.error('  ai-test gen-prompt -p P0 -l Foundation -n 5');
      console.error('  ai-test gen-prompt -p P0 --min-score 7.5 -n 10\n');
      console.error('参数:');
      console.error('  -p, --priority     优先级过滤 (P0, P1, P2, P3)');
      console.error('  -l, --layer        层级过滤 (Foundation, Business, State, UI)');
      console.error('  -n, --limit        限制数量');
      console.error('      --skip         跳过前 N 个');
      console.error('  --min-score        最低分数');
      console.error('  --report           报告文件路径 (默认: reports/ut_scores.md)');
      console.error('  --framework        项目框架 (默认: React + TypeScript)');
      process.exit(1);
    }
    
    console.error(`✅ 找到 ${targets.length} 个目标\n`);
    console.log(buildBatchPrompt(targets, options));
  } catch (err: unknown) {
    const error = err as Error
    console.error(`❌ 错误: ${error?.message || String(err)}`);
    process.exit(1);
  }
}

// 作为脚本直接运行时
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI();
}

