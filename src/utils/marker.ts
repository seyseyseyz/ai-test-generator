#!/usr/bin/env node
/**
 * 批量标记 ut_scores.md 中的完成状态
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { TestStatusMarker } from '../types/utils.js'

/**
 * Mark options
 */
interface MarkOptions {
  reportPath?: string
  status?: TestStatusMarker
  dryRun?: boolean
}

/**
 * Priority statistics
 */
interface PriorityStats {
  total: number
  done: number
  todo: number
}

/**
 * Progress statistics
 */
interface ProgressStats {
  total: number
  todo: number
  done: number
  skip: number
  priorities: Record<string, PriorityStats>
}

/**
 * Mark result
 */
interface MarkResult {
  success: string[]
  notFound: string[]
  stats: ProgressStats
}

/**
 * 标记函数为完成状态
 */
export function markDone(functionNames: string[], options: MarkOptions = {}): MarkResult {
  const { 
    reportPath = 'reports/ut_scores.md',
    status = 'DONE',
    dryRun = false 
  } = options
  
  if (!existsSync(reportPath)) {
    throw new Error(`报告文件不存在: ${reportPath}`);
  }
  
  let content = readFileSync(reportPath, 'utf8');
  
  const results: { success: string[], notFound: string[] } = {
    success: [],
    notFound: []
  };
  
  functionNames.forEach(name => {
    // 匹配 | TODO | [score] | [priority] | [name] | 格式
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `\\| TODO (\\| [^|]+ \\| [^|]+ \\| ${escapedName} \\|)`,
      'g'
    );
    
    const newContent = content.replace(regex, `| ${status} $1`);
    
    if (newContent !== content) {
      results.success.push(name);
      content = newContent;
    } else {
      results.notFound.push(name);
    }
  });
  
  if (!dryRun && results.success.length > 0) {
    writeFileSync(reportPath, content);
  }
  
  // 统计进度
  const lines = content.split('\n');
  const todoCount = lines.filter(l => l.includes('| TODO |')).length;
  const doneCount = lines.filter(l => l.includes('| DONE |')).length;
  const skipCount = lines.filter(l => l.includes('| SKIP |')).length;
  const total = todoCount + doneCount + skipCount;
  
  // 按优先级统计
  const priorities = ['P0', 'P1', 'P2', 'P3'];
  const priorityStats: Record<string, PriorityStats> = {};
  priorities.forEach(p => {
    const pTotal = lines.filter(l => l.includes(`| ${p} |`)).length;
    const pDone = lines.filter(l => l.includes('| DONE |') && l.includes(`| ${p} |`)).length;
    const pTodo = lines.filter(l => l.includes('| TODO |') && l.includes(`| ${p} |`)).length;
    if (pTotal > 0) {
      priorityStats[p] = { total: pTotal, done: pDone, todo: pTodo };
    }
  });
  
  return {
    ...results,
    stats: {
      total,
      todo: todoCount,
      done: doneCount,
      skip: skipCount,
      priorities: priorityStats
    }
  };
}

/**
 * CLI 入口
 */
export function runCLI(argv: string[] = process.argv): void {
  const args = argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 缺少参数\n');
    console.error('用法:');
    console.error('  ut-score mark-done <function-names> [options]\n');
    console.error('参数:');
    console.error('  function-names    函数名列表（逗号或空格分隔）\n');
    console.error('选项:');
    console.error('  --report PATH     报告文件路径 (默认: reports/ut_scores.md)');
    console.error('  --status STATUS   标记状态 (默认: DONE, 可选: SKIP)');
    console.error('  --dry-run         仅显示将要修改的内容，不实际写入\n');
    console.error('示例:');
    console.error('  ut-score mark-done disableDragBack getMediumScale');
    console.error('  ut-score mark-done "formatToDate,handleQuery"');
    console.error('  ut-score mark-done func1 --status SKIP');
    process.exit(1);
  }
  
  // 解析参数
  const options: MarkOptions & { dryRun?: boolean } = { 
    reportPath: 'reports/ut_scores.md', 
    status: 'DONE' as TestStatusMarker
  };
  const names: string[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--report') {
      options.reportPath = args[++i] || 'reports/ut_scores.md';
    } else if (arg === '--status') {
      options.status = (args[++i] as TestStatusMarker) || 'DONE';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg) {
      names.push(arg);
    }
  }
  
  // 解析函数名（支持逗号分隔和空格分隔）
  const functionNames = names.join(' ').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  
  if (functionNames.length === 0) {
    console.error('❌ 没有指定函数名');
    process.exit(1);
  }
  
  try {
    console.log(`🔍 准备标记 ${functionNames.length} 个函数为 ${options.status}...\n`);
    
    const result = markDone(functionNames, options);
    
    if (result.success.length > 0) {
      console.log(`✅ 成功标记 ${result.success.length} 个函数为 ${options.status}:`);
      result.success.forEach(name => console.log(`   - ${name}`));
      console.log('');
    }
    
    if (result.notFound.length > 0) {
      console.log(`⚠️  未找到 ${result.notFound.length} 个函数（可能已标记或不存在）:`);
      result.notFound.forEach(name => console.log(`   - ${name}`));
      console.log('');
    }
    
    // 显示进度
    const { stats } = result;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 当前进度:');
    console.log(`   总计: ${stats.total}`);
    console.log(`   已完成: ${stats.done} (${(stats.done / stats.total * 100).toFixed(1)}%)`);
    console.log(`   待完成: ${stats.todo}`);
    if (stats.skip > 0) {
      console.log(`   已跳过: ${stats.skip}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 按优先级统计
    if (Object.keys(stats.priorities).length > 0) {
      console.log('');
      console.log('📈 按优先级统计:');
      Object.entries(stats.priorities).forEach(([p, data]: [string, PriorityStats]) => {
        console.log(`   ${p}: ${data.done}/${data.total} 完成，${data.todo} 待处理`);
      });
    }
    
    if (options.dryRun) {
      console.log('');
      console.log('ℹ️  Dry-run 模式，未实际修改文件');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ 错误: ${message}`);
    process.exit(1);
  }
}

// 作为脚本直接运行时
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI();
}

