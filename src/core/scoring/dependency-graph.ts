/**
 * 依赖图构建器
 */

import type { Project } from 'ts-morph'
import type { ScoringConfig, DependencyGraph } from './types.js'

/**
 * 构建项目依赖图
 */
export function buildDepGraph(
  project: Project,
  _cfg?: ScoringConfig
): DependencyGraph {
  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: new Map()
  }
  
  try {
    const sourceFiles = project.getSourceFiles()
    
    for (const sf of sourceFiles) {
      const filePath = sf.getFilePath()
      
      // 获取导入
      const imports: string[] = []
      for (const imp of sf.getImportDeclarations()) {
        const moduleSpecifier = imp.getModuleSpecifierValue()
        if (moduleSpecifier) {
          imports.push(moduleSpecifier)
        }
      }
      
      // 获取导出
      const exports: string[] = []
      for (const exp of sf.getExportDeclarations()) {
        const moduleSpecifier = exp.getModuleSpecifierValue()
        if (moduleSpecifier) {
          exports.push(moduleSpecifier)
        }
      }
      
      // 添加节点
      graph.nodes.set(filePath, {
        filePath,
        imports,
        exports
      })
      
      // 添加边
      if (!graph.edges.has(filePath)) {
        graph.edges.set(filePath, new Set())
      }
      
      for (const imp of imports) {
        const edges = graph.edges.get(filePath)
        if (edges) {
          edges.add(imp)
        }
      }
    }
  } catch (error) {
    console.error('Failed to build dependency graph:', error)
  }
  
  return graph
}

/**
 * 获取文件的依赖数量
 */
export function getDependencyCount(
  filePath: string,
  graph: DependencyGraph
): number {
  const edges = graph.edges.get(filePath)
  return edges ? edges.size : 0
}

/**
 * 获取文件的依赖者数量（被多少文件依赖）
 */
export function getDependentCount(
  filePath: string,
  graph: DependencyGraph
): number {
  let count = 0
  
  for (const [, edges] of graph.edges) {
    if (edges.has(filePath)) {
      count++
    }
  }
  
  return count
}

