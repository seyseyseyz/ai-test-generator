/**
 * Project context and dependency types
 * @packageDocumentation
 */

/**
 * Package dependencies (name -> version)
 */
export type Dependencies = Record<string, string>

/**
 * Framework detection result
 */
export interface FrameworkInfo {
  framework: string
  platforms: string[]
}

/**
 * Project context extracted from package.json and code analysis
 */
export interface ProjectContext {
  name?: string
  framework: string
  platforms: string[]
  uiLibraries: string[]
  stateManagement: string[]
  criticalDeps: string[]
  devDeps: string[]
  testingTools: string[]
}

