/**
 * Mock 需求分析器
 * 
 * 自动识别函数中需要 mock 的依赖，并推荐最佳 mock 策略。
 * 
 * 支持检测:
 * - HTTP 请求 (fetch, axios, request)
 * - 时间相关 (Date, setTimeout, setInterval)
 * - 随机数 (Math.random)
 * - 文件系统 (fs)
 * - 数据库操作 (mongoose, typeorm, sequelize)
 * - 外部模块导入
 * 
 * 参考:
 * - Keploy ut-gen: https://github.com/keploy/keploy/blob/main/README-UnitGen.md
 * 
 * @module mock-analyzer
 */

import { SyntaxKind, type ArrowFunction, type CallExpression, type FunctionDeclaration, type FunctionExpression, type SourceFile } from 'ts-morph'

// ============================================================================
// Type Definitions
// ============================================================================

/** Function node type from ts-morph */
type FunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression

/** Import analysis result */
export interface ImportAnalysis {
  modules: Set<string>
  axios: boolean
  fetch: boolean
  mongoose: boolean
  typeorm: boolean
  sequelize: boolean
  redis: boolean
  fs: boolean
}

/** Mock requirement */
export interface MockRequirement {
  type: string
  mockStrategy: string
  reason: string
  setupExample: string
  testExample?: string
  priority?: number
}

/** HTTP method type */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * 分析函数的 Mock 需求
 * @param functionNode - ts-morph 函数节点
 * @returns Mock 需求列表
 */
export function analyzeMockRequirements(functionNode: FunctionNode): MockRequirement[] {
  const mocks: MockRequirement[] = []
  const sourceFile = functionNode.getSourceFile()
  
  // 1. 分析导入的依赖
  const imports = analyzeImports(sourceFile)
  
  // 2. 分析函数调用
  const callExpressions = functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
  
  for (const call of callExpressions) {
    try {
      const callee = call.getExpression().getText()
      const mock = analyzeFunctionCall(call, callee, imports)
      
      if (mock) {
        mocks.push(mock)
      }
    } catch (error) {
      // Skip calls that can't be analyzed
      continue
    }
  }
  
  // 3. 去重（按 type + mockStrategy）
  return Array.from(
    new Map(mocks.map(m => [`${m.type}:${m.mockStrategy}`, m])).values()
  )
}

// ============================================================================
// Import Analysis
// ============================================================================

/**
 * 分析导入语句
 */
function analyzeImports(sourceFile: SourceFile): ImportAnalysis {
  const imports: ImportAnalysis = {
    modules: new Set(),
    axios: false,
    fetch: false,
    mongoose: false,
    typeorm: false,
    sequelize: false,
    redis: false,
    fs: false
  }
  
  const importDeclarations = sourceFile.getImportDeclarations()
  
  for (const imp of importDeclarations) {
    const moduleSpecifier = imp.getModuleSpecifierValue()
    imports.modules.add(moduleSpecifier)
    
    // 检测常见依赖
    if (moduleSpecifier === 'axios') imports.axios = true
    if (moduleSpecifier === 'node-fetch' || moduleSpecifier === 'cross-fetch') imports.fetch = true
    if (moduleSpecifier === 'mongoose') imports.mongoose = true
    if (moduleSpecifier.includes('typeorm')) imports.typeorm = true
    if (moduleSpecifier === 'sequelize') imports.sequelize = true
    if (moduleSpecifier === 'redis' || moduleSpecifier === 'ioredis') imports.redis = true
    if (moduleSpecifier === 'fs' || moduleSpecifier === 'node:fs' || moduleSpecifier === 'fs-extra') imports.fs = true
  }
  
  return imports
}

// ============================================================================
// Function Call Analysis
// ============================================================================

/**
 * 分析单个函数调用
 */
function analyzeFunctionCall(
  call: CallExpression,
  callee: string,
  imports: ImportAnalysis
): MockRequirement | null {
  // 1. HTTP 调用
  if (callee.includes('fetch') || callee.includes('axios') || callee.includes('request')) {
    return analyzeHttpCall(call, callee, imports)
  }
  
  // 2. 时间调用
  if (callee.includes('Date') || callee.includes('setTimeout') || callee.includes('setInterval')) {
    return analyzeTimeCall(callee)
  }
  
  // 3. 随机数
  if (callee.includes('Math.random')) {
    return analyzeRandomCall(callee)
  }
  
  // 4. 文件系统
  if (isFileSystemCall(callee)) {
    return analyzeFileSystemCall(callee)
  }
  
  // 5. 数据库
  if (isDatabaseCall(callee)) {
    return analyzeDatabaseCall(callee, imports)
  }
  
  // 6. Redis
  if (isRedisCall(callee)) {
    return analyzeRedisCall(callee)
  }
  
  return null
}

