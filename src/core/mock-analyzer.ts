// @ts-nocheck
/**
 * Mock 需求分析器（Keploy 风格）
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

import { SyntaxKind } from 'ts-morph'

/**
 * 分析函数的 Mock 需求
 * @param {import('ts-morph').FunctionDeclaration} functionNode - ts-morph 函数节点
 * @returns {Array<Object>} Mock 需求列表
 */
export function analyzeMockRequirements(functionNode) {
  const mocks = []
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
  const uniqueMocks = Array.from(
    new Map(mocks.map(m => [`${m.type}:${m.mockStrategy}`, m])).values()
  )
  
  return uniqueMocks
}

/**
 * 分析导入语句
 */
function analyzeImports(sourceFile) {
  const imports = {
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
    
    // 检测关键库
    if (moduleSpecifier === 'axios') imports.axios = true
    if (moduleSpecifier.includes('mongoose')) imports.mongoose = true
    if (moduleSpecifier.includes('typeorm')) imports.typeorm = true
    if (moduleSpecifier.includes('sequelize')) imports.sequelize = true
    if (moduleSpecifier.includes('redis')) imports.redis = true
    if (moduleSpecifier === 'fs' || moduleSpecifier === 'node:fs') imports.fs = true
  }
  
  return imports
}

/**
 * 分析单个函数调用
 */
function analyzeFunctionCall(call, callee, imports) {
  // HTTP 请求
  if (callee.includes('fetch') || callee.includes('axios') || callee.includes('request') || callee.includes('.get') || callee.includes('.post')) {
    return analyzeHttpCall(call, callee, imports)
  }
  
  // 时间相关
  if (callee === 'Date.now' || callee === 'new Date' || callee.includes('setTimeout') || callee.includes('setInterval')) {
    return analyzeTimeCall(callee)
  }
  
  // 随机数
  if (callee === 'Math.random' || callee === 'Math.floor') {
    return analyzeRandomCall(callee)
  }
  
  // 文件系统
  if (imports.fs && isFileSystemCall(callee)) {
    return analyzeFileSystemCall(callee)
  }
  
  // 数据库
  if ((imports.mongoose || imports.typeorm || imports.sequelize) && isDatabaseCall(callee)) {
    return analyzeDatabaseCall(callee, imports)
  }
  
  // Redis
  if (imports.redis && isRedisCall(callee)) {
    return analyzeRedisCall(callee)
  }
  
  return null
}

/**
 * 分析 HTTP 调用
 */
function analyzeHttpCall(call, callee, imports) {
  const args = call.getArguments()
  const urlArg = args[0]?.getText() || 'API_URL'
  const method = extractHttpMethod(callee)
  
  // 推荐策略
  let mockStrategy
  let example
  
  if (imports.axios) {
    mockStrategy = 'axios-mock-adapter'
    example = generateAxiosMockExample(method, urlArg)
  } else {
    mockStrategy = 'msw (Mock Service Worker)'
    example = generateMswExample(method, urlArg)
  }
  
  return {
    type: 'http',
    method,
    url: urlArg,
    mockStrategy,
    example,
    priority: 1,
    reasoning: 'Avoid real HTTP calls in tests - use mocks for consistent, fast tests'
  }
}

function extractHttpMethod(callee) {
  if (callee.includes('.get')) return 'GET'
  if (callee.includes('.post')) return 'POST'
  if (callee.includes('.put')) return 'PUT'
  if (callee.includes('.delete')) return 'DELETE'
  if (callee.includes('.patch')) return 'PATCH'
  return 'GET'
}

function generateAxiosMockExample(method, url) {
  return `
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

const mock = new MockAdapter(axios)

mock.on${method.toLowerCase()}(${url}).reply(200, {
  data: 'mocked response'
})

// ... run your tests ...

mock.restore()
  `.trim()
}

function generateMswExample(method, url) {
  return `
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.${method.toLowerCase()}(${url}, (req, res, ctx) => {
    return res(ctx.json({ data: 'mocked response' }))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
  `.trim()
}

/**
 * 分析时间调用
 */
