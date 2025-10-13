/**
 * Utils 模块：通用工具函数
 * 
 * 提供跨模块使用的工具函数
 * @packageDocumentation
 */

export { markDone, runCLI as runMarkerCLI } from './marker.js'
export * from './config-manager.js'
export * from './scan-manager.js'
export * from './action-logger.js'
export * from './file-guard.js'
export * from './backup-manager.js'

// 可以在未来添加更多工具函数
// export { readJson, writeJson } from './file-io.js'

