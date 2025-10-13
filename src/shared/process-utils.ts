/**
 * Process Utilities - 统一的进程和包管理函数
 * 
 * 提供子进程执行、动态包加载等功能
 * @packageDocumentation
 */

import { execSync } from 'node:child_process'

/**
 * Execute shell command and return output
 * 
 * @param command - Shell command to execute
 * @param silent - Suppress stderr output (default: true)
 * @returns Command output (trimmed)
 * @throws Error if command fails
 * 
 * @example
 * ```typescript
 * const gitLog = runCommand('git log --oneline -n 5')
 * ```
 */
export function runCommand(command: string, silent: boolean = true): string {
  if (silent) {
    const output = execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] })
    return output.toString().trim()
  } else {
    execSync(command, { stdio: 'inherit' })
    return ''
  }
}

/**
 * Try to execute command, return null if fails
 * 
 * @param command - Shell command to execute
 * @returns Command output or null if failed
 */
export function tryRunCommand(command: string): string | null {
  try {
    return runCommand(command)
  } catch {
    return null
  }
}

/**
 * Dynamically import a package with graceful error handling
 * 
 * @param packageName - NPM package name
 * @param installHint - Installation hint (default: same as packageName)
 * @returns Imported module
 * @throws Error with installation hint if package not found
 * 
 * @example
 * ```typescript
 * const fg = await requirePackage('fast-glob', 'fast-glob')
 * const files = await fg(['src/*.ts'])
 * ```
 */
export async function requirePackage<T = any>(
  packageName: string,
  installHint?: string
): Promise<T> {
  try {
    return await import(packageName) as T
  } catch (error) {
    const hint = installHint || packageName
    throw new Error(`${packageName} not installed. Run: npm install ${hint}`)
  }
}

/**
 * Try to import a package, return null if not found
 * 
 * @param packageName - NPM package name
 * @returns Imported module or null
 */
export async function tryRequirePackage<T = any>(packageName: string): Promise<T | null> {
  try {
    return await import(packageName) as T
  } catch {
    return null
  }
}

/**
 * Check if package is installed
 * 
 * @param packageName - NPM package name
 * @returns True if package is installed
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  const result = await tryRequirePackage(packageName)
  return result !== null
}

