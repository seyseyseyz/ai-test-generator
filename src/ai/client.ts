#!/usr/bin/env node
/**
 * 使用 cursor-agent 生成 AI 回复
 * - 从文件或 stdin 读取 prompt
 * - 通过 cursor-agent chat 调用模型
 * - 将回复写入到输出文件
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { spawn } from 'node:child_process'

interface ParsedArgs {
  [key: string]: string | boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a && a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split('=') : [a, argv[i + 1]]
      if (k) {
        args[k.replace(/^--/, '')] = v === undefined || (v && v.startsWith('--')) ? true : v
      }
      if (v !== undefined && v && !v.startsWith('--') && !a.includes('=')) i++
    }
  }
  return args
}

interface RunOnceOptions {
  prompt?: string
  promptFile?: string
  out?: string
  model?: string
  temperature?: number
  timeoutSec?: number
}

interface RunOnceResult {
  out: string
  bytes: number
}

export async function runOnce({ prompt, promptFile, out = 'reports/ai_response.txt', model, temperature = 0.4, timeoutSec = 600 }: RunOnceOptions): Promise<RunOnceResult> {
  let finalPrompt = prompt
  if (!finalPrompt) {
    if (!promptFile || !existsSync(promptFile)) throw new Error(`Prompt file not found: ${promptFile}`)
    finalPrompt = readFileSync(promptFile, 'utf8')
  }

  return new Promise((resolve, reject) => {
    const args = ['--print']
    if (model) args.push('-m', model)
    // Meta 研究发现: temperature 0.4 比 0.0 成功率高 25%
    if (temperature !== undefined) args.push('--temperature', String(temperature))

    const child = spawn('cursor-agent', args, { stdio: ['pipe', 'pipe', 'inherit'] })

    const chunks: Buffer[] = []
    child.stdout.on('data', (d: Buffer) => chunks.push(d))

    // 写入 prompt 到 stdin
    child.stdin.write(finalPrompt)
    child.stdin.end()

    const to = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`cursor-agent timeout after ${timeoutSec}s`))
    }, Number(timeoutSec) * 1000)

    child.on('close', code => {
      clearTimeout(to)
      const outText = Buffer.concat(chunks).toString('utf8')
      try { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, outText) } catch {
        // Ignore write errors
      }
      if (code !== 0) return reject(new Error(`cursor-agent exited with code ${code}`))
      resolve({ out, bytes: outText.length })
    })
    child.on('error', reject)
  })
}

export async function runCLI(argv: string[] = process.argv): Promise<void> {
  const args = parseArgs(argv)
  // 支持 --prompt, --prompt-file, --promptFile 三种形式
  const promptFile = (args['prompt'] || args['prompt-file'] || args['promptFile'] || null) as string | null
  const out = (args['out'] || 'reports/ai_response.txt') as string
  const model = (args['model'] || null) as string | null
  const temperature = args['temperature'] ? Number(args['temperature']) : 0.4  // Meta 最佳实践
  const timeoutSec = args['timeout'] ? Number(args['timeout']) : 600

  try {
    await runOnce({ promptFile: promptFile || undefined, out, model: model || undefined, temperature, timeoutSec })
    console.log(`✅ AI response saved: ${out}`)
  } catch (err: unknown) {
    const error = err as Error
    console.error(`❌ AI generate failed: ${error?.message || String(err)}`)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) runCLI()


