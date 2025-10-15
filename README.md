# AI Test Generator v3.1.0

> 🤖 AI驱动的单元测试生成器，具有智能优先级评分和代码质量验证

[![npm version](https://img.shields.io/npm/v/ai-unit-test-generator.svg)](https://www.npmjs.com/package/ai-unit-test-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 核心特性

### 基础功能
- **🏗️ 分层架构评分**: 根据代码层级（Foundation, Business, State, UI）智能评分
- **🤖 AI Native 设计**: 完美集成 Cursor Agent、ChatGPT、Claude 等 AI工具
- **📊 覆盖率感知**: 集成代码覆盖率数据进行智能优先级排序
- **🎨 多维度评分**: 结合可测试性、复杂度、依赖数量、业务关键度、错误风险
- **⚡ 批量生成**: 自动化批量测试生成，支持失败重试和进度追踪
- **📝 丰富的报告**: 生成 Markdown 和 CSV 格式的详细评分报告

### v3.1.0 新特性 🆕

#### 1️⃣ Best Practices 生成（Qodo 风格）
- **自动分析项目**: 检测测试框架、文件模式、现有测试
- **AI 生成规范**: 根据项目特点生成测试标准
- **双模式支持**: 独立 Markdown 文件或内联配置

#### 2️⃣ 实时代码验证（Qodo 风格）
- **自动验证**: 生成的测试代码立即验证（编译+运行）
- **智能重试**: 失败时自动重试并提供反馈（默认3次）
- **质量保证**: 确保生成的测试可以实际运行

#### 3️⃣ 测试去重（Keploy 风格）
- **相似度检测**: 使用 Levenshtein 距离算法检测重复测试
- **智能分析**: 识别85%以上相似度的测试用例
- **自动清理**: 支持自动删除重复测试

#### 4️⃣ 覆盖率驱动迭代（Keploy 风格）
- **动态迭代**: 根据实际覆盖率持续生成，而非固定次数
- **智能反馈**: 分析覆盖率差距，提供针对性改进建议
- **目标驱动**: 迭代直到达到覆盖率目标

### 架构优化（v3.0+）
- **✅ 100% TypeScript**: 完全迁移到 TypeScript，零编译错误
- **🎯 模块化设计**: 清晰的模块边界和导出
- **📦 Shared 工具层**: 统一的工具函数库
- **🔧 易于维护**: 代码重复率降低85%+

---

## 📦 安装

### 全局安装（推荐）

```bash
npm install -g ai-unit-test-generator
```

### 项目安装

```bash
npm install --save-dev ai-unit-test-generator
```

---

## 🚀 快速开始

### 1. 初始化配置

```bash
ai-test init
```

这将在当前目录创建 `ai-test.config.jsonc` 配置文件，包含详细的注释说明。

### 2. (可选) 生成测试规范

```bash
# 生成独立的 best_practices.md 文件
ai-test init-best-practices

# 或者生成内联配置（嵌入到 ai-test.config.jsonc）
ai-test init-best-practices --inline
```

**这将：**
- 分析项目结构和 package.json
- 检测测试框架（Jest/Vitest/Mocha）
- 提取现有测试模式
- 使用 AI 生成项目特定的测试标准

### 3. 扫描代码并评分

```bash
ai-test scan
```

**执行流程：**
1. 分析代码结构，识别可测试的目标
2. (可选) 自动运行 Jest 覆盖率分析
3. 分析 Git 历史获取错误信号
4. 计算多维度优先级评分
5. 生成排序报告 (`reports/ut_scores.md`)

**示例输出：**

```markdown
| Status | Score | Priority | Name | Type | Layer | Path | Coverage | Testability | Complexity |
|--------|-------|----------|------|------|-------|------|----------|-------------|------------|
| TODO | 8.5 | P0 | validatePayment | function | Business | src/services/payment.ts | 0.0% | 9 | 10 |
| TODO | 7.8 | P0 | formatCurrency | function | Foundation | src/utils/format.ts | 15.0% | 10 | 8 |
```

### 4. 生成测试

```bash
# 生成前10个最高优先级的函数测试（带自动改进）
ai-test generate

# 生成前20个函数的测试
ai-test generate -n 20

# 只生成 P0 优先级的测试
ai-test generate -p P0

# 生成所有 TODO 函数的测试
ai-test generate --all

# 禁用自动改进（单次生成模式）
ai-test generate --no-iterative
```

**执行流程：**
1. 从报告中选择最高优先级的未测试函数
2. 调用 Cursor Agent 自动生成测试
3. 提取并保存测试文件
4. 运行 Jest 验证测试
5. **🔄 检查质量并自动改进**（默认启用）
6. 自动更新报告状态为 DONE

### 5. 查看进度

```bash
# 查看完整报告
cat reports/ut_scores.md

# 查看 P0 优先级任务
grep "| P0 |" reports/ut_scores.md

# 查看待处理任务
grep "| TODO |" reports/ut_scores.md
```

---

## 📖 命令详解

### `ai-test init`

初始化配置文件

```bash
ai-test init [options]

Options:
  -c, --config <path>   Config file path (default: ai-test.config.jsonc)
```

### `ai-test init-best-practices` 🆕

生成项目特定的测试规范

```bash
ai-test init-best-practices [options]

Options:
  --inline              Generate inline config instead of separate file
  -c, --config <path>   Config file path (default: ai-test.config.jsonc)
```

**两种模式：**
- **文件模式**（默认）: 生成 `best_practices.md`
- **内联模式**（`--inline`）: 嵌入到 `ai-test.config.jsonc`

### `ai-test scan`

扫描代码并生成优先级报告

```bash
ai-test scan [options]

Options:
  -c, --config <path>   Config file path (default: ai-test.config.jsonc)
  -o, --output <dir>    Output directory (default: reports)
  --skip-git            Skip Git history analysis
```

**输出文件：**
- `reports/targets.json` - 扫描的目标列表
- `reports/git_signals.json` - Git 分析数据
- `reports/ut_scores.md` - Markdown 格式报告（按评分排序）
- `reports/ut_scores.csv` - CSV 格式报告

### `ai-test generate`

生成单元测试（使用 Cursor Agent）

```bash
ai-test generate [options]

Options:
  -n, --count <number>           Number of functions to generate (default: 10)
  -p, --priority <level>         Priority filter (P0, P1, P2, P3)
  --all                          Generate all remaining TODO functions
  --no-iterative                 Disable iterative improvement (default: enabled)
  --max-iterations <number>      Maximum iterations for iterative mode (default: 3)
  --report <path>                Report file path (default: reports/ut_scores.md)
```

**示例：**
```bash
ai-test generate                 # 生成前10个，带自动改进
ai-test generate -n 20           # 生成前20个
ai-test generate -p P0           # 只生成 P0 优先级
ai-test generate --all           # 生成所有 TODO 函数
ai-test generate --no-iterative  # 禁用自动改进
```

---

## ⚙️ 配置文件

首次运行 `ai-test scan` 时，会自动生成包含详细注释的配置文件 `ai-test.config.jsonc`。

### 核心配置

```jsonc
{
  "version": "3.1.0",
  "scoringMode": "layered",  // 评分模式: layered 或 legacy
  
  // 覆盖率配置
  "coverage": {
    "runBeforeScan": true,  // 扫描前自动运行覆盖率分析
    "command": "npx jest --coverage --silent"
  },
  
  // 覆盖率评分映射
  "coverageScoring": {
    "naScore": 5,  // 无覆盖率数据时的默认分数
    "mapping": [
      { "lte": 0, "score": 10 },    // 0% 覆盖率 → 最高优先级
      { "lte": 40, "score": 8 },    // 1-40% → 高优先级
      { "lte": 70, "score": 6 },    // 41-70% → 中等优先级
      { "lte": 90, "score": 3 },    // 71-90% → 低优先级
      { "lte": 100, "score": 1 }    // 91-100% → 最低优先级
    ]
  },
  
  // v3.1.0 新增配置
  "bestPractices": {
    "enabled": false,
    "source": "file",  // "file" 或 "inline"
    "filePath": "./best_practices.md"
  },
  
  "validation": {
    "enabled": false,
    "maxAttempts": 3,
    "timeout": 30000
  },
  
  "coverageDriven": {
    "enabled": false,
    "targetCoverage": 80,
    "maxIterations": 5
  },
  
  "deduplication": {
    "enabled": false,
    "similarityThreshold": 0.85
  }
}
```

### 分层配置

```jsonc
{
  "layers": {
    "foundation": {
      "name": "Foundation (基础工具层)",
      "patterns": ["**/utils/**", "**/helpers/**", "**/constants/**"],
      "weights": {
        "testability": 0.45,      // 可测试性权重
        "dependencyCount": 0.25,  // 依赖数量权重
        "complexity": 0.20,       // 复杂度权重
        "coverage": 0.10          // 覆盖率权重
      },
      "thresholds": {
        "P0": 8.0,  // 分数 ≥8.0 = P0 (必须测试)
        "P1": 6.5,  // 分数 6.5-7.9 = P1 (高优先级)
        "P2": 5.0   // 分数 5.0-6.4 = P2 (中等优先级), <5.0 = P3
      },
      "coverageTarget": 100  // 目标覆盖率 100%
    }
    // ... 其他层级配置
  }
}
```

---

## 📊 优先级说明

| 优先级 | 分数范围 | 描述 | 建议操作 |
|--------|----------|------|----------|
| **P0** | ≥8.0 | 必须测试 | 立即生成 |
| **P1** | 6.5-7.9 | 高优先级 | 批量生成 |
| **P2** | 5.0-6.4 | 中等优先级 | 审查后生成 |
| **P3** | <5.0 | 低优先级 | 可选覆盖 |

---

## 🏗️ 分层架构

### 1. Foundation Layer（基础层）
- **特征**: 工具函数、助手函数、常量
- **权重**: 高可测试性权重 (45%)
- **阈值**: P0 ≥ 8.0
- **目标覆盖率**: 100%

### 2. Business Logic Layer（业务逻辑层）
- **特征**: 服务、API、数据处理
- **权重**: 平衡的多维度评分
- **阈值**: P0 ≥ 7.5
- **目标覆盖率**: 80%

### 3. State Management Layer（状态管理层）
- **特征**: 状态存储、上下文、Reducers
- **权重**: 强调错误风险
- **阈值**: P0 ≥ 7.0
- **目标覆盖率**: 70%

### 4. UI Components Layer（UI 组件层）
- **特征**: React 组件、视图
- **权重**: 平衡复杂度和错误风险
- **阈值**: P0 ≥ 6.5
- **目标覆盖率**: 60%

---

## 📈 评分指标说明

### Coverage Score（覆盖率评分）

**新特性**: 集成代码覆盖率数据，适用于增量和现有代码场景

- **评分映射**:
  - 0% → 10分（最高优先级，急需测试）
  - 1-40% → 8分（高优先级）
  - 41-70% → 6分（中等优先级）
  - 71-90% → 3分（低优先级）
  - 91-100% → 1分（已充分覆盖）
  - N/A → 5分（无数据）

### Testability（可测试性）

- **纯函数**: 10/10（无副作用，易于测试）
- **简单 Mock**: 8-9/10（依赖易于 Mock）
- **复杂依赖**: 4-6/10（需要复杂的测试设置）

### Dependency Count（依赖数量）

基于引用计数：
- **≥10 个模块引用**: 10/10（核心模块）
- **5-9 个模块**: 10/10
- **3-4 个模块**: 9/10
- **1-2 个模块**: 7/10
- **无引用**: 5/10

### Complexity（复杂度）

- **圈复杂度**: 11-15 → 10/10（中等复杂度，值得测试）
- **认知复杂度**: 通过 ESLint 分析
- **嵌套深度**: 调整复杂度分数

---

## 🤖 AI 集成

### 使用 Cursor Agent（推荐）

```bash
# 自动生成测试（内置 Cursor Agent 集成）
ai-test generate -n 10
```

### 使用其他 AI 工具（ChatGPT、Claude）

```bash
# 1. 生成 AI prompt
ai-test scan
grep "| TODO |" reports/ut_scores.md | head -10

# 2. 手动复制函数信息到 AI 工具
# 3. 保存 AI 响应到文件
# 4. 运行测试验证
npm test
```

---

## 🎬 完整工作流示例

```bash
# 1. 安装 Jest（如果尚未安装）
npm i -D jest@29 ts-jest@29 @types/jest@29 jest-environment-jsdom@29

# 2. 初始化配置
ai-test init

# 3. (可选) 生成测试规范
ai-test init-best-practices

# 4. 扫描代码
ai-test scan
# ✅ 自动生成配置文件
# ✅ 自动运行覆盖率分析
# ✅ 生成优先级报告

# 5. 查看报告
cat reports/ut_scores.md

# 6. 生成测试（10个函数）
ai-test generate

# 7. 查看结果
npm test

# 8. 继续下一批
ai-test generate -n 10

# 9. 重复直到所有高优先级测试完成
```

---

## 🛠️ 高级用法

### Jest 环境要求

首次使用需要安装 Jest：

```bash
npm i -D jest@29 ts-jest@29 @types/jest@29 jest-environment-jsdom@29
```

然后在 `tsconfig.json` 中添加类型支持：

```json
{
  "compilerOptions": {
    "typeRoots": ["node_modules/@types"]
  }
}
```

### 自定义覆盖率命令

修改 `ai-test.config.jsonc`：

```jsonc
{
  "coverage": {
    "runBeforeScan": true,
    "command": "npm run test:coverage"  // 自定义命令
  }
}
```

### 跳过 Git 分析

如果项目没有 Git 历史或不需要 Git 信号：

```bash
ai-test scan --skip-git
```

---

## 🔧 项目结构

```
ai-test-generator/
├── src/                         # TypeScript 源代码
│   ├── cli.ts                  # CLI 入口
│   ├── types/                  # 类型定义 (5 模块)
│   ├── shared/                 # 共享工具层 (4 模块)
│   ├── core/                   # 核心分析引擎
│   │   ├── scanner.ts         # AST 扫描
│   │   ├── git-analyzer.ts    # Git 历史分析
│   │   ├── scoring/           # 评分系统
│   │   ├── mock/              # Mock 分析 (v3.1.0: 简化版)
│   │   └── behavior/          # 行为分类
│   ├── ai/                     # AI 交互层
│   │   ├── prompt-builder.ts  # Prompt 构建
│   │   ├── client.ts          # Cursor Agent 调用
│   │   ├── extractor.ts       # 测试提取
│   │   └── ...
│   ├── testing/                # 测试执行层
│   │   ├── runner.ts          # Jest 运行器
│   │   ├── validator.ts       # 🆕 v3.1.0: 测试验证器
│   │   ├── deduplicator.ts    # 🆕 v3.1.0: 测试去重
│   │   └── ...
│   ├── workflows/              # 工作流编排层
│   │   ├── init.ts            # 初始化
│   │   ├── scan.ts            # 扫描
│   │   ├── generate.ts        # 生成
│   │   ├── init-best-practices.ts  # 🆕 v3.1.0: Best Practices
│   │   ├── generate-with-validation.ts  # 🆕 v3.1.0: 带验证的生成
│   │   ├── coverage-driven-generate.ts  # 🆕 v3.1.0: 覆盖率驱动
│   │   └── ...
│   └── utils/                  # 工具层
│       ├── config-manager.ts  # 配置管理
│       └── ...
├── dist/                        # 编译后的代码
├── templates/                   # 配置模板
│   ├── default.config.jsonc    # 默认配置
│   └── jest.config.cobertura.js
└── package.json
```

### 架构原则

- **分层设计**: 核心分析、AI 交互、测试、工作流之间清晰分离
- **核心零 AI 依赖**: 核心模块可在无 AI 的情况下使用
- **模块化导出**: 每一层都有清晰的 API 导出
- **可编程 API**: 所有工作流都可以导入并编程使用

---

## 🎯 v3.1.0 更新内容

### 移除的功能
- ❌ **Boundary Detection**（边界检测）- 过度设计，已移除 (-583行)
- ❌ **Mock 代码示例生成** - 限制AI自由度，已简化 (-320行)

### 新增的功能
- ✅ **Best Practices 生成** - AI理解项目风格
- ✅ **实时代码验证** - 确保生成代码可运行
- ✅ **测试去重** - 提高测试质量
- ✅ **覆盖率驱动** - 智能迭代

### 设计理念变化

**移除理由**:
1. **静态分析的局限**: 无法理解业务逻辑
2. **过度指导**: 限制 AI 的创造力
3. **技术栈假设**: 不应该假设用户使用什么库
4. **代码膨胀**: 维护成本高，实际价值低

**新增理由**:
1. **实际价值**: 解决真实痛点
2. **业界验证**: Qodo、Keploy 已证明有效
3. **AI Native**: 充分发挥 AI 能力
4. **用户需求**: 可选启用，不强制

---

## 📚 灵感来源

本项目从以下研究和实践中汲取灵感：

- **Meta TestGen-LLM**: 质量保证过滤器和大规模实践  
  [Automated Unit Test Improvement using Large Language Models at Meta](https://arxiv.org/abs/2402.09171)

- **Qodo Cover**: Best Practices、实时验证  
  https://www.qodo.ai/

- **Keploy**: 测试去重、覆盖率驱动  
  https://keploy.io/

- **ByteDance Midscene.js**: 自然语言接口和稳定性实践  
  https://github.com/web-infra-dev/midscene

这些理念在 `ai-test-generator` 中体现为：
- 严格的输出协议（JSON manifest + 代码块）
- 失败反馈循环（Jest JSON → 可操作提示 → 下一个 prompt）
- 批处理与进度追踪（TODO/DONE/SKIP）
- 覆盖率感知优先级

---

## 🤝 贡献

欢迎贡献！请提交问题或拉取请求。

---

## 📄 许可证

MIT © YuhengZhou

---

## 🔗 链接

- [npm 包](https://www.npmjs.com/package/ai-unit-test-generator)
- [更新日志](./CHANGELOG.md)
- [GitHub](https://github.com/YuhengZhou/ai-unit-test-generator)

---

## 💬 支持

需要帮助？通过以下方式获取支持：

- 查看 [更新日志](./CHANGELOG.md)
- 提交 [GitHub Issues](https://github.com/YuhengZhou/ai-unit-test-generator/issues)

---

**提示**: 首次使用建议先在小项目上测试，熟悉工作流后再应用到大项目。
