// ============================================================
// Alhagi Command Dispatcher - 桥接层（旧命令 ID → Mediator）
// ============================================================
//
// 命令面板 / 快捷键 / 菜单仍使用旧的命令 ID（如 'view.toggleSidebar'），
// 本文件负责将这些 ID 映射到 Mediator 命令并路由执行。
//
// 保留的功能：
//   - when/whenNot 条件评估（context.ts）
//   - before/after 执行监听器
//   - 执行深度保护
//
// 已移除：
//   - 本地 handler 注册表（所有执行逻辑已迁移到 Mediator CommandHandler）

import type { CommandResult } from './types'
import { getCommand } from './registry'
import { getCommandContext } from './context'
import { getMediator } from '@/adapters/mediator'
import {
  TabCommands, PreferenceCommands, LayoutCommands,
  ViewModeCommands, FileExplorerCommands,
  EditCommands, EditorCommands, ViewCommands,
  FileCommands, ToolsCommands, HelpCommands,
} from '@/adapters/mediator/commands'

// 命令执行事件监听器
type CommandEventHandler = (action: string, result: CommandResult) => void
const beforeExecuteListeners: CommandEventHandler[] = []
const afterExecuteListeners: CommandEventHandler[] = []

// ── 旧命令 ID → Mediator 命令映射 ──────────────────────
interface MediatorCommandMapping {
  type: string
  payload?: Record<string, unknown>
}

const COMMAND_MAP: Record<string, MediatorCommandMapping> = {
  // File
  'file.new': { type: TabCommands.CREATE, payload: { title: '未命名' } },
  'file.newWindow': { type: FileCommands.NEW_WINDOW },
  'file.open': { type: FileCommands.OPEN },
  'file.openFolder': { type: FileExplorerCommands.OPEN_FOLDER },
  'file.save': { type: FileCommands.SAVE },
  'file.saveAs': { type: FileCommands.SAVE_AS },
  'file.close': { type: FileCommands.CLOSE_ACTIVE },

  // Edit
  'edit.undo': { type: EditCommands.UNDO },
  'edit.redo': { type: EditCommands.REDO },
  'edit.redoAlt': { type: EditCommands.REDO },
  'edit.cut': { type: EditCommands.CUT },
  'edit.copy': { type: EditCommands.COPY },
  'edit.paste': { type: EditCommands.PASTE },
  'edit.selectAll': { type: EditCommands.SELECT_ALL },
  'edit.find': { type: EditCommands.FIND },
  'edit.replace': { type: EditCommands.REPLACE },

  // Format
  'format.bold': { type: EditorCommands.BOLD },
  'format.italic': { type: EditorCommands.ITALIC },
  'format.strikethrough': { type: EditorCommands.STRIKETHROUGH },
  'format.code': { type: EditorCommands.CODE },
  'format.link': { type: EditorCommands.LINK },
  'format.image': { type: EditorCommands.IMAGE },
  'format.highlight': { type: EditorCommands.HIGHLIGHT },

  // Paragraph
  'paragraph.heading1': { type: EditorCommands.HEADING1 },
  'paragraph.heading2': { type: EditorCommands.HEADING2 },
  'paragraph.heading3': { type: EditorCommands.HEADING3 },
  'paragraph.paragraph': { type: EditorCommands.PARAGRAPH },
  'paragraph.quote': { type: EditorCommands.QUOTE },
  'paragraph.bulletList': { type: EditorCommands.BULLET_LIST },
  'paragraph.orderedList': { type: EditorCommands.ORDERED_LIST },
  'paragraph.taskList': { type: EditorCommands.TASK_LIST },
  'paragraph.codeBlock': { type: EditorCommands.CODE_BLOCK },
  'paragraph.mathBlock': { type: EditorCommands.MATH_BLOCK },
  'paragraph.horizontalRule': { type: EditorCommands.HORIZONTAL_RULE },

  // Table
  'table.insert': { type: EditorCommands.TABLE_INSERT },
  'table.insertRowAbove': { type: EditorCommands.TABLE_ROW_ABOVE },
  'table.insertRowBelow': { type: EditorCommands.TABLE_ROW_BELOW },
  'table.insertColumnLeft': { type: EditorCommands.TABLE_COL_LEFT },
  'table.insertColumnRight': { type: EditorCommands.TABLE_COL_RIGHT },
  'table.deleteRow': { type: EditorCommands.TABLE_DELETE_ROW },
  'table.deleteColumn': { type: EditorCommands.TABLE_DELETE_COL },

  // View - layout
  'view.toggleSidebar': { type: LayoutCommands.TOGGLE_SIDEBAR },
  'view.toggleTabBar': { type: LayoutCommands.TOGGLE_TAB_BAR },
  'view.toggleStatusBar': { type: LayoutCommands.TOGGLE_STATUS_BAR },

  // View - editor mode
  'view.toggleSourceMode': { type: ViewCommands.TOGGLE_SOURCE_MODE },
  'view.wysiwygMode': { type: ViewCommands.WYSIWYG_MODE },
  'view.splitMode': { type: ViewCommands.SPLIT_MODE },

  // View - preferences
  'view.toggleTheme': { type: PreferenceCommands.TOGGLE_LIGHT_DARK },
  'view.zoomIn': { type: PreferenceCommands.ZOOM_IN },
  'view.zoomOut': { type: PreferenceCommands.ZOOM_OUT },
  'view.resetZoom': { type: PreferenceCommands.RESET_ZOOM },

  // View - window / electron
  'view.fullscreen': { type: ViewCommands.FULLSCREEN },
  'view.devTools': { type: ViewCommands.DEV_TOOLS },
  'view.stickyNoteMode': { type: ViewCommands.STICKY_NOTE_MODE },
  'view.immersiveMode': { type: ViewCommands.IMMERSIVE_MODE },

  // View - writing enhancement
  'view.focusMode': { type: ViewModeCommands.TOGGLE_FOCUS_MODE },
  'view.typewriterMode': { type: ViewModeCommands.TOGGLE_TYPEWRITER_MODE },

  // View - tab navigation
  'view.nextTab': { type: ViewCommands.NEXT_TAB },
  'view.prevTab': { type: ViewCommands.PREV_TAB },

  // Tools
  'tools.preferences': { type: ToolsCommands.PREFERENCES },
  'tools.export': { type: ToolsCommands.EXPORT },
  'tools.exportHTML': { type: ToolsCommands.EXPORT_HTML },
  'tools.exportPDF': { type: ToolsCommands.EXPORT_PDF },
  'tools.captureScreen': { type: ToolsCommands.CAPTURE_SCREEN },

  // Help
  'help.shortcuts': { type: HelpCommands.SHORTCUTS },
  'help.commandPalette': { type: HelpCommands.COMMAND_PALETTE },
  'help.about': { type: HelpCommands.ABOUT },
}

