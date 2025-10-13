#!/usr/bin/env node
/**
 * 从 AI 回复中提取测试文件并自动创建
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

interface ExtractOptions {
  overwrite?: boolean
  dryRun?: boolean
}

interface TestFile {
  path: string
  code?: string
  dryRun?: boolean
  reason?: string
  error?: string
}

interface ExtractResult {
  created: TestFile[]
  skipped: TestFile[]
  errors: TestFile[]
}

/**
 * 从 AI 响应中提取测试文件
 */
export function extractTests(content: string, options: ExtractOptions = {}): ExtractResult {
  const { overwrite = false, dryRun = false } = options;

  // 先尝试解析 JSON Manifest（优先）
  // 形如：```json { version: 1, files: [{ path, source, ... }] }
  let manifest: any = null;
  const manifestRegex = /```json\s*\n([\s\S]*?)\n```/gi;
  let m: RegExpExecArray | null;
  while ((m = manifestRegex.exec(content)) !== null) {
    const jsonStr = m[1]?.trim() || '';
    try {
      const obj = JSON.parse(jsonStr);
      if (obj && Array.isArray(obj.files)) {
        manifest = obj;
        break;
      }
    } catch {}
  }
  const manifestPaths = manifest?.files?.map((f: any) => String(f.path).trim()) ?? [];

  // 再匹配多种文件代码块格式（回退/兼容，增强鲁棒性）
  const patterns = [
    // 格式1: ### 测试文件: path (有/无反引号)
    /###\s*测试文件\s*[:：]\s*`?([^\n`]+?)`?\s*\n```(?:typescript|ts|tsx|javascript|js|jsx|json|text)?\s*\n([\s\S]*?)\n```/gi,
    // 格式2: **测试文件**: path
    /\*\*测试文件\*\*\s*[:：]\s*`?([^\n`]+)`?\s*\n```(?:typescript|ts|tsx|javascript|js|jsx|json|text)?\s*\n([\s\S]*?)\n```/gi,
    // 格式3: 文件路径: path
    /文件路径\s*[:：]\s*`?([^\n`]+)`?\s*\n```(?:typescript|ts|tsx|javascript|js|jsx|json|text)?\s*\n([\s\S]*?)\n```/gi,
    // 格式4: # path.test.ts (仅文件名标题)
    /^#+\s+([^\n]+\.test\.[jt]sx?)\s*\n```(?:typescript|ts|tsx|javascript|js|jsx)?\s*\n([\s\S]*?)\n```/gim,
    // 格式5: 更宽松的匹配（任意"path"后接代码块，路径必须含 .test.）
    /(?:path|文件|file)\s*[:：]?\s*`?([^\n`]*\.test\.[jt]sx?[^\n`]*?)`?\s*\n```(?:typescript|ts|tsx|javascript|js|jsx)?\s*\n([\s\S]*?)\n```/gi,
  ];

  const created: TestFile[] = [];
  const skipped: TestFile[] = [];
  const errors: TestFile[] = [];

  patterns.forEach(fileRegex => {
    let match: RegExpExecArray | null;
    while ((match = fileRegex.exec(content)) !== null) {
      const [, filePath, testCode] = match;
      const cleanPath = (filePath || '').trim();

      // 若存在 Manifest，则只允许清单内的路径
      if (manifestPaths.length > 0 && !manifestPaths.includes(cleanPath)) {
        continue;
      }

      // 跳过已处理的文件
      if (created.some(f => f.path === cleanPath) || 
          skipped.some(f => f.path === cleanPath)) {
        continue;
      }

      // 检查文件是否已存在
      if (existsSync(cleanPath) && !overwrite) {
        skipped.push({ path: cleanPath, reason: 'exists' });
        continue;
      }

      if (dryRun) {
        created.push({ path: cleanPath, code: (testCode || '').trim(), dryRun: true });
        continue;
      }

      try {
        // 确保目录存在
        mkdirSync(dirname(cleanPath), { recursive: true });

        // 写入测试文件
        const cleanCode = (testCode || '').trim();
        writeFileSync(cleanPath, cleanCode + '\n');
        created.push({ path: cleanPath, code: cleanCode });
      } catch (err: unknown) {
        const error = err as Error
        errors.push({ path: cleanPath, error: error?.message || String(err) });
      }
    }
  });

  // 若有 Manifest 但未生成任何文件，则报告可能缺失代码块
  if (manifestPaths.length > 0) {
    const createdPaths = new Set(created.map(f => f.path));
    const missing = manifestPaths.filter((p: string) => !createdPaths.has(p));
    missing.forEach((p: string) => errors.push({ path: p, error: 'missing code block for manifest entry' }));
  }

  return { created, skipped, errors };
}

/**
 * CLI 入口
 */
export function runCLI(argv: string[] = process.argv): void {
  const args = argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 缺少参数\n');
    console.error('用法: ai-test extract-tests <response-file> [options]\n');
    console.error('选项:');
    console.error('  --overwrite    覆盖已存在的文件');
    console.error('  --dry-run      仅显示将要创建的文件，不实际写入\n');
    console.error('示例:');
    console.error('  ai-test extract-tests response.txt');
    console.error('  ai-test extract-tests response.txt --overwrite');
    process.exit(1);
  }
  
  const responseFile = args[0] || '';
  const options: ExtractOptions = {
    overwrite: args.includes('--overwrite'),
    dryRun: args.includes('--dry-run')
  };
  
  if (!responseFile || !existsSync(responseFile)) {
    console.error(`❌ 文件不存在: ${responseFile}`);
    process.exit(1);
  }
  
  try {
    const content = readFileSync(responseFile, 'utf8');
    const { created, skipped, errors } = extractTests(content, options);
    
    // 输出结果
    created.forEach(f => {
      if (f.dryRun) {
        console.log(`[DRY-RUN] 将创建: ${f.path}`);
      } else {
        console.log(`✅ 创建测试文件: ${f.path}`);
      }
    });
    
    skipped.forEach(f => {
      if (f.reason === 'exists') {
        console.log(`⚠️  跳过（已存在）: ${f.path}`);
      }
    });
    
    errors.forEach(f => {
      console.error(`❌ 创建失败: ${f.path} - ${f.error}`);
    });
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✨ 总共创建 ${created.length} 个测试文件`);
    if (skipped.length > 0) {
      console.log(`⚠️  跳过 ${skipped.length} 个已存在的文件`);
    }
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} 个文件创建失败`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    if (created.length > 0 && !options.dryRun) {
      console.log('🧪 运行测试:');
      console.log('   npm test');
      console.log('');
      console.log('📝 标记完成（如需）:');
      const functionNames = created
        .map(f => f.path.match(/\/([^/]+)\.test\./)?.[1])
        .filter(Boolean)
        .join(',');
      if (functionNames) {
        console.log(`   ai-test mark-done "${functionNames}"`);
      }
    } else if (created.length === 0) {
      console.log('❌ 未找到任何测试文件');
      console.log('');
      console.log('请检查 AI 回复格式是否正确。预期格式：');
      console.log('  ### 测试文件: src/utils/xxx.test.ts');
      console.log('  ```typescript');
      console.log('  // 测试代码');
      console.log('  ```');
    }
    
    process.exit(errors.length > 0 ? 1 : 0);
  } catch (err: unknown) {
    const error = err as Error
    console.error(`❌ 错误: ${error?.message || String(err)}`);
    process.exit(1);
  }
}

// 作为脚本直接运行时
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI();
}

