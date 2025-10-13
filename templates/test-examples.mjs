#!/usr/bin/env node
/**
 * Few-shot Test Examples - 测试示例库
 * 
 * 借鉴 Qodo Cover 的 Few-shot Learning 策略：
 * - 提供高质量测试示例
 * - 引导 AI 生成更规范的测试
 * - 按复杂度分类示例
 * 
 * Reference: Qodo Cover - Few-shot Prompt Templates
 */

/**
 * 简单纯函数示例
 */
export const PURE_FUNCTION_EXAMPLE = {
  category: 'pure_function',
  complexity: 'low',
  sourceCode: `
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  })
  return formatter.format(amount)
}
`.trim(),
  testCode: `
import { describe, it, expect } from '@jest/globals'
import { formatCurrency } from './format'

describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    expect(formatCurrency(100, 'USD')).toBe('$100.00')
  })
  
  it('should format EUR correctly', () => {
    expect(formatCurrency(100, 'EUR')).toBe('€100.00')
  })
  
  it('should handle zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00')
  })
  
  it('should handle negative numbers', () => {
    expect(formatCurrency(-50, 'USD')).toBe('-$50.00')
  })
  
  it('should default to USD when currency not specified', () => {
    expect(formatCurrency(100)).toBe('$100.00')
  })
})
`.trim()
}

/**
 * 异步函数示例
 */
export const ASYNC_FUNCTION_EXAMPLE = {
  category: 'async_function',
  complexity: 'medium',
  sourceCode: `
export async function fetchUserData(userId: string): Promise<User> {
  const response = await fetch(\`/api/users/\${userId}\`)
  
  if (!response.ok) {
    throw new Error(\`Failed to fetch user: \${response.statusText}\`)
  }
  
  const data = await response.json()
  return data
}
`.trim(),
  testCode: `
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { fetchUserData } from './api'

// Mock fetch
global.fetch = jest.fn()

describe('fetchUserData', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })
  
  it('should fetch user data successfully', async () => {
    const mockUser = { id: '123', name: 'John Doe' }
    
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser
    })
    
    const result = await fetchUserData('123')
    
    expect(fetch).toHaveBeenCalledWith('/api/users/123')
    expect(result).toEqual(mockUser)
  })
  
  it('should throw error when fetch fails', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found'
    })
    
    await expect(fetchUserData('999')).rejects.toThrow('Failed to fetch user: Not Found')
  })
  
  it('should handle network errors', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    
    await expect(fetchUserData('123')).rejects.toThrow('Network error')
  })
})
`.trim()
}

/**
 * 业务逻辑示例
 */
export const BUSINESS_LOGIC_EXAMPLE = {
  category: 'business_logic',
  complexity: 'high',
  sourceCode: `
export function calculateOrderTotal(
  items: CartItem[],
  coupon?: Coupon,
  shippingMethod: ShippingMethod = 'standard'
): OrderTotal {
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  
  // Apply coupon
  let discount = 0
  if (coupon) {
    discount = coupon.type === 'percentage'
      ? subtotal * (coupon.value / 100)
      : Math.min(coupon.value, subtotal)
  }
  
  // Calculate shipping
  const shipping = shippingMethod === 'express' ? 10 : 5
  
  // Calculate tax (10%)
  const taxableAmount = subtotal - discount
  const tax = taxableAmount * 0.1
  
  // Calculate total
  const total = taxableAmount + tax + shipping
  
  return {
    subtotal,
    discount,
    tax,
    shipping,
    total
  }
}
`.trim(),
  testCode: `
import { describe, it, expect } from '@jest/globals'
import { calculateOrderTotal } from './order'

describe('calculateOrderTotal', () => {
  const mockItems = [
    { id: '1', name: 'Item 1', price: 100, quantity: 2 },
    { id: '2', name: 'Item 2', price: 50, quantity: 1 }
  ]
  
  describe('without coupon', () => {
    it('should calculate total with standard shipping', () => {
      const result = calculateOrderTotal(mockItems, undefined, 'standard')
      
      expect(result.subtotal).toBe(250)
      expect(result.discount).toBe(0)
      expect(result.tax).toBe(25)
      expect(result.shipping).toBe(5)
      expect(result.total).toBe(280)
    })
    
    it('should calculate total with express shipping', () => {
      const result = calculateOrderTotal(mockItems, undefined, 'express')
      
      expect(result.shipping).toBe(10)
      expect(result.total).toBe(285)
    })
  })
  
  describe('with percentage coupon', () => {
    it('should apply 10% discount', () => {
      const coupon = { type: 'percentage', value: 10 }
      const result = calculateOrderTotal(mockItems, coupon, 'standard')
      
      expect(result.discount).toBe(25)
      expect(result.tax).toBe(22.5)  // (250 - 25) * 0.1
      expect(result.total).toBe(252.5)
    })
    
    it('should apply 50% discount', () => {
      const coupon = { type: 'percentage', value: 50 }
      const result = calculateOrderTotal(mockItems, coupon, 'standard')
      
      expect(result.discount).toBe(125)
      expect(result.tax).toBe(12.5)
      expect(result.total).toBe(142.5)
    })
  })
  
  describe('with fixed amount coupon', () => {
    it('should apply $30 discount', () => {
      const coupon = { type: 'fixed', value: 30 }
      const result = calculateOrderTotal(mockItems, coupon, 'standard')
      
      expect(result.discount).toBe(30)
      expect(result.tax).toBe(22)  // (250 - 30) * 0.1
      expect(result.total).toBe(247)
    })
    
    it('should not exceed subtotal', () => {
      const coupon = { type: 'fixed', value: 500 }
      const result = calculateOrderTotal(mockItems, coupon, 'standard')
      
      expect(result.discount).toBe(250)  // Capped at subtotal
      expect(result.tax).toBe(0)
      expect(result.total).toBe(5)  // Only shipping
    })
  })
  
  describe('edge cases', () => {
    it('should handle empty cart', () => {
      const result = calculateOrderTotal([], undefined, 'standard')
      
      expect(result.subtotal).toBe(0)
      expect(result.total).toBe(5)  // Only shipping
    })
    
    it('should handle single item', () => {
      const singleItem = [{ id: '1', name: 'Item', price: 10, quantity: 1 }]
      const result = calculateOrderTotal(singleItem, undefined, 'standard')
      
      expect(result.subtotal).toBe(10)
      expect(result.tax).toBe(1)
      expect(result.total).toBe(16)
    })
  })
})
`.trim()
}