class CommandDispatcher {
  private executionDepth = 0

  // 检查命令是否可以执行（根据上下文条件）
  canExecute(action: string): boolean {
    const command = getCommand(action)
    if (!command) {
      console.warn(`[CommandDispatcher] Command not found: "${action}"`)
      return false
    }

    const ctx = getCommandContext()
    return ctx.check(command.when)
  }

  // 执行命令（路由到 Mediator）
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

    const mapping = COMMAND_MAP[action]
    if (!mapping) {
      console.warn(`[CommandDispatcher] No mediator mapping for: "${action}"`)
      return { success: false, error: `No mediator mapping for: ${action}` }
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
      const mediator = getMediator()
      const result = await mediator.send({ type: mapping.type, payload: mapping.payload })

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

  // 同步执行命令（Mediator 是异步的，这里退化为 fire-and-forget）
  executeSync(action: string): CommandResult {
    const mapping = COMMAND_MAP[action]
    if (!mapping) {
      return { success: false, error: `No mediator mapping for: ${action}` }
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
      getMediator().send({ type: mapping.type, payload: mapping.payload })
      return { success: true }
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

// 已废弃：所有执行逻辑已迁移到 Mediator，此函数保留为 no-op 以兼容旧调用方
export function registerCommand(_action: string, _handler: unknown): void {
  console.warn('[CommandDispatcher] registerCommand is deprecated. Use mediator.registerCommand() instead.')
}

// 已废弃：Mediator 路由无 unregister 概念
export function unregisterCommand(_action: string): boolean {
  console.warn('[CommandDispatcher] unregisterCommand is deprecated.')
  return false
}

export function useCommandDispatcher() {
  const dispatcher = getDispatcher()
  return {
    execute: (action: string) => dispatcher.execute(action),
    executeSync: (action: string) => dispatcher.executeSync(action),
    tryExecute: (action: string) => dispatcher.tryExecute(action),
    canExecute: (action: string) => dispatcher.canExecute(action),
    register: (action: string, handler: unknown) => registerCommand(action, handler),
    unregister: (action: string) => unregisterCommand(action),
    hasHandler: (action: string) => action in COMMAND_MAP,
    onBeforeExecute: (handler: CommandEventHandler) => dispatcher.onBeforeExecute(handler),
    onAfterExecute: (handler: CommandEventHandler) => dispatcher.onAfterExecute(handler),
  }
}
