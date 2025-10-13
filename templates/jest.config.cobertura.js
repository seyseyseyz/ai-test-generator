/**
 * Jest 配置模板 - 启用 Cobertura 覆盖率
 * 
 * Cobertura 格式是 Keploy 要求的覆盖率格式，提供行级覆盖率精度。
 * 
 * 使用方法：
 * 1. 复制此文件到项目根目录，重命名为 jest.config.js
 * 2. 根据项目需要调整 collectCoverageFrom 和 testMatch
 * 3. 运行 npm test -- --coverage 生成覆盖率报告
 * 
 * 生成的文件：
 * - coverage/cobertura-coverage.xml  (Keploy 使用此文件)
 * - coverage/lcov.info                (VS Code Coverage Gutters 扩展使用)
 * - coverage/lcov-report/index.html   (浏览器查看)
 * 
 * @see https://jestjs.io/docs/configuration
 * @see http://cobertura.github.io/cobertura/
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 覆盖率报告格式（Cobertura 是 Keploy 要求的）
  coverageReporters: [
    'text',           // 终端输出
    'cobertura',      // XML 格式（Keploy 要求）⭐
    'lcov',           // HTML 报告 + VS Code 扩展
    'json',           // JSON 格式（备用）
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 需要收集覆盖率的文件
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',           // 包含所有源码
    '!src/**/*.test.{js,ts,tsx}',     // 排除测试文件
    '!src/**/__tests__/**',            // 排除测试目录
    '!src/**/*.stories.{js,ts,tsx}',  // 排除 Storybook 文件
    '!src/**/*.d.ts',                  // 排除类型定义
  ],
  
  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  
  // TypeScript 支持（如果项目使用 TypeScript）
  preset: 'ts-jest',
  
  // 模块路径别名（根据项目调整）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // 转换配置
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  
  // 覆盖率阈值（可选，严格模式）
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
  
  // 测试超时（毫秒）
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
}

