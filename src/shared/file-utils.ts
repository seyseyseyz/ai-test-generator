/**
 * File Utilities - 统一的文件操作函数
 * 
 * 提供文件读写、JSON 解析等功能
 * @packageDocumentation
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

/**
 * Strip comments from JSON string (JSONC support)
 * 
 * Removes:
 * - Block comments: `/* ... *\/`
 * - Line comments: `// ...`
 * 
 * @param content - JSON content with comments
 * @returns JSON string without comments
 */
export function stripJsonComments(content: string): string {
  return String(content)
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|\s)\/\/.*$/gm, '')     // line comments
}

/**
 * Load and parse JSON file (supports JSONC)
 * 
 * @param filePath - Path to JSON file
 * @param defaultValue - Default value if file doesn't exist or parsing fails
 * @returns Parsed JSON object or default value
 * 
 * @example
 * ```typescript
 * const config = loadJson<MyConfig>('config.jsonc', {})
 * ```
 */
export function loadJson<T = any>(filePath: string, defaultValue: T | null = null): T | null {
  if (!filePath || !existsSync(filePath)) return defaultValue
  
  try {
    const content = readFileSync(filePath, 'utf8')
    const stripped = stripJsonComments(content)
    return JSON.parse(stripped) as T
  } catch (error) {
    return defaultValue
  }
}

/**
 * Save object to JSON file
 * 
 * @param filePath - Path to JSON file
 * @param data - Data to save
 * @param pretty - Pretty print (default: true)
 */
export function saveJson(filePath: string, data: any, pretty: boolean = true): void {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  writeFileSync(filePath, json, 'utf8')
}

/**
 * Check if file exists
 * 
 * @param filePath - Path to file
 * @returns True if file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath)
}

/**
 * Read file content
 * 
 * @param filePath - Path to file
 * @param encoding - File encoding (default: utf8)
 * @returns File content or null if not found
 */
export function readFile(filePath: string, encoding: BufferEncoding = 'utf8'): string | null {
  if (!existsSync(filePath)) return null
  
  try {
    return readFileSync(filePath, encoding)
  } catch {
    return null
  }
}

/**
 * Write file content
 * 
 * @param filePath - Path to file
 * @param content - Content to write
 * @param encoding - File encoding (default: utf8)
 */
export function writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): void {
  writeFileSync(filePath, content, encoding)
}

