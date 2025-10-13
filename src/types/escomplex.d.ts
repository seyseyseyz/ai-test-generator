declare module 'escomplex' {
  export function analyzeModule(source: string): {
    aggregate: {
      cyclomatic: number
      complexity: number
    }
  }
}

