# Cobertura 覆盖率配置指南

> Keploy 风格的行级覆盖率配置

## 🎯 为什么需要 Cobertura？

**Cobertura** 是一种 XML 格式的覆盖率报告，提供**行级精度**的覆盖率数据。

### 优势

1. ✅ **行级精度**：精确到每一行代码的覆盖情况
2. ✅ **分支覆盖**：识别条件分支的覆盖情况
3. ✅ **工具标准**：Keploy、SonarQube、Jenkins 等工具的标准格式
4. ✅ **未覆盖行定位**：精确告诉 AI 哪些行需要测试

### vs Jest JSON 格式

| 特性 | Cobertura XML | Jest JSON |
|------|---------------|-----------|
| 行级覆盖 | ✅ 精确 | ⚠️ 语句级 |
| 分支覆盖 | ✅ 详细 | ✅ 有 |
| 文件大小 | 📦 较大 | 📦 较小 |
| 工具支持 | ✅ 广泛 | ⚠️ Jest 专用 |
| AI 分析 | ✅ 更精确 | ⚠️ 需转换 |

---

## 📦 快速配置

### 1. 复制配置模板

```bash
# 在项目根目录
cp node_modules/ai-unit-test-generator/templates/jest.config.cobertura.js jest.config.js
```

或手动创建 `jest.config.js`：

```javascript
module.exports = {
  testEnvironment: 'node',
  
  // ⭐ 关键配置：添加 cobertura
  coverageReporters: [
    'text',        // 终端输出
    'cobertura',   // ⭐ Keploy 要求
    'lcov',        // HTML 报告
  ],
  
  coverageDirectory: 'coverage',
  
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.test.{js,ts,tsx}',
    '!src/**/__tests__/**',
  ],
  
  preset: 'ts-jest',  // TypeScript 项目
}
```

### 2. 运行覆盖率测试

```bash
npm test -- --coverage
```

### 3. 验证生成的文件

```bash
ls -lh coverage/

# 应该看到：
# cobertura-coverage.xml  ⭐ (Keploy 使用此文件)
# lcov.info
# lcov-report/
# coverage-final.json
```

### 4. 使用 ai-test 分析

```bash
# ai-test 会自动检测并使用 Cobertura
ai-test scan

# 输出：
# 📊 Using Cobertura XML for line-level coverage (Keploy style)
```

---

## 🔧 不同项目类型的配置

### React + TypeScript 项目

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',  // ⭐ React 需要 DOM 环境
  
  coverageReporters: ['text', 'cobertura', 'lcov'],
  coverageDirectory: 'coverage',
  
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.stories.tsx',
    '!src/index.tsx',
  ],
  
  preset: 'ts-jest',
  
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
}
```

### Node.js + TypeScript 项目

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  
  coverageReporters: ['text', 'cobertura', 'lcov'],
  coverageDirectory: 'coverage',
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
  ],
  
  preset: 'ts-jest',
  
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],
}
```

### React Native 项目

```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  
  coverageReporters: ['text', 'cobertura', 'lcov'],
  coverageDirectory: 'coverage',
  
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
  ],
  
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
  ],
  
  setupFiles: ['<rootDir>/jest.setup.js'],
}
```

### Next.js 项目

```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  testEnvironment: 'jsdom',
  
  coverageReporters: ['text', 'cobertura', 'lcov'],
  coverageDirectory: 'coverage',
  
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
  ],
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
```

---

## 📊 读取覆盖率数据

### 使用 ai-test 内置解析器

```javascript
import { findUncoveredLines } from 'ai-unit-test-generator/testing'

const coverage = await findUncoveredLines('coverage')

console.log(coverage)
// {
//   format: 'cobertura',
//   lineRate: 0.85,
//   branchRate: 0.78,
//   uncoveredLines: [
//     { file: 'src/utils.ts', lineNumber: 42, hits: 0 }
//   ],
//   filesCoverage: { ... }
// }
```

### 手动解析（如果需要自定义）

```javascript
import { parseCoberturaXml } from 'ai-unit-test-generator/testing'

const coverage = await parseCoberturaXml('coverage/cobertura-coverage.xml')

// 获取特定文件的未覆盖行
const uncovered = coverage.uncoveredLines
  .filter(line => line.file.includes('payment'))
  .map(line => line.lineNumber)

console.log('Payment 模块未覆盖行:', uncovered)
// [15, 23, 45, 67]
```

---

## 🐛 常见问题

### Q1: 没有生成 cobertura-coverage.xml？

**原因**：Jest 配置中缺少 `cobertura` reporter

**解决**：
```javascript
// jest.config.js
module.exports = {
  coverageReporters: ['text', 'cobertura', 'lcov'],  // ⭐ 确保有 cobertura
  // ...
}
```

### Q2: ai-test 仍然使用 JSON 格式？

**确认文件存在**：
```bash
ls coverage/cobertura-coverage.xml
```

**检查 ai-test 输出**：
```bash
ai-test scan

# 期望输出：
# 📊 Using Cobertura XML for line-level coverage (Keploy style)

# 如果看到：
# 📊 Using Jest coverage-final.json (fallback)
# 说明没找到 Cobertura 文件
```

### Q3: TypeScript 项目报错？

**安装必需依赖**：
```bash
npm install --save-dev ts-jest @types/jest
```

**更新配置**：
```javascript
module.exports = {
  preset: 'ts-jest',
  // ...
}
```

### Q4: React 项目测试失败？

**安装 Testing Library**：
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**创建 jest.setup.js**：
```javascript
import '@testing-library/jest-dom'
```

**更新配置**：
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // ...
}
```

### Q5: Coverage 目录很大？

**添加到 .gitignore**：
```gitignore
# Coverage
coverage/
*.lcov
```

**只保留必要文件**：
```javascript
// jest.config.js
module.exports = {
  coverageReporters: ['text', 'cobertura'],  // 移除 lcov 减小体积
  // ...
}
```

---

## 📈 最佳实践

### 1. CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with coverage
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage/cobertura-coverage.xml
```

### 2. 覆盖率趋势追踪

```bash
# 保存基线
cp coverage/cobertura-coverage.xml baseline-coverage.xml

# 比较变化
ai-test compare-coverage baseline-coverage.xml coverage/cobertura-coverage.xml
```

### 3. 定期清理

```bash
# 清理旧覆盖率数据
npm run test:clean

# package.json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:clean": "rm -rf coverage"
  }
}
```

---

## 🔗 参考资源

- **Cobertura 官方文档**: http://cobertura.github.io/cobertura/
- **Jest Coverage 配置**: https://jestjs.io/docs/configuration#coveragereporters-arraystring--string-options
- **Keploy ut-gen**: https://github.com/keploy/keploy/blob/main/README-UnitGen.md
- **SonarQube Cobertura**: https://docs.sonarqube.org/latest/analysis/coverage/

---

## ✅ 配置检查清单

- [ ] `jest.config.js` 包含 `coverageReporters: ['cobertura']`
- [ ] 运行 `npm test -- --coverage` 无错误
- [ ] `coverage/cobertura-coverage.xml` 文件存在
- [ ] `ai-test scan` 显示 "Using Cobertura XML"
- [ ] 覆盖率数据准确反映代码状态
- [ ] `.gitignore` 包含 `coverage/`

---

**配置完成后，ai-test 将自动使用 Cobertura 进行更精确的测试生成！** 🎉

