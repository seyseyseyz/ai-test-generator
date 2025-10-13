/**
 * IO and Database Mock Detection
 * @module mock/detectors-io
 */

import type { ImportAnalysis, MockRequirement } from './types.js'

// ============================================================================
// File System Detection
// ============================================================================

/**
 * Check if function call is filesystem related
 */
export function isFileSystemCall(callee: string): boolean {
  return callee.includes('fs.') || callee.includes('readFile') || callee.includes('writeFile') || 
         callee.includes('existsSync') || callee.includes('mkdir')
}

/**
 * Analyze filesystem call
 */
export function analyzeFileSystemCall(callee: string): MockRequirement {
  return {
    type: 'filesystem',
    mockStrategy: 'jest.mock',
    reason: `File system operation: ${callee}`,
    setupExample: `
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'mocked content'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true)
}))
    `.trim(),
    testExample: `
const fs = require('fs')
expect(fs.readFileSync).toHaveBeenCalledWith('path/to/file')
    `.trim(),
    priority: 1
  }
}

// ============================================================================
// Database Detection
// ============================================================================

/**
 * Check if function call is database related
 */
export function isDatabaseCall(callee: string): boolean {
  const dbKeywords = ['find', 'create', 'update', 'delete', 'save', 'insert', 'query', 
                      'execute', 'transaction', 'connect', 'collection', 'model']
  return dbKeywords.some(kw => callee.toLowerCase().includes(kw))
}

/**
 * Analyze database call
 */
export function analyzeDatabaseCall(callee: string, imports: ImportAnalysis): MockRequirement {
  // Mongoose
  if (imports.mongoose) {
    return {
      type: 'database',
      mockStrategy: 'mongodb-memory-server',
      reason: `Mongoose database call: ${callee}`,
      setupExample: `
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})
      `.trim(),
      testExample: `
await YourModel.create({ field: 'value' })
const docs = await YourModel.find()
expect(docs).toHaveLength(1)
      `.trim(),
      priority: 1
    }
  }
  
  // TypeORM
  if (imports.typeorm) {
    return {
      type: 'database',
      mockStrategy: 'typeorm-test-utils',
      reason: `TypeORM database call: ${callee}`,
      setupExample: `
import { createConnection, Connection } from 'typeorm'

let connection: Connection

beforeAll(async () => {
  connection = await createConnection({
    type: 'sqlite',
    database: ':memory:',
    entities: [YourEntity],
    synchronize: true
  })
})

afterAll(async () => {
  await connection.close()
})
      `.trim(),
      testExample: `
const repo = connection.getRepository(YourEntity)
await repo.save({ field: 'value' })
const entities = await repo.find()
expect(entities).toHaveLength(1)
      `.trim(),
      priority: 1
    }
  }
  
  // Generic database
  return {
    type: 'database',
    mockStrategy: 'jest.mock',
    reason: `Database call: ${callee}`,
    setupExample: `
jest.mock('./database', () => ({
  query: jest.fn(() => Promise.resolve({ rows: [] }))
}))
    `.trim(),
    testExample: `
const db = require('./database')
expect(db.query).toHaveBeenCalled()
    `.trim(),
    priority: 1
  }
}

// ============================================================================
// Redis Detection
// ============================================================================

/**
 * Check if function call is Redis related
 */
export function isRedisCall(callee: string): boolean {
  return callee.includes('redis') || callee.includes('get') || callee.includes('set') ||
         callee.includes('del') || callee.includes('expire')
}

/**
 * Analyze Redis call
 */
export function analyzeRedisCall(callee: string): MockRequirement {
  return {
    type: 'database',
    mockStrategy: 'redis-mock',
    reason: `Redis cache call: ${callee}`,
    setupExample: `
import RedisMock from 'redis-mock'

const redis = RedisMock.createClient()

beforeEach(() => {
  redis.flushall()
})

afterAll(() => {
  redis.quit()
})
    `.trim(),
    testExample: `
await redis.set('key', 'value')
const result = await redis.get('key')
expect(result).toBe('value')
    `.trim(),
    priority: 2
  }
}