function analyzeTimeCall(callee) {
  return {
    type: 'time',
    operation: callee,
    mockStrategy: 'jest.useFakeTimers()',
    example: `
// At the top of your test file
jest.useFakeTimers()

// Set a specific time
jest.setSystemTime(new Date('2024-01-01T00:00:00Z'))

// ... run your tests ...

// Advance timers if using setTimeout/setInterval
jest.advanceTimersByTime(1000)  // advance 1 second

// Clean up
jest.useRealTimers()
    `.trim(),
    priority: 2,
    reasoning: 'Control time in tests for deterministic results'
  }
}

/**
 * 分析随机数调用
 */
function analyzeRandomCall(callee) {
  return {
    type: 'random',
    operation: callee,
    mockStrategy: 'jest.spyOn(Math, "random")',
    example: `
const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5)

// ... run your tests ...

mockRandom.mockRestore()
    `.trim(),
    priority: 2,
    reasoning: 'Make random operations deterministic for reliable tests'
  }
}

/**
 * 分析文件系统调用
 */
function isFileSystemCall(callee) {
  const fsOps = [
    'readFile', 'writeFile', 'readFileSync', 'writeFileSync',
    'mkdir', 'mkdirSync', 'rmdir', 'rmdirSync',
    'unlink', 'unlinkSync', 'stat', 'statSync',
    'readdir', 'readdirSync', 'exists', 'existsSync'
  ]
  
  return fsOps.some(op => callee.includes(op))
}

function analyzeFileSystemCall(callee) {
  return {
    type: 'filesystem',
    operation: callee,
    mockStrategy: 'mock-fs or jest.mock("fs")',
    example: `
// Option 1: mock-fs (in-memory filesystem)
import mock from 'mock-fs'

beforeEach(() => {
  mock({
    'path/to/file.txt': 'file content',
    'empty-dir': {}
  })
})

afterEach(() => {
  mock.restore()
})

// Option 2: jest.mock
jest.mock('fs')
import fs from 'node:fs'

fs.${callee}.mockResolvedValue('mocked data')
    `.trim(),
    priority: 1,
    reasoning: 'Avoid real filesystem operations - use in-memory mocks'
  }
}

/**
 * 分析数据库调用
 */
function isDatabaseCall(callee) {
  const dbOps = [
    'find', 'findOne', 'findById', 'findAll',
    'save', 'create', 'insert',
    'update', 'updateOne', 'updateMany',
    'delete', 'deleteOne', 'deleteMany', 'remove',
    'query', 'execute', 'transaction'
  ]
  
  return dbOps.some(op => callee.includes(op))
}

function analyzeDatabaseCall(callee, imports) {
  let mockStrategy = 'jest.mock() or test database'
  let example
  
  if (imports.mongoose) {
    mockStrategy = 'jest.mock() for Mongoose models'
    example = `
// Mock the model
jest.mock('./models/User', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn()
}))

import User from './models/User'

// In your test
User.find.mockResolvedValue([{ name: 'Test User' }])
    `.trim()
  } else if (imports.typeorm) {
    mockStrategy = 'TypeORM repository mocks'
    example = `
const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn()
}

// In your test
mockRepository.find.mockResolvedValue([{ id: 1, name: 'Test' }])
    `.trim()
  } else {
    example = `
// Generic database mock
const mockDb = {
  query: jest.fn().mockResolvedValue([]),
  execute: jest.fn().mockResolvedValue({ affectedRows: 1 })
}
    `.trim()
  }
  
  return {
    type: 'database',
    operation: callee,
    mockStrategy,
    example,
    priority: 1,
    reasoning: 'Use mocks instead of real database - faster and isolated tests'
  }
}

/**
 * 分析 Redis 调用
 */
function isRedisCall(callee) {
  const redisOps = ['get', 'set', 'del', 'exists', 'expire', 'hget', 'hset', 'lpush', 'rpush']
  return redisOps.some(op => callee.includes(op))
}

