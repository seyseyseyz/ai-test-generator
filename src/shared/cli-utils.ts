/**
 * CLI Utilities - 统一的命令行工具函数
 * 
 * 提供参数解析、帮助信息等 CLI 相关功能
 * @packageDocumentation
 */

/**
 * Parsed CLI arguments
 */
export interface ParsedArgs {
  [key: string]: string | boolean | undefined
}

/**
 * Parse command line arguments
 * 
 * Supports:
 * - `--flag` (boolean)
 * - `--key=value` (string)
 * - `--key value` (string)
 * 
 * @param argv - Process arguments (default: process.argv)
 * @param startIndex - Start parsing from this index (default: 2, skip node and script path)
 * @returns Parsed arguments object
 * 
 * @example
 * ```typescript
 * const args = parseArgs(['node', 'script.js', '--out=report.json', '--verbose'])
 * // { out: 'report.json', verbose: true }
 * ```
 */
export function parseArgs(argv: string[] = process.argv, startIndex: number = 2): ParsedArgs {
  const args: ParsedArgs = {}
  
  for (let i = startIndex; i < argv.length; i++) {
    const a = argv[i]
    if (!a || !a.startsWith('--')) continue
    
    if (a.includes('=')) {
      // Format: --key=value
      const [k, v] = a.split('=')
      if (k) {
        args[k.replace(/^--/, '')] = v || ''
      }
    } else {
      // Format: --key value or --flag
      const key = a.replace(/^--/, '')
      const nextArg = argv[i + 1]
      
      if (nextArg === undefined || nextArg.startsWith('--')) {
        // Boolean flag
        args[key] = true
      } else {
        // Key-value pair
        args[key] = nextArg
        i++ // Skip next argument
      }
    }
  }
  
  return args
}

/**
 * Display help message and exit
 * 
 * @param message - Help message to display
 * @param exitCode - Exit code (default: 0)
 */
export function showHelp(message: string, exitCode: number = 0): never {
  if (exitCode === 0) {
    console.log(message)
  } else {
    console.error(message)
  }
  process.exit(exitCode)
}

/**
 * Display error message and exit with code 1
 * 
 * @param message - Error message
 */
export function showError(message: string): never {
  console.error(`❌ Error: ${message}`)
  process.exit(1)
}

/**
 * Display success message
 * 
 * @param message - Success message
 */
export function showSuccess(message: string): void {
  console.log(`✅ ${message}`)
}

/**
 * Display warning message
 * 
 * @param message - Warning message
 */
export function showWarning(message: string): void {
  console.warn(`⚠️  ${message}`)
}

/**
 * Display info message
 * 
 * @param message - Info message
 */
export function showInfo(message: string): void {
  console.log(`ℹ️  ${message}`)
}

