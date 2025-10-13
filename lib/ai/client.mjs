#!/usr/bin/env node
/**
 * 使用 cursor-agent 生成 AI 回复
 * - 从文件或 stdin 读取 prompt
 * - 通过 cursor-agent chat 调用模型
 * - 将回复写入到输出文件
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { spawn } from 'child_process'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split('=') : [a, argv[i + 1]]
      args[k.replace(/^--/, '')] = v === undefined || v.startsWith('--') ? true : v
      if (v !== undefined && !v.startsWith('--') && !a.includes('=')) i++
    }
  }
  return args
}

export async function runOnce({ prompt, promptFile, out = 'reports/ai_response.txt', model, temperature = 0.4, timeoutSec = 600 }) {
  if (!prompt) {
    if (!promptFile || !existsSync(promptFile)) throw new Error(`Prompt file not found: ${promptFile}`)
    prompt = readFileSync(promptFile, 'utf8')
  }

  return new Promise((resolve, reject) => {
    const args = ['--print']
    if (model) args.push('-m', model)
    // Meta 研究发现: temperature 0.4 比 0.0 成功率高 25%
    if (temperature !== undefined) args.push('--temperature', String(temperature))

    const child = spawn('cursor-agent', args, { stdio: ['pipe', 'pipe', 'inherit'] })

    const chunks = []
    child.stdout.on('data', d => chunks.push(Buffer.from(d)))

    // 写入 prompt 到 stdin
    child.stdin.write(prompt)
    child.stdin.end()

    const to = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`cursor-agent timeout after ${timeoutSec}s`))
    }, Number(timeoutSec) * 1000)

    child.on('close', code => {
      clearTimeout(to)
      const outText = Buffer.concat(chunks).toString('utf8')
      try { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, outText) } catch {}
      if (code !== 0) return reject(new Error(`cursor-agent exited with code ${code}`))
      resolve({ out, bytes: outText.length })
    })
    child.on('error', reject)
  })
}

export async function runCLI(argv = process.argv) {
  const args = parseArgs(argv)
  // 支持 --prompt, --prompt-file, --promptFile 三种形式
  const promptFile = args['prompt'] || args['prompt-file'] || args['promptFile'] || null
  const out = args['out'] || 'reports/ai_response.txt'
  const model = args['model'] || null
  const temperature = args['temperature'] ? Number(args['temperature']) : 0.4  // Meta 最佳实践
  const timeoutSec = args['timeout'] ? Number(args['timeout']) : 600

  try {
    await runOnce({ promptFile, out, model, temperature, timeoutSec })
    console.log(`✅ AI response saved: ${out}`)
  } catch (err) {
    console.error(`❌ AI generate failed: ${err.message}`)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) runCLI()


