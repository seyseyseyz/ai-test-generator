/**
 * HTTP Mock Detection
 * @module mock/detectors-http
 */

import type { HttpMethod } from './types.js'

/**
 * Format HTTP call for detection (simplified)
 * 
 * @param callee - Function call expression
 * @param method - HTTP method
 * @param url - Request URL
 * @returns Formatted call string
 */
export function formatHttpCall(callee: string, method: string, url: string): string {
  const library = callee.includes('axios') ? 'axios' : 'fetch'
  return `${library}.${method.toLowerCase()}('${url}')`
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

