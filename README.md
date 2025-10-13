# ai-unit-test-generator

> AI-powered unit test generator with intelligent priority scoring

[![npm version](https://img.shields.io/npm/v/ai-unit-test-generator.svg)](https://www.npmjs.com/package/ai-unit-test-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Key Features

### Core Features
- **🏗️ Layered Architecture Scoring**: Intelligent scoring based on code layers (Foundation, Business, State, UI)
- **🤖 AI-Native Design**: Perfect integration with Cursor Agent, ChatGPT, Claude, and more
- **📊 Coverage-Aware**: Integrates code coverage data for smart prioritization (incremental & existing code)
- **🎨 Multi-Dimensional Scoring**: Combines testability, complexity, dependency count, business criticality, error risk
- **⚡ Batch Generation**: Automated batch test generation with failure retry and progress tracking
- **📝 Rich Reports**: Generates detailed scoring reports in Markdown and CSV formats
- **🔄 Status Management**: Automatic progress tracking (TODO/DONE/SKIP)

### Advanced Features (v2.1+)
- **🔄 Iterative Improvement**: Meta TestGen-LLM style auto-improvement until quality standards met
- **🎲 N-Sample Generation**: Generate multiple candidates, select best (Meta Section 4.2)
- **🔐 Safety Features**: File write protection, automatic backups, dry-run mode
- **✅ Stability Checks**: Run tests multiple times to ensure consistency

### Competitive Features (v2.3.0 - Keploy & Qodo Inspired)
- **🎯 Boundary Detection**: Automatic identification of parameter and condition boundaries
- **📊 Cobertura Coverage**: Line-level precision coverage analysis (Keploy required format)
- **🔌 Mock Analysis**: Intelligent dependency detection with recommended mock strategies

### Phase 2 Features (v2.4.0)
- **🚀 Parallel Generation**: Multi-threaded test generation for 2-3x speed improvement using p-limit
- **🎭 Behavior Classification**: Automatic categorization into Happy Path, Edge Case, and Error Path tests (Qodo Cover style)

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g ai-unit-test-generator
```

### Project Installation

```bash
npm install --save-dev ai-unit-test-generator
```

## 🚀 Quick Start

### 1. Scan Code and Generate Priority Report

```bash
ai-test scan
```

On first run, it automatically generates a config file `ai-test.config.jsonc` with detailed comments.

The scan will:
1. Analyze code structure and identify testable targets
2. Auto-run Jest coverage analysis (if installed)
3. Analyze Git history for error signals
4. Calculate multi-dimensional priority scores
5. Generate sorted report (`reports/ut_scores.md`)

**Output Example:**

```markdown
| Status | Score | Priority | Name | Type | Layer | Path | Coverage | CS | BC | CC | ER | Testability | DepCount |
|--------|-------|----------|------|------|-------|------|----------|----|----|----|----|-------------|----------|
| TODO | 8.5 | P0 | validatePayment | function | Business Logic | src/services/payment.ts | 0.0% | 10 | 10 | 8 | 7 | 9 | 12 |
| TODO | 7.8 | P0 | formatCurrency | function | Foundation | src/utils/format.ts | 15.0% | 8 | 6 | 5 | 8 | 10 | 8 |
```

### 2. Generate Tests

```bash
# Generate tests for 10 functions (with auto-improvement, default)
ai-test generate

# Generate tests for 20 functions (with auto-improvement)
ai-test generate -n 20

# 🎲 N-Sample Generation: Generate 3 candidates per iteration, pick best
ai-test generate --samples 3

# Generate without auto-improvement (one-shot mode)
ai-test generate --no-iterative
```

The command will:
1. Select the top N highest-priority untested functions from the report
2. Invoke Cursor Agent to auto-generate tests
3. Extract and save test files
4. Run Jest to validate tests
5. **🔄 Check quality and auto-improve if needed (DEFAULT in v2.1+)**
6. Auto-update report status to DONE

**🔄 Iterative Mode** (DEFAULT in v2.1):
- **Enabled by default** - automatically improves test quality
- Checks: Build success (75%), test pass rate (57%), coverage increase (25%)
- Re-generates with feedback until quality standards met or max iterations (3)
- Based on Meta's TestGen-LLM research (2024)
- Use `--no-iterative` to disable (one-shot mode)

**🎲 N-Sample Generation** (NEW in v2.1.2):
- **Advanced mode** - generate multiple candidates, select best
- Use `--samples 3` to generate 3 candidates per iteration
- Scoring: Build (40%) + Tests Pass (30%) + Coverage (30%)
- Trade-off: Higher success rate vs longer time
- Recommended for critical/complex functions

### 3. Enable Cobertura Coverage (Recommended for v2.3+)

For **line-level precision** coverage (Keploy style), enable Cobertura format:

```bash
# Copy template
cp node_modules/ai-unit-test-generator/templates/jest.config.cobertura.js jest.config.js

# Or add to existing jest.config.js:
module.exports = {
  coverageReporters: ['text', 'cobertura', 'lcov'],  // ⭐ Add cobertura
  // ... other config
}
```

Then run coverage:
```bash
npm test -- --coverage
```

**Why Cobertura?**
- ✅ Line-level precision (vs statement-level)
- ✅ Better AI guidance for uncovered lines
- ✅ Industry standard (Keploy, SonarQube, Jenkins)

📖 **Full Guide**: [docs/COBERTURA_SETUP.md](docs/COBERTURA_SETUP.md)

### 4. Track Progress

```bash
# View report
cat reports/ut_scores.md

# View P0 priority tasks
grep "| P0 |" reports/ut_scores.md

# View pending tasks
grep "| TODO |" reports/ut_scores.md
```

## 📖 CLI Commands

### `ai-test scan`

Scan code and generate priority report

```bash
ai-test scan [options]

Options:
  -c, --config <path>   Config file path (default: ai-test.config.jsonc)
  -o, --output <dir>    Output directory (default: reports)
  --skip-git            Skip Git history analysis
```

**Output Files:**
- `reports/targets.json` - List of scanned targets
- `reports/git_signals.json` - Git analysis data
- `reports/ut_scores.md` - Markdown format report (sorted by score)
- `reports/ut_scores.csv` - CSV format report

### `ai-test generate`

Generate unit tests (using Cursor Agent)

```bash
ai-test generate [options]

Options:
  -n, --count <number>           Number of functions to generate tests for (default: 10)
  -p, --priority <level>         Priority filter (P0, P1, P2, P3)
  --all                          Generate all remaining TODO functions
  --no-iterative                 Disable iterative improvement (default: enabled)
  --max-iterations <number>      Maximum iterations for iterative mode (default: 3)
  --report <path>                Report file path (default: reports/ut_scores.md)
```

**Examples:**
```bash
ai-test generate                 # Generate top 10 with auto-improvement (default)
ai-test generate -n 20           # Generate top 20 with auto-improvement
ai-test generate -p P0           # Only P0 functions (if any)
ai-test generate --all           # Generate all TODO functions
ai-test generate --no-iterative  # Disable auto-improvement (one-shot mode)
```

The command automatically:
- Selects highest-priority untested functions
- Invokes Cursor Agent for test generation
- Extracts and saves test files
- Runs Jest validation
- Auto-marks DONE on success

### `ai-test parallel` (NEW in v2.4.0 🚀)

**Parallel test generation** - 2-3x faster than sequential mode

```bash
ai-test parallel [options]

Options:
  -n, --count <number>        Number of functions to generate (default: all TODO)
  -p, --priority <level>      Priority filter (P0, P1, P2, P3)
  -c, --concurrency <number>  Concurrent batches (default: 3, max: 5)
  --report <path>             Report file path (default: reports/ut_scores.md)
```

**Examples:**
```bash
ai-test parallel                   # All TODO functions, 3 concurrent batches
ai-test parallel -n 30             # Top 30 functions, 3 concurrent
ai-test parallel -p P0 -c 5        # All P0 functions, 5 concurrent
ai-test parallel -n 50 -c 4        # Top 50 functions, 4 concurrent
```

**How it works:**
1. Groups functions by file (better context efficiency)
2. Creates balanced batches (3-10 functions each)
3. Runs batches concurrently with p-limit control
4. Each batch: Prompt → AI → Extract → Test (independent)
5. Merges results and auto-updates report

**Performance:**
- ⚡ **2-3x faster** than `ai-test generate`
- 🎯 **Smart batching** by file grouping
- 🔐 **API-safe** with max concurrency limits
- 📊 **Detailed telemetry** in `reports/parallel_batches/parallel_report.json`

**When to use:**
- ✅ Large codebases (30+ TODO functions)
- ✅ Need faster turnaround
- ✅ Stable API quota
- ❌ Don't use with iterative mode (use `generate` instead)

**Reference:**
- Qodo Cover: Parallel generation strategy
- AutoTestGen: Batch processing optimization

### Other Commands

**🔄 Iterative Improvement Mode** (DEFAULT):
- **Enabled by default** - no flag needed
- **Quality Standards** (from Meta TestGen-LLM):
  - 75% build success (TypeScript compilation)
  - 57% test pass rate
  - 25% coverage increase
- **Process**:
  1. Generate tests
  2. Check quality (build, tests, coverage)
  3. If not met → Collect feedback → Regenerate
  4. Repeat until: Quality met OR Max iterations (default: 3)
- **Output**: `reports/improvement_report.json`
- **To disable**: Use `--no-iterative` flag

## ⚙️ Configuration

On first run of `ai-test scan`, a config file `ai-test.config.jsonc` is auto-generated with detailed comments.

### Core Configuration

```jsonc
{
  "scoringMode": "layered",  // Scoring mode: layered or legacy
  
  // Coverage configuration
  "coverage": {
    "runBeforeScan": true,  // Auto-run Jest coverage before scan
    "command": "npx jest --coverage --silent",
    "summaryPath": "coverage/coverage-summary.json"
  },
  
  // Coverage scoring mapping
  "coverageScoring": {
    "naScore": 5,  // Default score when coverage data is unavailable
    "mapping": [
      { "lte": 0, "score": 10 },    // 0% coverage → highest priority
      { "lte": 40, "score": 8 },    // 1-40% → high priority
      { "lte": 70, "score": 6 },    // 41-70% → medium priority
      { "lte": 90, "score": 3 },    // 71-90% → low priority
      { "lte": 100, "score": 1 }    // 91-100% → lowest priority
    ]
  },
  
  // Layer configuration
  "layers": {
    "foundation": {
      "name": "Foundation (Utils & Helpers)",
      "patterns": ["**/utils/**", "**/helpers/**", "**/constants/**"],
      "weights": {
        "testability": 0.30,      // Testability weight
        "dependencyCount": 0.25,  // Dependency count weight
        "complexity": 0.15,       // Complexity weight
        "BC": 0.10,              // Business criticality weight
        "ER": 0.10,              // Error risk weight
        "coverage": 0.10          // Coverage weight
      },
      "thresholds": {
        "P0": 8.0,  // Score ≥8.0 = P0 (must test)
        "P1": 6.5,  // Score 6.5-7.9 = P1 (high priority)
        "P2": 5.0   // Score 5.0-6.4 = P2 (medium priority), <5.0 = P3
      }
    }
    // ... other layer configurations
  }
}
```

## 📊 Priority Levels

| Priority | Score Range | Description | Action |
|----------|-------------|-------------|--------|
| **P0** | ≥8.0 | Must test | Generate immediately |
| **P1** | 6.5-7.9 | High priority | Batch generate |
| **P2** | 5.0-6.4 | Medium priority | Generate with review |
| **P3** | <5.0 | Low priority | Optional coverage |

## 🏗️ Layered Architecture

### 1. Foundation Layer
- **Characteristics**: Utility functions, helpers, constants
- **Weights**: High testability weight (30%)
- **Threshold**: P0 ≥ 8.0

### 2. Business Logic Layer
- **Characteristics**: Services, APIs, data processing
- **Weights**: Balanced multi-dimensional scoring
- **Threshold**: P0 ≥ 7.5

### 3. State Management Layer
- **Characteristics**: State stores, contexts, reducers
- **Weights**: Emphasizes error risk
- **Threshold**: P0 ≥ 7.0

### 4. UI Components Layer
- **Characteristics**: React components, views
- **Weights**: Balanced complexity and error risk
- **Threshold**: P0 ≥ 6.5

## 📈 Scoring Metrics Explained

### Coverage Score (CS)

**New Feature**: Integrates code coverage data for both incremental and existing code scenarios.

- **Score Mapping**:
  - 0% → 10 points (highest priority, needs testing urgently)
  - 1-40% → 8 points (high priority)
  - 41-70% → 6 points (medium priority)
  - 71-90% → 3 points (low priority)
  - 91-100% → 1 point (well covered)
  - N/A → 5 points (no data available)

- **Weight**: Configured per layer (typically 10-20%)

### Testability

- **Pure Functions**: 10/10 (no side effects, easy to test)
- **Simple Mocks**: 8-9/10 (dependencies easy to mock)
- **Complex Dependencies**: 4-6/10 (requires complex test setup)

### Dependency Count

Based on reference count:
- **≥10 modules referencing**: 10/10 (core module)
- **5-9 modules**: 10/10
- **3-4 modules**: 9/10
- **1-2 modules**: 7/10
- **No references**: 5/10

### Complexity

- **Cyclomatic Complexity**: 11-15 → 10/10 (medium complexity, worth testing)
- **Cognitive Complexity**: Analyzed via ESLint
- **Nesting Depth**: Adjusts complexity score

### Business Criticality (BC)

Based on Git history:
- Modification frequency
- Number of contributors
- Commit message keywords (fix, bug, hotfix)

### Error Risk (ER)

Based on:
- Error handling code
- Try-catch blocks
- Number of conditional branches

## 🤖 AI Integration

### Using Cursor Agent (Recommended)

```bash
# Auto-generate tests (built-in Cursor Agent integration)
ai-test generate -n 10
```

### Using Other AI Tools (ChatGPT, Claude)

```bash
# 1. Generate AI prompt
ai-test scan
grep "| TODO |" reports/ut_scores.md | head -10

# 2. Manually copy function info to AI tool
# 3. Save AI response to a file
# 4. Run tests for validation
npm test
```

## 🎬 Complete Workflow Example

```bash
# 1. Install Jest (if not already installed)
npm i -D jest@29 ts-jest@29 @types/jest@29 jest-environment-jsdom@29

# 2. Scan code
ai-test scan
# ✅ Auto-generates config file
# ✅ Auto-runs coverage analysis
# ✅ Generates priority report

# 3. View report
cat reports/ut_scores.md

# 4. Generate tests (10 functions)
ai-test generate

# 5. View results
npm test

# 6. Continue with next batch
ai-test generate -n 10

# 7. Repeat until all high-priority tests are complete
```

## 🛠️ Advanced Usage

### Jest Environment Requirements

First-time users need to install Jest:

```bash
npm i -D jest@29 ts-jest@29 @types/jest@29 jest-environment-jsdom@29
```

Then add type support in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "typeRoots": ["node_modules/@types"]
  }
}
```

### Custom Coverage Command

Modify `ai-test.config.jsonc`:

```jsonc
{
  "coverage": {
    "runBeforeScan": true,
    "command": "npm run test:coverage"  // Custom command
  }
}
```

### Skip Git Analysis

If project has no Git history or Git signals are not needed:

```bash
ai-test scan --skip-git
```

## 📚 Inspiration

This project draws inspiration from research and practices:

- **Meta TestGen-LLM**: Quality assurance filters and at-scale practices  
  [Automated Unit Test Improvement using Large Language Models at Meta](https://arxiv.org/abs/2402.09171)

- **ByteDance Midscene.js**: Natural language interface and stability practices  
  https://github.com/web-infra-dev/midscene

- **Airbnb**: Large-scale LLM-assisted migration and batching  
  https://medium.com/airbnb-engineering/accelerating-large-scale-test-migration-with-llms-9565c208023b

- **TestART**: Iterative generation and template repair  
  https://arxiv.org/abs/2408.03095

These ideas are reflected in `ai-unit-test-generator` as:
- Strict output protocol (JSON manifest + code blocks)
- Failure feedback loop (Jest JSON → actionable hints → next prompt)
- Batch processing with progress tracking (TODO/DONE/SKIP)
- Coverage-aware prioritization

## 🔧 Project Structure

```
ai-unit-test-generator/
├── bin/
│   └── cli.js                    # CLI entry point
├── lib/
│   ├── core/                     # 核心分析层（无 AI 依赖）
│   │   ├── scanner.mjs          # AST 扫描 + 元数据提取
│   │   ├── git-analyzer.mjs     # Git 历史分析
│   │   ├── scorer.mjs           # 评分引擎 + AI 增强
│   │   └── index.mjs            # 模块导出
│   ├── ai/                       # AI 交互层
│   │   ├── sampler.mjs          # 智能代码采样
│   │   ├── context-builder.mjs  # 项目上下文构建
│   │   ├── analyzer-prompt.mjs  # AI 分析 Prompt
│   │   ├── validator.mjs        # 响应验证
│   │   ├── reviewer.mjs         # 交互式审核 UI
│   │   ├── config-writer.mjs    # 安全配置写入
│   │   ├── prompt-builder.mjs   # 测试生成 Prompt
│   │   ├── client.mjs           # Cursor Agent 调用
│   │   ├── extractor.mjs        # 测试提取
│   │   └── index.mjs            # 模块导出
│   ├── testing/                  # 测试执行层
│   │   ├── runner.mjs           # Jest 运行器
│   │   ├── analyzer.mjs         # 失败分析
│   │   ├── coverage-runner.mjs  # 覆盖率分析
│   │   └── index.mjs            # 模块导出
│   ├── workflows/                # 工作流编排层
│   │   ├── init.mjs             # 初始化工作流
│   │   ├── analyze.mjs          # AI 分析工作流
│   │   ├── scan.mjs             # 扫描工作流
│   │   ├── generate.mjs         # 生成工作流
│   │   ├── batch.mjs            # 批处理
│   │   ├── all.mjs              # 全自动
│   │   └── index.mjs            # 模块导出
│   ├── utils/                    # 工具层
│   │   ├── config-manager.mjs   # 配置管理
│   │   ├── scan-manager.mjs     # 扫描管理
│   │   ├── marker.mjs           # 状态标记
│   │   └── index.mjs            # 模块导出
│   └── index.mjs                 # 根导出
└── templates/
    └── default.config.jsonc      # 默认配置模板
```

### Architecture Principles

- **Layered Design**: Clear separation between core analysis, AI interaction, testing, and workflows
- **Zero AI Dependency in Core**: Core modules can be used without AI features
- **Modular Exports**: Each layer has clean API exports
- **Programmatic API**: All workflows can be imported and used programmatically

## 🏗️ Project Architecture (v3.0+)

### TypeScript Migration

Starting from v3.0.0, the project has been fully migrated to TypeScript:

```
src/
├── shared/          ✨ Shared utilities layer (NEW in v3.0.1)
│   ├── cli-utils.ts    - CLI parsing, messages
│   ├── file-utils.ts   - File I/O, JSONC support
│   ├── process-utils.ts - Commands, packages
│   └── path-utils.ts   - Paths, glob matching
├── types/           📘 Type definitions (5 modules)
│   ├── index.ts        - Core types
│   ├── cli.ts          - CLI options
│   ├── coverage.ts     - Coverage data
│   ├── quality.ts      - Quality metrics
│   └── parallel.ts     - Parallel config
├── core/            🧠 Analysis engine
├── ai/              🤖 AI interaction
├── testing/         ✅ Test execution
├── workflows/       🔄 Orchestration
└── cli.ts           🎯 CLI entry
```

### Key Improvements

- **Type Coverage**: 39% fully typed (growing)
- **Code Quality**: 85%+ duplicate code eliminated
- **Architecture**: Shared utilities layer for consistency
- **Documentation**: See [TYPESCRIPT_MIGRATION.md](./TYPESCRIPT_MIGRATION.md) and [STRUCTURE_OPTIMIZATION.md](./STRUCTURE_OPTIMIZATION.md)

## 🤝 Contributing

Contributions are welcome! Please submit issues or pull requests.

## 📄 License

MIT © YuhengZhou

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/ai-unit-test-generator)
- [Technical Documentation](./tech_doc.md)
- [Changelog](./CHANGELOG.md)

## 💬 Support

Need help? Get support through:

- Read [Technical Documentation](./tech_doc.md)
- Check [Changelog](./CHANGELOG.md)
- Submit [GitHub Issues](https://github.com/temptrip/ai-unit-test-generator/issues)

---

**Tip**: For first-time users, it's recommended to test on a small project first to familiarize yourself with the workflow before applying to larger projects.
