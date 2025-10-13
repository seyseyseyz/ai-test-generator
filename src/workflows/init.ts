/**
 * Init 工作流：初始化配置文件
 */

import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { InitOptions } from '../types/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '../..')

/**
 * 初始化配置文件
 * @param options - 初始化选项
 */
export async function init(options: InitOptions): Promise<void> {
  const { config } = options
  const configPath = config || 'ai-test.config.jsonc'
  
  // 检查配置文件是否已存在
  if (existsSync(configPath)) {
    console.log(`⚠️  Config already exists: ${configPath}`)
    console.log('   Delete it first or use a different path with -c option')
    process.exit(1)
  }
  
  // 复制模板
  console.log('⚙️  Creating default config...')
  const templatePath = join(PKG_ROOT, 'templates', 'default.config.jsonc')
  
  try {
    copyFileSync(templatePath, configPath)
    console.log(`✅ Config created: ${configPath}`)
    
    // 显示下一步建议
    console.log('\n💡 Next steps:')
    console.log('   1. Review and customize the config (optional)')
    console.log('   2. Run `ai-test analyze` to let AI analyze your codebase')
    console.log('   3. Or run `ai-test scan` to start scoring immediately')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`❌ Failed to create config: ${message}`)
    process.exit(1)
  }
}
