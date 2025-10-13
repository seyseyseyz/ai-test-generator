/**
 * HTTP Mock Detection
 * @module mock/detectors-http
 */

import type { HttpMethod, MockRequirement } from './types.js'

/**
 * Analyze HTTP call to generate mock requirement
 * 
 * @param callee - Function call expression
 * @param method - HTTP method
 * @param url - Request URL
 * @returns Mock requirement
 */
export function analyzeHttpCall(callee: string, method: string, url: string): MockRequirement {
  return {
    type: 'HTTP',
    mockStrategy: callee.includes('axios') ? 'axios-mock-adapter / msw' : 'msw / nock',
    reason: `Function makes ${method.toUpperCase()} request to ${url}`,
    setupExample: callee.includes('axios') 
      ? generateAxiosMockExample(method, url)
      : generateMswExample(method, url),
    testExample: `
it('should handle ${method.toUpperCase()} request', async () => {
  const result = await functionUnderTest()
  expect(result).toBeDefined()
})
    `.trim(),
    priority: 1
  }
}

/**
 * Extract HTTP method from function call
 */
export function extractHttpMethod(callee: string): HttpMethod {
  if (callee.includes('.get')) return 'GET'
  if (callee.includes('.post')) return 'POST'
  if (callee.includes('.put')) return 'PUT'
  if (callee.includes('.delete')) return 'DELETE'
  if (callee.includes('.patch')) return 'PATCH'
  return 'GET'
}

/**
 * Generate axios mock example
 */
export function generateAxiosMockExample(_method: string, url: string): string {
  return `
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

const mock = new MockAdapter(axios)

beforeEach(() => {
  mock.onGet('${url}').reply(200, { data: 'mocked' })
})

afterEach(() => {
  mock.reset()
})
  `.trim()
}

/**
 * Generate MSW mock example
 */
export function generateMswExample(method: string, url: string): string {
  return `
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.${method.toLowerCase()}('${url}', (req, res, ctx) => {
    return res(ctx.json({ data: 'mocked' }))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
  `.trim()
}

