# 🚀 项目优化执行计划

**日期**: 2025-10-13  
**任务**: A (移除 @ts-nocheck) + D (优化 scorer.ts) + F (性能优化)  
**预计时间**: 6-8 小时

---

## 📦 任务 D: 优化 scorer.ts (827行)

### 现状分析
- **文件大小**: 827 行代码
- **函数数量**: 34 个函数
- **问题**: 
  - 单文件过大，难以维护
  - 包含 `@ts-nocheck`，类型不安全
  - 职责混杂（评分、格式化、依赖分析等）

### 拆分方案

#### 新目录结构: `src/core/scoring/`
```
src/core/scoring/
├── index.ts                 # 主入口和 CLI (保留)
├── types.ts                 # 类型定义 (新增)
├── utils.ts                 # 工具函数 (新增)
├── config-loader.ts         # 配置加载器 (新增)
├── metrics/                 # 指标计算模块 (新增)
│   ├── index.ts
│   ├── business-criticality.ts  # BC 计算
│   ├── code-complexity.ts       # CC 计算
│   ├── error-risk.ts            # ER 计算
│   ├── roi.ts                   # ROI 计算
│   ├── testability.ts           # 可测试性计算
│   └── coverage.ts              # 覆盖率计算
├── calculator.ts            # 主评分计算器 (新增)
├── dependency-graph.ts      # 依赖图构建 (新增)
└── formatters/              # 输出格式化 (新增)
    ├── index.ts
    ├── markdown.ts          # Markdown 格式
    └── csv.ts               # CSV 格式
```

### 函数分配

#### 1. types.ts (类型定义)
```typescript
export interface ScoringConfig { ... }
export interface ScoringMetrics { ... }
export interface ScoredTarget { ... }
export interface LayerConfig { ... }
export interface DependencyGraph { ... }
```

#### 2. utils.ts (6个工具函数)
- `toFixedDown(num, digits)` - 向下取整
- `clamp(n, min, max)` - 数值限制
- `matchPattern(filePath, pattern)` - 模式匹配
- `stripJsonComments(s)` - 移除 JSON 注释
- `matchLayerByPath(filePath, cfg)` - 层级匹配
- `matchLayer(target, cfg)` - 层级匹配主函数

#### 3. config-loader.ts (3个函数)
- `loadConfig(pathFromArg)` - 加载配置
- `pickWeight(cfg, key, def)` - 获取权重
- `pickThreshold(cfg, key, def)` - 获取阈值

#### 4. metrics/business-criticality.ts
- `mapBCByConfig({ name, path, impactHint }, cfg, overrides)` - BC 计算
- `isMainChain(path, cfg)` - 主链路判断

#### 5. metrics/code-complexity.ts
- `mapCCFromMetrics(metrics, cfg, eslintCognitive, target, overrides)` - CC 计算
- `loadESLintCognitive(eslintJsonPath)` - ESLint 认知复杂度加载

#### 6. metrics/error-risk.ts
- `mapERFromGitAndImpactConfig(git, impactHint, depGraphData, cfg, ...)` - ER 计算
- `mapLikelihoodFromGitByConfig(git, depGraphData, cfg)` - 可能性计算
- `mapImpactFromHintByConfig(hint, cfg, localMap)` - 影响计算

#### 7. metrics/roi.ts
- `mapROIByConfig(hint, cfg, localMap, overrides, target)` - ROI 计算

#### 8. metrics/testability.ts
- `mapTestabilityByConfig(hint, cfg, localMap, overrides, target)` - 可测试性计算
- `mapDependencyCount(depGraphData, cfg)` - 依赖计数

#### 9. metrics/coverage.ts
- `mapCoverageScore(pct, cfg)` - 覆盖率评分

#### 10. calculator.ts (3个核心函数)
- `computeScoreLegacy({ BC, CC, ER, ROI, coverageScore }, cfg)` - 传统评分
- `computeScoreLayered({ BC, CC, ER, testability, ... }, target, cfg)` - 分层评分
- `computeScore(metrics, target, cfg)` - 主评分函数
- `pickMetricsForTarget(provider, target)` - 获取目标指标

#### 11. dependency-graph.ts
- `buildDepGraph(project, cfg)` - 构建依赖图

#### 12. formatters/markdown.ts
- `defaultMd(rows, statusMap)` - Markdown 格式化
- `readExistingStatus(mdPath)` - 读取现有状态

#### 13. formatters/csv.ts
- `defaultCsv(rows)` - CSV 格式化

#### 14. index.ts (主入口)
- 保留主函数和 CLI 逻辑
- 导入并组合各个模块

---

## 🔧 任务 A: 移除 @ts-nocheck (14个文件)

### 文件清单

