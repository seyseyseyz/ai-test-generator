/**
 * Time and Random Mock Detection
 * @module mock/detectors-time
 */

// No imports needed for simplified detectors

/**
 * Format time-related call for detection (simplified)
 * 
 * @param callee - Function call expression
 * @returns Formatted call string
 */
export function formatTimeCall(callee: string): string {
  return callee
}

/**
 * Format Math.random call for detection (simplified)
 * 
 * @returns Formatted call string
 */
export function formatRandomCall(): string {
  return 'Math.random()'
}

