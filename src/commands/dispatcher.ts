// ============================================================
// Alhagi Command Dispatcher - 统一命令调度器
// ============================================================

import type { CommandHandler, CommandResult } from './types'
import { getCommand } from './registry'
import { getCommandContext } from './context'

// 命令执行事件监听器
type CommandEventHandler = (action: string, result: CommandResult) => void
const beforeExecuteListeners: CommandEventHandler[] = []
const afterExecuteListeners: CommandEventHandler[] = []

class CommandDispatcher {
  private handlers = new Map<string, CommandHandler>()
  private executionDepth = 0

  // 注册命令处理器
  register(action: string, handler: CommandHandler): void {
    if (this.handlers.has(action)) {
      console.warn(`[CommandDispatcher] Handler already registered for "${action}", overwriting`)
    }
    this.handlers.set(action, handler)
  }

  // 批量注册处理器
  registerBatch(entries: Record<string, CommandHandler>): void {
    for (const [action, handler] of Object.entries(entries)) {
      this.register(action, handler)
    }
  }

  // 取消注册处理器
  unregister(action: string): boolean {
    return this.handlers.delete(action)
  }

  // 检查命令是否已注册处理器
  hasHandler(action: string): boolean {
    return this.handlers.has(action)
  }

  // 获取命令是否可以执行（根据上下文条件）
  canExecute(action: string): boolean {
    const command = getCommand(action)
    if (!command) {
      console.warn(`[CommandDispatcher] Command not found: "${action}"`)
      return false
    }

    const ctx = getCommandContext()
    return ctx.check(command.when)
  }

  // 执行命令
  async execute(action: string): Promise<CommandResult> {
    const startTime = performance.now()

    if (this.executionDepth > 10) {
      console.error(`[CommandDispatcher] Max execution depth exceeded for "${action}"`)
      return { success: false, error: 'Max execution depth exceeded' }
    }

    const command = getCommand(action)
    if (!command) {
      console.warn(`[CommandDispatcher] Command not found: "${action}"`)
      return { success: false, error: `Command not found: ${action}` }
    }

    const handler = this.handlers.get(action)
    if (!handler) {
      console.warn(`[CommandDispatcher] No handler registered for: "${action}"`)
      return { success: false, error: `No handler for: ${action}` }
    }

    const ctx = getCommandContext()
    if (!ctx.check(command.when)) {
      const whenStr = Array.isArray(command.when)
        ? command.when.join(', ')
        : command.when || ''
      console.debug(`[CommandDispatcher] Command "${action}" skipped: when=${whenStr}`)
      return { success: false, error: 'Conditions not met' }
    }

    const beforeResult: CommandResult = { success: true }
    for (const listener of beforeExecuteListeners) {
      try {
        listener(action, beforeResult)
      } catch (error) {
        console.error(`[CommandDispatcher] beforeExecute listener error:`, error)
      }
    }

    if (!beforeResult.success) {
      return beforeResult
    }

    this.executionDepth++

    try {
      const result = await handler()

      const afterResult: CommandResult = { success: true, data: result }
      for (const listener of afterExecuteListeners) {
        try {
          listener(action, afterResult)
        } catch (error) {
          console.error(`[CommandDispatcher] afterExecute listener error:`, error)
        }
      }

      const duration = performance.now() - startTime
      if (duration > 100) {
        console.debug(`[CommandDispatcher] Command "${action}" executed in ${duration.toFixed(2)}ms`)
      }

      return { success: true, data: result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[CommandDispatcher] Command "${action}" failed:`, error)
      return { success: false, error: errorMessage }
    } finally {
      this.executionDepth--
    }
  }

  // 同步执行命令（用于不需要异步的场景）
  executeSync(action: string): CommandResult {
    const handler = this.handlers.get(action)
    if (!handler) {
      return { success: false, error: `No handler for: ${action}` }
    }

    const command = getCommand(action)
    if (!command) {
      return { success: false, error: `Command not found: ${action}` }
    }

    const ctx = getCommandContext()
    if (!ctx.check(command.when)) {
      return { success: false, error: 'Conditions not met' }
    }

    try {
      const result = handler()
      if (result instanceof Promise) {
        console.warn(`[CommandDispatcher] executeSync called on async handler "${action}"`)
        return { success: false, error: 'Async handler called with executeSync' }
      }
      return { success: true, data: result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }

  // 尝试执行命令（不抛出错误）
  tryExecute(action: string): boolean {
    const result = this.executeSync(action)
    return result.success
  }

  // 添加事件监听器
  onBeforeExecute(handler: CommandEventHandler): () => void {
    beforeExecuteListeners.push(handler)
    return () => {
      const index = beforeExecuteListeners.indexOf(handler)
      if (index > -1) {
        beforeExecuteListeners.splice(index, 1)
      }
    }
  }

  onAfterExecute(handler: CommandEventHandler): () => void {
    afterExecuteListeners.push(handler)
    return () => {
      const index = afterExecuteListeners.indexOf(handler)
      if (index > -1) {
        afterExecuteListeners.splice(index, 1)
      }
    }
  }

  // 清除所有监听器
  clearListeners(): void {
    beforeExecuteListeners.length = 0
    afterExecuteListeners.length = 0
  }

  // 清除所有处理器
  clearHandlers(): void {
    this.handlers.clear()
  }
}

let dispatcherInstance: CommandDispatcher | null = null

export function getDispatcher(): CommandDispatcher {
  if (!dispatcherInstance) {
    dispatcherInstance = new CommandDispatcher()
  }
  return dispatcherInstance
}

export function executeCommand(action: string): Promise<CommandResult> {
  return getDispatcher().execute(action)
}

export function canExecuteCommand(action: string): boolean {
  return getDispatcher().canExecute(action)
}

export function registerCommand(action: string, handler: CommandHandler): void {
  getDispatcher().register(action, handler)
}

export function unregisterCommand(action: string): boolean {
  return getDispatcher().unregister(action)
}

export function useCommandDispatcher() {
  const dispatcher = getDispatcher()
  return {
    execute: (action: string) => dispatcher.execute(action),
    executeSync: (action: string) => dispatcher.executeSync(action),
    tryExecute: (action: string) => dispatcher.tryExecute(action),
    canExecute: (action: string) => dispatcher.canExecute(action),
    register: (action: string, handler: CommandHandler) => dispatcher.register(action, handler),
    unregister: (action: string) => dispatcher.unregister(action),
    hasHandler: (action: string) => dispatcher.hasHandler(action),
    onBeforeExecute: (handler: CommandEventHandler) => dispatcher.onBeforeExecute(handler),
    onAfterExecute: (handler: CommandEventHandler) => dispatcher.onAfterExecute(handler),
  }
}