#### Workflows 模块 (4个文件)
1. `workflows/analyze.ts`
2. `workflows/parallel-generate.ts`
3. `workflows/iterative-improve.ts`
4. `workflows/batch.ts`

#### AI 模块 (5个文件)
5. `ai/analyzer-prompt.ts` ✅ (已完成)
6. `ai/sampler.ts`
7. `ai/reviewer.ts` ✅ (已完成)
8. `ai/extractor.ts`
9. `ai/client.ts`

#### Core 模块 (1个文件)
10. `core/scorer.ts` → 通过拆分解决

**剩余**: 8 个文件需要移除 @ts-nocheck

### 执行策略
1. **Phase 1**: Workflows 模块 (4个文件)
   - 添加必要的类型定义
   - 使用 `as any` 临时绕过复杂类型
   - 确保编译通过

2. **Phase 2**: AI 模块剩余文件 (3个文件)
   - sampler.ts
   - extractor.ts
   - client.ts

3. **Phase 3**: 全面验证
   - 运行 `npx tsc --noEmit`
   - 确保零错误

---

## ⚡ 任务 F: 性能优化

### F1: 添加性能监控工具

#### 创建 `src/utils/performance.ts`
```typescript
export class PerformanceMonitor {
  private marks: Map<string, number>
  
  start(label: string): void
  end(label: string): number
  measure(label: string, fn: () => any): any
  report(): PerformanceReport
}

export function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T>

export function measureSync<T>(
  label: string,
  fn: () => T
): T
```

### F2: 识别性能瓶颈

#### 关键优化点
1. **文件扫描优化**
   - 并行扫描文件
   - 缓存文件解析结果
   - 使用流式处理大文件

2. **依赖图构建优化**
   - 增量更新依赖图
   - 缓存已分析的模块
   - 使用并发处理

3. **AI 调用优化**
   - 批量处理 AI 请求
   - 添加请求缓存
   - 实现请求去重

4. **代码分析优化**
   - 使用 Worker 线程
   - 缓存 AST 解析结果
   - 懒加载非必要模块

### F3: 创建性能基准测试

#### 创建 `benchmarks/` 目录
```
benchmarks/
├── scanner.bench.ts         # 扫描器基准测试
├── scorer.bench.ts          # 评分器基准测试
├── ai-client.bench.ts       # AI 客户端基准测试
├── dependency-graph.bench.ts # 依赖图基准测试
└── full-workflow.bench.ts   # 完整流程基准测试
```

#### 基准指标
- **扫描速度**: 文件数/秒
- **评分速度**: 目标数/秒
- **内存使用**: 峰值内存占用
- **AI 调用**: 响应时间和成功率

---

## 📊 执行顺序

### Stage 1: scorer.ts 拆分 (2-3小时)
1. ✅ 分析文件结构
2. ⏳ 创建新目录和类型定义
3. ⏳ 逐步拆分函数到新模块
4. ⏳ 更新导入路径
5. ⏳ 测试编译和功能

### Stage 2: 移除 @ts-nocheck (2-3小时)
1. ⏳ Workflows 模块 (4个文件)
2. ⏳ AI 模块 (3个文件)
3. ⏳ 验证编译

### Stage 3: 性能优化 (2-3小时)
1. ⏳ 添加性能监控工具
2. ⏳ 识别并优化瓶颈
3. ⏳ 创建基准测试

---

## 🎯 预期成果

### 类型安全
- 类型覆盖率: 92% → 98%+
- @ts-nocheck 文件: 14 → 0
- TypeScript 错误: 0

### 代码质量
- 最大文件行数: 827 → < 200
- 模块化程度: 中 → 高
- 可维护性指数: 85 → 90+

### 性能
- 扫描速度: 提升 20-30%
- 内存使用: 降低 15-20%
- 关键路径优化: 3-5 处

### 文档
- 拆分方案文档 ✅
- 性能优化报告
- 基准测试结果

---

## ⚠️ 风险和注意事项

### 高风险
1. **scorer.ts 拆分** - 可能破坏现有功能
   - 缓解: 保留原文件备份，逐步迁移，充分测试

2. **类型定义复杂** - 某些类型难以准确定义
   - 缓解: 先使用宽松类型，后续逐步精化

### 中风险
1. **性能优化反效果** - 某些优化可能引入新问题
   - 缓解: 建立基准测试，对比前后性能

2. **并发问题** - 并行处理可能引入竞态条件
   - 缓解: 仔细设计并发策略，添加同步机制

---

## 📝 备注

- 所有更改将分阶段提交到 Git
- 每个 stage 完成后进行验证
- 保持向后兼容性
- 及时更新文档

**开始时间**: 2025-10-13  
**负责人**: AI Assistant  
**状态**: ✅ 计划已制定，等待执行

---

**下一步**: 开始执行 Stage 1 - scorer.ts 拆分

