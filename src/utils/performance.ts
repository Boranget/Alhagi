export interface PerformanceMetrics {
  setMarkdownCalls: number
  switchTabCalls: number
  totalSetMarkdownTime: number
  totalSwitchTabTime: number
  averageSetMarkdownTime: number
  averageSwitchTabTime: number
  pollingRuns: number
  pollingErrors: number
  lastPollingTime: number
  editorReadyTime: number
  initializationTime: number
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    setMarkdownCalls: 0,
    switchTabCalls: 0,
    totalSetMarkdownTime: 0,
    totalSwitchTabTime: 0,
    averageSetMarkdownTime: 0,
    averageSwitchTabTime: 0,
    pollingRuns: 0,
    pollingErrors: 0,
    lastPollingTime: 0,
    editorReadyTime: 0,
    initializationTime: 0
  }

  private marks: Map<string, number> = new Map()

  measure(name: string): void {
    this.marks.set(name, performance.now())
  }

  measureEnd(name: string): number {
    const start = this.marks.get(name)
    if (!start) {
      console.warn(`Performance mark '${name}' not found`)
      return 0
    }
    const duration = performance.now() - start
    this.marks.delete(name)
    return duration
  }

  recordSetMarkdown(duration: number): void {
    this.metrics.setMarkdownCalls++
    this.metrics.totalSetMarkdownTime += duration
    this.metrics.averageSetMarkdownTime = 
      this.metrics.totalSetMarkdownTime / this.metrics.setMarkdownCalls
  }

  recordSwitchTab(duration: number): void {
    this.metrics.switchTabCalls++
    this.metrics.totalSwitchTabTime += duration
    this.metrics.averageSwitchTabTime = 
      this.metrics.totalSwitchTabTime / this.metrics.switchTabCalls
  }

  recordPolling(): void {
    this.metrics.pollingRuns++
    this.metrics.lastPollingTime = performance.now()
  }

  recordPollingError(): void {
    this.metrics.pollingErrors++
  }

  recordEditorReady(): void {
    this.metrics.editorReadyTime = performance.now()
  }

  recordInitialization(duration: number): void {
    this.metrics.initializationTime = duration
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getSummary(): string {
    return `
Editor Performance Summary:
=========================
SetMarkdown: ${this.metrics.setMarkdownCalls} calls, avg ${this.metrics.averageSetMarkdownTime.toFixed(2)}ms
SwitchTab: ${this.metrics.switchTabCalls} calls, avg ${this.metrics.averageSwitchTabTime.toFixed(2)}ms
Polling: ${this.metrics.pollingRuns} runs, ${this.metrics.pollingErrors} errors
Initialization: ${this.metrics.initializationTime.toFixed(2)}ms
    `.trim()
  }

  reset(): void {
    this.metrics = {
      setMarkdownCalls: 0,
      switchTabCalls: 0,
      totalSetMarkdownTime: 0,
      totalSwitchTabTime: 0,
      averageSetMarkdownTime: 0,
      averageSwitchTabTime: 0,
      pollingRuns: 0,
      pollingErrors: 0,
      lastPollingTime: 0,
      editorReadyTime: 0,
      initializationTime: 0
    }
    this.marks.clear()
  }
}

export class LRUCache<T> {
  private cache: Map<string, T> = new Map()
  private readonly maxSize: number

  constructor(maxSize: number = 10) {
    this.maxSize = maxSize
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  keys(): IterableIterator<string> {
    return this.cache.keys()
  }

  getAll(): Map<string, T> {
    return new Map(this.cache)
  }
}

export class Debouncer {
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  debounce(fn: Function, delay: number): (...args: any[]) => void {
    return (...args: any[]) => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
      }
      this.timeoutId = setTimeout(() => {
        fn(...args)
        this.timeoutId = null
      }, delay)
    }
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

export class Throttler {
  private lastRun = 0
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  throttle(fn: Function, limit: number): (...args: any[]) => void {
    return (...args: any[]) => {
      const now = Date.now()
      if (now - this.lastRun >= limit) {
        this.lastRun = now
        fn(...args)
      } else {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId)
        }
        this.timeoutId = setTimeout(() => {
          this.lastRun = Date.now()
          fn(...args)
        }, limit - (now - this.lastRun))
      }
    }
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

export const performanceMonitor = new PerformanceMonitor()
