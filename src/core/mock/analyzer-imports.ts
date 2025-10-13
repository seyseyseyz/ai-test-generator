/**
 * Import Analysis
 * @module mock/analyzer-imports
 */

import type { ImportAnalysis, SourceFile } from './types.js'

/**
 * Analyze imports to detect external dependencies
 * 
 * @param sourceFile - Source file AST node
 * @returns Import analysis result
 * 
 * @example
 * ```typescript
 * const imports = analyzeImports(sourceFile)
 * if (imports.axios) {
 *   console.log('File uses axios')
 * }
 * ```
 */
export function analyzeImports(sourceFile: SourceFile): ImportAnalysis {
  const imports = sourceFile.getImportDeclarations()
  const modules = new Set<string>()
  
  for (const imp of imports) {
    const moduleSpecifier = imp.getModuleSpecifierValue()
    modules.add(moduleSpecifier)
  }
  
  return {
    modules,
    axios: modules.has('axios'),
    fetch: false, // fetch is global
    mongoose: modules.has('mongoose'),
    typeorm: modules.has('typeorm') || modules.has('@mikro-orm/core'),
    sequelize: modules.has('sequelize'),
    redis: modules.has('redis') || modules.has('ioredis'),
    fs: modules.has('fs') || modules.has('node:fs') || modules.has('fs/promises')
  }
}

