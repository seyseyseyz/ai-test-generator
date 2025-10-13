/**
 * 项目上下文构建工具
 */

import { existsSync, readFileSync } from 'node:fs'
import type { Dependencies, FrameworkInfo, ProjectContext } from '../types/project-context.js'

/**
 * 构建项目上下文信息
 */
export async function buildProjectContext(): Promise<ProjectContext> {
  const context: ProjectContext = {
    framework: 'Unknown',
    platforms: [],
    uiLibraries: [],
    stateManagement: [],
    criticalDeps: [],
    devDeps: [],
    testingTools: []
  }
  
  // 读取 package.json
  if (existsSync('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      
      context.name = pkg.name
      
      // 检测框架和平台
      const frameworkInfo = detectFramework(allDeps)
      context.framework = frameworkInfo.framework
      context.platforms = frameworkInfo.platforms
      
      // 检测 UI 库
      context.uiLibraries = detectUILibraries(allDeps)
      
      // 检测状态管理
      context.stateManagement = detectStateManagement(allDeps)
      
      // 检测测试工具
      context.testingTools = detectTestingTools(allDeps)
      
      // 识别关键业务依赖
      const deps = Object.keys(pkg.dependencies || {})
      const criticalKeywords = [
        'stripe', 'payment', 'paypal', 'checkout',
        'auth', 'jwt', 'passport', 'oauth',
        'prisma', 'typeorm', 'sequelize', 'mongoose', 'db', 'sql',
        'axios', 'fetch', 'request', 'graphql', 'apollo',
        'socket', 'websocket', 'pusher', 'firebase',
        'sentry', 'datadog', 'analytics'
      ]
      
      context.criticalDeps = deps.filter(dep => 
        criticalKeywords.some(kw => dep.toLowerCase().includes(kw))
      )
      
      context.devDeps = Object.keys(pkg.devDependencies || {})
    } catch {
      console.warn('Warning: Could not read package.json')
    }
  }
  
  return context
}

/**
 * 检测项目框架和平台
 */
function detectFramework(deps: Dependencies): FrameworkInfo {
  const result: FrameworkInfo = {
    framework: 'Unknown',
    platforms: []
  }
  
  // 检测 React Native
  const hasRN = deps['react-native'] || deps['@react-native'] || deps['expo']
  
  // 检测 Next.js
  const hasNext = deps['next']
  
  // 检测 React
  const hasReact = deps['react']
  
  // 检测 Vue
  const hasVue = deps['vue'] || deps['@vue/core']
  const hasNuxt = deps['nuxt']
  
  // 检测 Angular
  const hasAngular = deps['@angular/core']
  
  // 检测 Svelte
  const hasSvelte = deps['svelte']
  const hasSvelteKit = deps['@sveltejs/kit']
  
  // 检测 Taro (跨端框架)
  const hasTaro = deps['@tarojs/taro'] || deps['@tarojs/runtime']
  
  // 检测 Electron
  const hasElectron = deps['electron']
  
  // 组合判断
  if (hasTaro) {
    result.framework = 'Taro'
    result.platforms.push('Mini-Program', 'H5', 'RN')
    if (hasReact) result.framework = 'Taro (React)'
    if (hasVue) result.framework = 'Taro (Vue)'
  } else if (hasRN && hasNext) {
    result.framework = 'React Native + Next.js (Monorepo)'
    result.platforms.push('iOS', 'Android', 'Web')
  } else if (hasRN) {
    result.framework = 'React Native'
    result.platforms.push('iOS', 'Android')
    if (deps['expo']) result.framework = 'React Native (Expo)'
  } else if (hasNext) {
    result.framework = 'Next.js'
    result.platforms.push('Web', 'SSR')
  } else if (hasSvelteKit) {
    result.framework = 'SvelteKit'
    result.platforms.push('Web', 'SSR')
  } else if (hasNuxt) {
    result.framework = 'Nuxt.js'
    result.platforms.push('Web', 'SSR')
  } else if (hasAngular) {
    result.framework = 'Angular'
    result.platforms.push('Web')
  } else if (hasSvelte) {
    result.framework = 'Svelte'
    result.platforms.push('Web')
  } else if (hasVue) {
    result.framework = 'Vue'
    result.platforms.push('Web')
  } else if (hasReact) {
    result.framework = 'React'
    result.platforms.push('Web')
  } else if (hasElectron) {
    result.framework = 'Electron'
    result.platforms.push('Desktop')
  } else if (Object.keys(deps).length > 0) {
    result.framework = 'Node.js'
    result.platforms.push('Backend')
  }
  
  return result
}

/**
 * 检测 UI 库
 */
function detectUILibraries(deps: Dependencies): string[] {
  const uiLibs = []
  
  if (deps['antd']) uiLibs.push('Ant Design')
  if (deps['@mui/material'] || deps['@material-ui/core']) uiLibs.push('Material-UI')
  if (deps['@chakra-ui/react']) uiLibs.push('Chakra UI')
  if (deps['@radix-ui/react-dialog']) uiLibs.push('Radix UI')
  if (deps['tailwindcss']) uiLibs.push('Tailwind CSS')
  if (deps['styled-components']) uiLibs.push('styled-components')
  if (deps['@emotion/react']) uiLibs.push('Emotion')
  if (deps['bootstrap']) uiLibs.push('Bootstrap')
  if (deps['semantic-ui-react']) uiLibs.push('Semantic UI')
  if (deps['react-native-paper']) uiLibs.push('React Native Paper')
  if (deps['native-base']) uiLibs.push('NativeBase')
  
  return uiLibs
}

/**
 * 检测状态管理
 */
function detectStateManagement(deps: Dependencies): string[] {
  const stateLibs = []
  
  if (deps['jotai']) stateLibs.push('Jotai')
  if (deps['zustand']) stateLibs.push('Zustand')
  if (deps['redux'] || deps['@reduxjs/toolkit']) stateLibs.push('Redux')
  if (deps['mobx'] || deps['mobx-react']) stateLibs.push('MobX')
  if (deps['recoil']) stateLibs.push('Recoil')
  if (deps['xstate'] || deps['@xstate/react']) stateLibs.push('XState')
  if (deps['valtio']) stateLibs.push('Valtio')
  if (deps['@tanstack/react-query']) stateLibs.push('TanStack Query')
  if (deps['swr']) stateLibs.push('SWR')
  if (deps['apollo-client'] || deps['@apollo/client']) stateLibs.push('Apollo Client')
  
  return stateLibs
}

/**
 * 检测测试工具
 */
function detectTestingTools(deps: Dependencies): string[] {
  const testTools = []
  
  if (deps['jest']) testTools.push('Jest')
  if (deps['vitest']) testTools.push('Vitest')
  if (deps['@testing-library/react']) testTools.push('@testing-library/react')
  if (deps['@testing-library/react-native']) testTools.push('@testing-library/react-native')
  if (deps['enzyme']) testTools.push('Enzyme')
  if (deps['cypress']) testTools.push('Cypress')
  if (deps['playwright']) testTools.push('Playwright')
  if (deps['@playwright/test']) testTools.push('Playwright')
  
  return testTools
}

