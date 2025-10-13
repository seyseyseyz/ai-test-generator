/**
 * Process Utilities - 统一的进程和包管理函数
 * 
 * 提供子进程执行、动态包加载等功能
 * @packageDocumentation
 */

import { type ChildProcess, type StdioOptions, execSync, spawn } from 'node:child_process'

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
export async function requirePackage<T = unknown>(
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
export async function tryRequirePackage<T = unknown>(packageName: string): Promise<T | null> {
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

/**
 * Shell command execution options
 */
export interface SpawnOptions {
  /** Capture stdout (default: false) */
  captureStdout?: boolean
  /** Working directory */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
  /** Timeout in milliseconds */
  timeoutMs?: number
}

/**
 * Execute shell command using spawn (async, better for long-running processes)
 * 
 * @param cmd - Command to execute
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Command output (if captureStdout is true) or null
 * @throws Error if command fails or times out
 * 
 * @example
 * ```typescript
 * // Run command and inherit stdio
 * await spawnCommand('npm', ['install'])
 * 
 * // Capture output
 * const output = await spawnCommand('git', ['log', '--oneline'], { captureStdout: true })
 * ```
 */
export function spawnCommand(
  cmd: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<string | null> {
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

    let timeoutHandle: NodeJS.Timeout | undefined
    if (options.timeoutMs) {
      timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Command timeout after ${options.timeoutMs}ms: ${cmd} ${args.join(' ')}`))
      }, options.timeoutMs)
    }

    child.on('close', (code: number | null) => {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      if (code === 0) {
        const output = options.captureStdout ? Buffer.concat(chunks).toString('utf8') : null
        resolve(output)
      } else {
        reject(new Error(`${cmd} exited with code ${code}`))
      }
    })

    child.on('error', (err: Error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      reject(err)
    })
  })
}

/**
 * Try to execute command, return null if fails
 * 
 * @param cmd - Command to execute
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Command output or null if failed
 * 
 * @example
 * ```typescript
 * const output = await trySpawnCommand('git', ['status'])
 * if (output) {
 *   console.log('Git status:', output)
 * }
 * ```
 */
export async function trySpawnCommand(
  cmd: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<string | null> {
  try {
    return await spawnCommand(cmd, args, options)
  } catch {
    return null
  }
}

/**
 * Execute command and capture output (convenience function)
 * 
 * @param cmd - Command to execute
 * @param args - Command arguments
 * @param options - Execution options (without captureStdout)
 * @returns Command output
 * @throws Error if command fails
 * 
 * @example
 * ```typescript
 * const version = await captureOutput('node', ['--version'])
 * console.log('Node version:', version)
 * ```
 */
export async function captureOutput(
  cmd: string,
  args: string[] = [],
  options: Omit<SpawnOptions, 'captureStdout'> = {}
): Promise<string> {
  const output = await spawnCommand(cmd, args, { ...options, captureStdout: true })
  return output || ''
}

/**
 * Execute command without capturing output (convenience function)
 * 
 * @param cmd - Command to execute
 * @param args - Command arguments
 * @param options - Execution options (without captureStdout)
 * @returns void
 * @throws Error if command fails
 * 
 * @example
 * ```typescript
 * await executeInherit('npm', ['install'])
 * ```
 */
export async function executeInherit(
  cmd: string,
  args: string[] = [],
  options: Omit<SpawnOptions, 'captureStdout'> = {}
): Promise<void> {
  await spawnCommand(cmd, args, { ...options, captureStdout: false })
}