function analyzeRedisCall(callee) {
  return {
    type: 'redis',
    operation: callee,
    mockStrategy: 'redis-mock or jest.mock()',
    example: `
// Option 1: redis-mock
import redisMock from 'redis-mock'
const client = redisMock.createClient()

// Option 2: jest.mock
jest.mock('redis')
import redis from 'redis'

const mockClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
}

redis.createClient.mockReturnValue(mockClient)
    `.trim(),
    priority: 2,
    reasoning: 'Mock Redis for isolated unit tests'
  }
}

/**
 * 格式化 Mock 需求为 Prompt 文本
 * @param {Array} mocks - Mock 需求列表
 * @returns {string} 格式化的文本
 */
export function formatMocksForPrompt(mocks) {
  if (mocks.length === 0) {
    return '- No external dependencies detected - pure function ✅\n'
  }
  
  let text = '**Mock Requirements**:\n\n'
  
  // 按优先级分组
  const highPriority = mocks.filter(m => m.priority === 1)
  const mediumPriority = mocks.filter(m => m.priority === 2)
  
  if (highPriority.length > 0) {
    text += '**Critical Mocks** (must implement):\n'
    for (const mock of highPriority) {
      text += formatSingleMock(mock)
    }
    text += '\n'
  }
  
  if (mediumPriority.length > 0) {
    text += '**Optional Mocks** (recommended):\n'
    for (const mock of mediumPriority) {
      text += formatSingleMock(mock)
    }
    text += '\n'
  }
  
  text += '**Important**: Always clean up mocks in `afterEach()` or `afterAll()`\n'
  
  return text
}

function formatSingleMock(mock) {
  let text = `\n### ${mock.type.toUpperCase()}: ${mock.mockStrategy}\n`
  text += `*${mock.reasoning}*\n\n`
  
  if (mock.method) {
    text += `Method: ${mock.method}\n`
  }
  if (mock.url) {
    text += `URL: ${mock.url}\n`
  }
  if (mock.operation) {
    text += `Operation: ${mock.operation}\n`
  }
  
  text += '\nExample:\n```typescript\n'
  text += mock.example
  text += '\n```\n'
  
  return text
}

/**
 * 获取 Mock 统计信息
 * @param {Array} mocks - Mock 需求列表
 * @returns {Object} 统计信息
 */
export function getMockStats(mocks) {
  const stats = {
    total: mocks.length,
    byType: {},
    byPriority: { high: 0, medium: 0 },
    hasHttpMocks: false,
    hasTimeMocks: false,
    hasDatabaseMocks: false
  }
  
  for (const mock of mocks) {
    // 按类型统计
    stats.byType[mock.type] = (stats.byType[mock.type] || 0) + 1
    
    // 按优先级统计
    if (mock.priority === 1) stats.byPriority.high++
    else stats.byPriority.medium++
    
    // 特殊类型标记
    if (mock.type === 'http') stats.hasHttpMocks = true
    if (mock.type === 'time') stats.hasTimeMocks = true
    if (mock.type === 'database') stats.hasDatabaseMocks = true
  }
  
  return stats
}

/**
 * 生成 Mock 设置代码骨架
 * @param {Array} mocks - Mock 需求列表
 * @returns {string} 设置代码
 */
export function generateMockSetup(mocks) {
  if (mocks.length === 0) return ''
  
  let setup = `// Mock Setup\n`
  
  // HTTP mocks (MSW)
  const httpMocks = mocks.filter(m => m.type === 'http')
  if (httpMocks.length > 0) {
    setup += `
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  ${httpMocks.map(m => `rest.${m.method.toLowerCase()}(${m.url}, (req, res, ctx) => {
    return res(ctx.json({ /* mock data */ }))
  })`).join(',\n  ')}
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
`
  }
  
  // Time mocks
  const timeMocks = mocks.filter(m => m.type === 'time')
  if (timeMocks.length > 0) {
    setup += `
// Time mocks
beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2024-01-01'))
})

afterEach(() => {
  jest.useRealTimers()
})
`
  }
  
  // Random mocks
  const randomMocks = mocks.filter(m => m.type === 'random')
  if (randomMocks.length > 0) {
    setup += `
// Random mocks
let mockRandom

beforeEach(() => {
  mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  mockRandom.mockRestore()
})
`
  }
  
  return setup
}