// ============================================================================
// HTTP Call Analysis
// ============================================================================

/**
 * 分析 HTTP 调用
 */
function analyzeHttpCall(
  call: CallExpression,
  callee: string,
  imports: ImportAnalysis
): MockRequirement {
  // 提取 URL（如果有）
  const args = call.getArguments()
  let url = 'unknown'
  if (args.length > 0) {
    const urlArg = args[0]
    if (urlArg) {
      url = urlArg.getText().replace(/['"]/g, '')
    }
  }
  
  // 提取方法
  const method = extractHttpMethod(callee)
  
  // 推荐 mock 策略
  if (imports.axios) {
    return {
      type: 'http',
      mockStrategy: 'axios-mock-adapter',
      reason: `HTTP ${method} 请求到 ${url}`,
      setupExample: generateAxiosMockExample(method, url),
      testExample: `const response = await yourFunction(); expect(response.data).toEqual(mockData);`,
      priority: 1
    }
  } else {
    return {
      type: 'http',
      mockStrategy: 'msw',
      reason: `HTTP ${method} 请求到 ${url}`,
      setupExample: generateMswExample(method, url),
      testExample: `const response = await yourFunction(); expect(response.data).toEqual(mockData);`,
      priority: 1
    }
  }
}

/**
 * 提取 HTTP 方法
 */
function extractHttpMethod(callee: string): HttpMethod {
  if (callee.includes('get')) return 'GET'
  if (callee.includes('post')) return 'POST'
  if (callee.includes('put')) return 'PUT'
  if (callee.includes('delete')) return 'DELETE'
  if (callee.includes('patch')) return 'PATCH'
  return 'GET'
}

/**
 * 生成 axios-mock-adapter 示例
 */
function generateAxiosMockExample(method: string, url: string): string {
  const lowerMethod = method.toLowerCase()
  return `
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);
mock.${lowerMethod}('${url}').reply(200, { data: 'mocked' });
  `.trim()
}

/**
 * 生成 MSW 示例
 */
function generateMswExample(method: string, url: string): string {
  return `
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.${method.toLowerCase()}('${url}', (req, res, ctx) => {
    return res(ctx.json({ data: 'mocked' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
  `.trim()
}

// ============================================================================
// Time Call Analysis
// ============================================================================

/**
 * 分析时间相关调用
 */
function analyzeTimeCall(callee: string): MockRequirement {
  return {
    type: 'time',
    mockStrategy: 'jest.useFakeTimers',
    reason: `时间依赖: ${callee}`,
    setupExample: `
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01'));
});

afterEach(() => {
  jest.useRealTimers();
});
    `.trim(),
    testExample: `jest.advanceTimersByTime(1000); // Fast-forward 1 second`,
    priority: 2
  }
}

// ============================================================================
// Random Call Analysis
// ============================================================================

/**
 * 分析随机数调用
 */
function analyzeRandomCall(callee: string): MockRequirement {
  return {
    type: 'random',
    mockStrategy: 'jest.spyOn',
    reason: `随机数依赖: ${callee}`,
    setupExample: `
jest.spyOn(Math, 'random').mockReturnValue(0.5);
    `.trim(),
    testExample: `expect(Math.random()).toBe(0.5);`,
    priority: 2
  }
}

// ============================================================================
// File System Call Analysis
// ============================================================================

/**
 * 检查是否为文件系统调用
 */
function isFileSystemCall(callee: string): boolean {
  return callee.includes('fs.') || callee.includes('readFile') || callee.includes('writeFile') || 
         callee.includes('existsSync') || callee.includes('mkdir')
}

/**
 * 分析文件系统调用
 */
function analyzeFileSystemCall(callee: string): MockRequirement {
  return {
    type: 'filesystem',
    mockStrategy: 'jest.mock',
    reason: `文件系统操作: ${callee}`,
    setupExample: `
jest.mock('fs');
import fs from 'fs';

// Mock specific methods
fs.readFileSync.mockReturnValue('mock data');
fs.existsSync.mockReturnValue(true);
    `.trim(),
    testExample: `
const data = fs.readFileSync('test.txt', 'utf8');
expect(data).toBe('mock data');
    `.trim(),
    priority: 1
  }
}

// ============================================================================
// Database Call Analysis
// ============================================================================

/**
 * 检查是否为数据库调用
 */
function isDatabaseCall(callee: string): boolean {
  return callee.includes('findOne') || callee.includes('findById') || callee.includes('save') ||
         callee.includes('create') || callee.includes('update') || callee.includes('delete') ||
         callee.includes('Model.') || callee.includes('repository.')
}

/**
 * 分析数据库调用
 */
function analyzeDatabaseCall(callee: string, imports: ImportAnalysis): MockRequirement {
  if (imports.mongoose) {
    return {
      type: 'database',
      mockStrategy: 'mongoose-mock',
      reason: `Mongoose 数据库操作: ${callee}`,
      setupExample: `
jest.mock('./models/User');
import User from './models/User';

User.findOne = jest.fn().mockResolvedValue({ 
  _id: '123', 
  name: 'Test User' 
});
      `.trim(),
      testExample: `
const user = await User.findOne({ email: 'test@example.com' });
expect(user.name).toBe('Test User');
      `.trim(),
      priority: 1
    }
  }
  
  if (imports.typeorm) {
    return {
      type: 'database',
      mockStrategy: 'typeorm-mock',
      reason: `TypeORM 数据库操作: ${callee}`,
      setupExample: `
const mockRepository = {
  findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
  save: jest.fn().mockImplementation(entity => entity),
};

jest.mock('typeorm', () => ({
  ...jest.requireActual('typeorm'),
  getRepository: () => mockRepository,
}));
      `.trim(),
      priority: 1
    }
  }
  
  if (imports.sequelize) {
    return {
      type: 'database',
      mockStrategy: 'sequelize-mock',
      reason: `Sequelize 数据库操作: ${callee}`,
      setupExample: `
jest.mock('../models');
import { User } from '../models';

User.findOne = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });
      `.trim(),
      priority: 1
    }
  }
  
  return {
    type: 'database',
    mockStrategy: 'jest.fn',
    reason: `数据库操作: ${callee}`,
    setupExample: `
// Mock database operations
const mockDb = {
  query: jest.fn().mockResolvedValue([{ id: 1 }]),
};
    `.trim(),
    priority: 1
  }
}

// ============================================================================
// Redis Call Analysis
// ============================================================================

/**
 * 检查是否为 Redis 调用
 */
function isRedisCall(callee: string): boolean {
  return callee.includes('redis.') || callee.includes('.get(') || callee.includes('.set(')
}

/**
 * 分析 Redis 调用
 */
function analyzeRedisCall(callee: string): MockRequirement {
  return {
    type: 'redis',
    mockStrategy: 'redis-mock',
    reason: `Redis 缓存操作: ${callee}`,
    setupExample: `
jest.mock('redis');
import redis from 'redis';

const mockRedis = {
  get: jest.fn().mockImplementation((key, callback) => {
    callback(null, 'mock value');
  }),
  set: jest.fn().mockImplementation((key, value, callback) => {
    callback(null, 'OK');
  }),
};

redis.createClient.mockReturnValue(mockRedis);
    `.trim(),
    testExample: `
const value = await redis.get('key');
expect(value).toBe('mock value');
    `.trim(),
    priority: 2
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 格式化 Mock 需求为 Prompt 文本
 */
export function formatMocksForPrompt(mocks: MockRequirement[]): string {
  if (mocks.length === 0) {
    return '- No external dependencies detected (pure function)\n'
  }
  
  let text = '**Mock Requirements**:\n\n'
  
  // 按 priority 排序
  const sortedMocks = [...mocks].sort((a, b) => (a.priority || 3) - (b.priority || 3))
  
  for (const mock of sortedMocks) {
    text += `- **${mock.type}** (${mock.mockStrategy}):\n`
    text += `  Reason: ${mock.reason}\n`
    text += `  Setup:\n\`\`\`typescript\n${mock.setupExample}\n\`\`\`\n\n`
  }
  
  return text
}

/**
 * 获取 Mock 统计信息
 */
export function getMockStats(mocks: MockRequirement[]): {
  total: number
  byType: Record<string, number>
  byStrategy: Record<string, number>
  highPriority: number
} {
  const stats = {
    total: mocks.length,
    byType: {} as Record<string, number>,
    byStrategy: {} as Record<string, number>,
    highPriority: 0
  }
  
  for (const mock of mocks) {
    // 按类型统计
    stats.byType[mock.type] = (stats.byType[mock.type] || 0) + 1
    
    // 按策略统计
    stats.byStrategy[mock.mockStrategy] = (stats.byStrategy[mock.mockStrategy] || 0) + 1
    
    // 高优先级统计
    if (mock.priority === 1) {
      stats.highPriority++
    }
  }
  
  return stats
}