/**
 * React Hook 示例
 */
export const REACT_HOOK_EXAMPLE = {
  category: 'react_hook',
  complexity: 'medium',
  sourceCode: `
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])
  
  return debouncedValue
}
`.trim(),
  testCode: `
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.useRealTimers()
  })
  
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    
    expect(result.current).toBe('initial')
  })
  
  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 500 } }
    )
    
    // Initial value
    expect(result.current).toBe('first')
    
    // Update value
    rerender({ value: 'second', delay: 500 })
    expect(result.current).toBe('first')  // Still old value
    
    // Fast-forward 499ms
    act(() => {
      jest.advanceTimersByTime(499)
    })
    expect(result.current).toBe('first')  // Still old value
    
    // Fast-forward 1ms (total 500ms)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('second')  // New value!
  })
  
  it('should cancel previous timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    )
    
    // Rapid changes
    rerender({ value: 'b' })
    act(() => jest.advanceTimersByTime(200))
    
    rerender({ value: 'c' })
    act(() => jest.advanceTimersByTime(200))
    
    rerender({ value: 'd' })
    act(() => jest.advanceTimersByTime(200))
    
    expect(result.current).toBe('a')  // No updates yet
    
    // Complete the delay
    act(() => {
      jest.advanceTimersByTime(300)
    })
    
    expect(result.current).toBe('d')  // Only last value
  })
})
`.trim()
}

/**
 * 根据目标函数特征选择最佳示例
 */
export function selectBestExample(target) {
  const { layer, complexity, isPure, hasAsync, isReactComponent } = target
  
  // React 组件/Hook
  if (isReactComponent || layer === 'UI') {
    return REACT_HOOK_EXAMPLE
  }
  
  // 异步函数
  if (hasAsync) {
    return ASYNC_FUNCTION_EXAMPLE
  }
  
  // 纯函数
  if (isPure && complexity < 5) {
    return PURE_FUNCTION_EXAMPLE
  }
  
  // 业务逻辑
  if (layer === 'Business Logic' || complexity >= 5) {
    return BUSINESS_LOGIC_EXAMPLE
  }
  
  // 默认：纯函数示例
  return PURE_FUNCTION_EXAMPLE
}

/**
 * 生成 Few-shot Prompt
 */
export function generateFewShotPrompt(target) {
  const example = selectBestExample(target)
  
  return `
## Example Test (for reference)

**Category**: ${example.category}
**Complexity**: ${example.complexity}

### Source Code:
\`\`\`typescript
${example.sourceCode}
\`\`\`

### Test Code:
\`\`\`typescript
${example.testCode}
\`\`\`

## Key Patterns to Follow:

1. **Clear describe blocks**: Group related tests
2. **Descriptive test names**: Use "should..." format
3. **AAA Pattern**: Arrange, Act, Assert
4. **Edge cases**: Test boundary conditions
5. **Mock external dependencies**: Keep tests isolated
6. **Async handling**: Use async/await properly
7. **Cleanup**: Use afterEach for mocks

---

Now generate a test for the following function following the same patterns:
`.trim()
}

/**
 * 所有示例列表
 */
export const ALL_EXAMPLES = [
  PURE_FUNCTION_EXAMPLE,
  ASYNC_FUNCTION_EXAMPLE,
  BUSINESS_LOGIC_EXAMPLE,
  REACT_HOOK_EXAMPLE
]

