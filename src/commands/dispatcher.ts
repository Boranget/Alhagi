// ============================================================
// Alhagi Command Dispatcher - 统一命令调度器
// ============================================================

import type { CommandHandler, CommandResult } from './types'
import { getCommand } from './registry'
import { getCommandContext } from './context'

// 命令处理器映射
const handlers = new Map<string, CommandHandler>()

// 命令执行事件
type CommandEventHandler = (commandId: string, result: CommandResult) => void
const beforeExecuteListeners: CommandEventHandler[] = []
const afterExecuteListeners: CommandEventHandler[] = []

// 单例调度器
let dispatcherInstance: CommandDispatcher | null = null

class CommandDispatcher {
  private executionDepth = 0

  // 注册命令处理器
  register(id: string, handler: CommandHandler): void {
    if (handlers.has(id)) {
      console.warn(`[CommandDispatcher] Handler already registered for "${id}", overwriting`)
    }
    handlers.set(id, handler)
  }

  // 批量注册处理器
  registerBatch(entries: Record<string, CommandHandler>): void {
    for (const [id, handler] of Object.entries(entries)) {
      this.register(id, handler)
    }
  }

  // 取消注册处理器
  unregister(id: string): boolean {
    return handlers.delete(id)
  }

  // 检查命令是否已注册处理器
  hasHandler(id: string): boolean {
    return handlers.has(id)
  }

  // 获取命令是否可以执行（根据上下文条件）
  canExecute(id: string): boolean {
    const command = getCommand(id)
    if (!command) {
      console.warn(`[CommandDispatcher] Command not found: "${id}"`)
      return false
    }

    const ctx = getCommandContext()
    return ctx.check(command.when, command.whenNot)
  }

  // 执行命令
  async execute(id: string): Promise<CommandResult> {
    const startTime = performance.now()

    // 防止递归执行
    if (this.executionDepth > 10) {
      console.error(`[CommandDispatcher] Max execution depth exceeded for "${id}"`)
      return { success: false, error: 'Max execution depth exceeded' }
    }

    const command = getCommand(id)
    if (!command) {
      console.warn(`[CommandDispatcher] Command not found: "${id}"`)
      return { success: false, error: `Command not found: ${id}` }
    }

    const handler = handlers.get(id)
    if (!handler) {
      console.warn(`[CommandDispatcher] No handler registered for: "${id}"`)
      return { success: false, error: `No handler for: ${id}` }
    }

    // 检查执行条件
    const ctx = getCommandContext()
    if (!ctx.check(command.when, command.whenNot)) {
      const whenStr = command.when?.join(', ') ?? ''
      const whenNotStr = command.whenNot?.map(k => `!${k}`).join(', ') ?? ''
      console.debug(`[CommandDispatcher] Command "${id}" skipped: when=${whenStr}, whenNot=${whenNotStr}`)
      return { success: false, error: 'Conditions not met' }
    }

    // 触发 beforeExecute 事件
    const beforeResult: CommandResult = { success: true }
    for (const listener of beforeExecuteListeners) {
      try {
        listener(id, beforeResult)
      } catch (error) {
        console.error(`[CommandDispatcher] beforeExecute listener error:`, error)
      }
    }

    if (!beforeResult.success) {
      return beforeResult
    }

    // 增加执行深度
    this.executionDepth++

    try {
      // 执行处理器
      const result = await handler()

      // 触发 afterExecute 事件
      const afterResult: CommandResult = { success: true, data: result }
      for (const listener of afterExecuteListeners) {
        try {
          listener(id, afterResult)
        } catch (error) {
          console.error(`[CommandDispatcher] afterExecute listener error:`, error)
        }
      }

      const duration = performance.now() - startTime
      if (duration > 100) {
        console.debug(`[CommandDispatcher] Command "${id}" executed in ${duration.toFixed(2)}ms`)
      }

      return { success: true, data: result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[CommandDispatcher] Command "${id}" failed:`, error)
      return { success: false, error: errorMessage }
    } finally {
      this.executionDepth--
    }
  }

  // 同步执行命令（用于不需要异步的场景）
  executeSync(id: string): CommandResult {
    const handler = handlers.get(id)
    if (!handler) {
      return { success: false, error: `No handler for: ${id}` }
    }

    const command = getCommand(id)
    if (!command) {
      return { success: false, error: `Command not found: ${id}` }
    }

    const ctx = getCommandContext()
    if (!ctx.check(command.when, command.whenNot)) {
      return { success: false, error: 'Conditions not met' }
    }

    try {
      const result = handler()
      if (result instanceof Promise) {
        console.warn(`[CommandDispatcher] executeSync called on async handler "${id}"`)
        return { success: false, error: 'Async handler called with executeSync' }
      }
      return { success: true, data: result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }

  // 尝试执行命令（不抛出错误）
  tryExecute(id: string): boolean {
    const result = this.execute(id)
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
  clearListeners() {
    beforeExecuteListeners.length = 0
    afterExecuteListeners.length = 0
  }

  // 清除所有处理器
  clearHandlers() {
    handlers.clear()
  }
}

// 获取或创建全局调度器实例
export function getDispatcher(): CommandDispatcher {
  if (!dispatcherInstance) {
    dispatcherInstance = new CommandDispatcher()
  }
  return dispatcherInstance
}

// 便捷方法
export function executeCommand(id: string): Promise<CommandResult> {
  return getDispatcher().execute(id)
}

export function canExecuteCommand(id: string): boolean {
  return getDispatcher().canExecute(id)
}

export function registerCommand(id: string, handler: CommandHandler): void {
  getDispatcher().register(id, handler)
}

export function unregisterCommand(id: string): boolean {
  return getDispatcher().unregister(id)
}

// Vue Composable
export function useCommandDispatcher() {
  const dispatcher = getDispatcher()

  return {
    execute: (id: string) => dispatcher.execute(id),
    executeSync: (id: string) => dispatcher.executeSync(id),
    tryExecute: (id: string) => dispatcher.tryExecute(id),
    canExecute: (id: string) => dispatcher.canExecute(id),
    register: (id: string, handler: CommandHandler) => dispatcher.register(id, handler),
    unregister: (id: string) => dispatcher.unregister(id),
    hasHandler: (id: string) => dispatcher.hasHandler(id),
    onBeforeExecute: (handler: CommandEventHandler) => dispatcher.onBeforeExecute(handler),
    onAfterExecute: (handler: CommandEventHandler) => dispatcher.onAfterExecute(handler),
  }
}
