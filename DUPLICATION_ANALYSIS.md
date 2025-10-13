# 代码重复分析报告

## 🔍 发现的重复模式

### 1. 子进程执行模式 (10个文件)
**文件**: workflows/batch.ts, workflows/analyze.ts, workflows/iterative-improve.ts, workflows/parallel-generate.ts, workflows/scan.ts, workflows/all.ts, workflows/generate.ts, testing/stability-checker.ts, testing/runner.ts, ai/client.ts

**重复代码**:
```typescript
function sh(cmd: string, args: string[], options: ShellOptions = {}): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const stdio: StdioOptions = options.captureStdout ? ['inherit', 'pipe', 'inherit'] : 'inherit'
    const child: ChildProcess = spawn(cmd, args, {
      stdio,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    })

    const chunks: Buffer[] = []
    if (options.captureStdout && child.stdout) {
      child.stdout.on('data', (d: Buffer) => chunks.push(d))
    }

    child.on('close', code => {
      if (code === 0) {
        const output = options.captureStdout ? Buffer.concat(chunks).toString('utf8') : null
        resolve(output)
      } else {
        reject(new Error(`${cmd} exited ${code}`))
      }
    })
    child.on('error', reject)
  })
}
```

**影响**: 每个workflows文件都有几乎相同的sh函数实现（150-200行重复代码）

### 2. CLI参数解析模式 (18个文件)
**重复代码**:
```typescript
function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a && a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split('=') : [a, argv[i + 1]]
      if (k) {
        args[k.replace(/^--/, '')] = v === undefined || (v && v.startsWith('--')) ? true : v
      }
      if (v !== undefined && v && !v.startsWith('--') && !a.includes('=')) i++
    }
  }
  return args
}
```

**影响**: 虽然已有shared/cli-utils.ts的parseArgs，但仍有多个文件自己实现了解析逻辑

### 3. ts-morph AST操作模式 (3个文件)
**文件**: core/scanner.ts, core/scoring/index.ts

**重复代码**:
```typescript
// 重复模式1: 创建Project和加载文件
const { Project, SyntaxKind } = await requirePackage<typeof import('ts-morph')>('ts-morph', 'ts-morph')
const project = new Project({ skipAddingFilesFromTsConfig: true })
files.forEach(f => project.addSourceFileAtPathIfExists(f))

// 重复模式2: 获取函数或变量
let node: FunctionDeclaration | ArrowFunction | FunctionExpression | undefined = sf.getFunction(t.name)
if (!node) {
  const v = sf.getVariableDeclaration(t.name)
  const init = v?.getInitializer()
  if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
    node = init as ArrowFunction | FunctionExpression
  }
}
```

### 4. 类型守卫模式 (多个文件)
**重复代码**:
```typescript
// 检查是否为测试文件变量
function isTestableVariable(v: VariableDeclaration): boolean {
  const init = v.getInitializer()
  if (!init) return false
  const kind = init.getKind()
  if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) return true
  if (kind === SyntaxKind.CallExpression) {
    const text = init.getText()
    return /(React\.memo|forwardRef|memo|observer)\(/.test(text)
  }
  return false
}

// 类似的守卫在多个文件中重复
```

### 5. Promise包装模式 (9个文件)
**重复代码**:
```typescript
await new Promise<void>((resolve) => {
  const child: ChildProcess = spawnLocal('node', [join(pkgRoot, 'lib/testing/analyzer.mjs')], { 
    stdio: ['inherit','pipe','inherit'] 
  })
  const chunks: Buffer[] = []
  if (child.stdout) {
    child.stdout.on('data', (d: Buffer) => chunks.push(d))
  }
  child.on('close', () => { /* ... */ resolve() })
  child.on('error', () => resolve())
})
```

## 📊 重复度量

| 模式类型 | 文件数量 | 估计重复行数 | 优先级 |
|---------|---------|-------------|--------|
| 子进程执行 | 10 | ~1500 | P0 |
| CLI参数解析 | 18 | ~300 | P1 |
| ts-morph操作 | 3 | ~200 | P1 |
| 类型守卫 | 5+ | ~100 | P2 |
| Promise包装 | 9 | ~400 | P1 |

**总计**: ~2500行重复代码

## 🎯 消除方案

### 方案1: 创建 shared/process-utils.ts (扩展)
```typescript
/**
 * 执行shell命令（统一接口）
 */
export async function executeCommand(
  cmd: string, 
  args: string[], 
  options?: ShellOptions
): Promise<string | null>

/**
 * 执行并捕获输出
 */
export async function captureOutput(
  cmd: string, 
  args: string[]
): Promise<string>

/**
 * 执行并忽略错误
 */
export async function tryExecute(
  cmd: string, 
  args: string[]
): Promise<boolean>
```

### 方案2: 创建 shared/ts-morph-utils.ts
```typescript
/**
 * 创建ts-morph项目并加载文件
 */
export async function createProject(files: string[]): Promise<Project>

/**
 * 获取函数或变量节点（统一查找）
 */
export function getFunctionOrVariable(
  sf: SourceFile, 
  name: string
): FunctionDeclaration | ArrowFunction | FunctionExpression | VariableDeclaration | undefined

/**
 * 检查是否为可测试的变量
 */
export function isTestableVariable(v: VariableDeclaration): boolean
```

### 方案3: 创建 shared/type-guards.ts
```typescript
/**
 * 类型守卫：检查是否为函数节点
 */
export function isFunctionNode(node: Node): node is FunctionDeclaration | ArrowFunction | FunctionExpression

/**
 * 类型守卫：检查是否有特定方法
 */
export function hasMethod<T, K extends string>(
  obj: T, 
  method: K
): obj is T & Record<K, Function>
```

## ✅ 执行计划

1. **阶段1**: 提取子进程执行工具（影响最大）
   - 扩展 `shared/process-utils.ts`
   - 重构所有workflows和testing文件

2. **阶段2**: 提取ts-morph工具
   - 创建 `shared/ts-morph-utils.ts`
   - 重构core/scanner.ts和core/scoring

3. **阶段3**: 提取类型守卫
   - 创建 `shared/type-guards.ts`
   - 统一所有类型检查逻辑

4. **阶段4**: 验证和测试
   - 运行type-check
   - 运行lint
   - 确保零错误

