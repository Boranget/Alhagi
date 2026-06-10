// ============================================================
// Alhagi Electron Event Handler - 统一事件处理器
// ============================================================

import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useClipboard } from '@/services/clipboard'
import { useCapture } from '@/services/capture'
import { useTabService } from '@/services/tabService'
import type { ElectronAPI } from 'electron-protocol'

/**
 * Electron 事件处理器
 * 负责统一管理所有 Electron 事件监听器的注册、处理和清理
 */
export class ElectronEventHandler {
  private disposables: (() => void)[] = []
  private api: ElectronAPI | undefined
  private tabsStore: ReturnType<typeof useTabsStore>
  private prefsStore: ReturnType<typeof usePreferencesStore>
  private fileStore: ReturnType<typeof useFileExplorerStore>
  private editorManager: ReturnType<typeof useCrepeEditorManager>
  private clipboard: ReturnType<typeof useClipboard>
  private capture: ReturnType<typeof useCapture>
  private tabService: ReturnType<typeof useTabService>

  constructor(api: ElectronAPI | undefined) {
    this.api = api
    this.tabsStore = useTabsStore()
    this.prefsStore = usePreferencesStore()
    this.fileStore = useFileExplorerStore()
    this.editorManager = useCrepeEditorManager()
    this.clipboard = useClipboard()
    this.capture = useCapture()
    this.tabService = useTabService()
  }

  /**
   * 初始化所有事件监听器
   */
  initialize(): void {
    if (!this.api) {
      console.warn('[ElectronEventHandler] Electron API not available, skipping initialization')
      return
    }

    console.log('[ElectronEventHandler] Initializing event handlers...')

    this.registerFileHandlers()
    this.registerEditHandlers()
    this.registerParagraphHandlers()
    this.registerTableHandlers()
    this.registerViewHandlers()
    this.registerNavigationHandlers()
    this.registerToolsHandlers()
    this.registerHelpHandlers()
    this.registerWindowAndTabHandlers()

    console.log('[ElectronEventHandler] Event handlers initialized successfully')
  }

  /**
   * 安全执行事件处理函数，捕获所有异常
   */
  private safeExecute(fn: () => void | Promise<void>, eventName: string): void {
    try {
      const result = fn()
      if (result instanceof Promise) {
        result.catch(error => {
          console.error(`[ElectronEventHandler] Async error in ${eventName}:`, error)
        })
      }
    } catch (error) {
      console.error(`[ElectronEventHandler] Error in ${eventName}:`, error)
    }
  }

  /**
   * 注册文件相关的事件处理器
   */
  private registerFileHandlers(): void {
    this.disposables.push(
      this.api!.onNewFile(() => {
        this.safeExecute(() => {
          this.tabsStore.createTab({ title: '未命名' })
        }, 'onNewFile')
      })
    )

    this.disposables.push(
      this.api!.onOpenFile(() => {
        this.safeExecute(() => {
          this.tabService.openFile()
        }, 'onOpenFile')
      })
    )

    this.disposables.push(
      this.api!.onOpenFolder(() => {
        this.safeExecute(async () => {
          if (!this.api) return
          const result = await this.api.openFolder()
          if (result.success && result.data) {
            await this.fileStore.openFolderByPath(result.data.path)
          }
        }, 'onOpenFolder')
      })
    )

    this.disposables.push(
      this.api!.onSave(() => {
        this.safeExecute(() => {
          if (this.tabsStore.activeTabId) {
            this.tabService.saveFile(this.tabsStore.activeTabId)
          }
        }, 'onSave')
      })
    )

    this.disposables.push(
      this.api!.onSaveAs(() => {
        this.safeExecute(() => {
          if (this.tabsStore.activeTabId) {
            this.tabService.saveFileAs(this.tabsStore.activeTabId)
          }
        }, 'onSaveAs')
      })
    )
  }

  /**
   * 注册编辑相关的事件处理器
   */
  private registerEditHandlers(): void {
    this.disposables.push(
      this.api!.onEditUndo(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.EDIT_UNDO)
        }, 'onEditUndo')
      })
    )

    this.disposables.push(
      this.api!.onEditRedo(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.EDIT_REDO)
        }, 'onEditRedo')
      })
    )

    this.disposables.push(
      this.api!.onCopyAsMarkdown(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.COPY_AS_MARKDOWN)
        }, 'onCopyAsMarkdown')
      })
    )

    this.disposables.push(
      this.api!.onCopyAsHtml(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.COPY_AS_HTML)
        }, 'onCopyAsHtml')
      })
    )

    this.disposables.push(
      this.api!.onPasteAsPlain(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.PASTE_AS_PLAIN)
        }, 'onPasteAsPlain')
      })
    )
  }

  /**
   * 注册段落格式相关的事件处理器
   */
  private registerParagraphHandlers(): void {
    this.disposables.push(
      this.api!.onParagraphHeading1(() => {
        this.safeExecute(() => {
          this.editorManager.toggleHeading(1)
        }, 'onParagraphHeading1')
      })
    )

    this.disposables.push(
      this.api!.onParagraphHeading2(() => {
        this.safeExecute(() => {
          this.editorManager.toggleHeading(2)
        }, 'onParagraphHeading2')
      })
    )

    this.disposables.push(
      this.api!.onParagraphHeading3(() => {
        this.safeExecute(() => {
          this.editorManager.toggleHeading(3)
        }, 'onParagraphHeading3')
      })
    )

    this.disposables.push(
      this.api!.onParagraphParagraph(() => {
        this.safeExecute(() => {
          this.editorManager.toggleParagraph()
        }, 'onParagraphParagraph')
      })
    )

    this.disposables.push(
      this.api!.onParagraphQuote(() => {
        this.safeExecute(() => {
          this.editorManager.toggleBlockQuote()
        }, 'onParagraphQuote')
      })
    )

    this.disposables.push(
      this.api!.onParagraphBulletList(() => {
        this.safeExecute(() => {
          this.editorManager.toggleBulletList()
        }, 'onParagraphBulletList')
      })
    )

    this.disposables.push(
      this.api!.onParagraphOrderedList(() => {
        this.safeExecute(() => {
          this.editorManager.toggleOrderedList()
        }, 'onParagraphOrderedList')
      })
    )

    this.disposables.push(
      this.api!.onParagraphTaskList(() => {
        this.safeExecute(() => {
          this.editorManager.toggleTaskList()
        }, 'onParagraphTaskList')
      })
    )

    this.disposables.push(
      this.api!.onParagraphCodeBlock(() => {
        this.safeExecute(() => {
          this.editorManager.toggleCodeFence()
        }, 'onParagraphCodeBlock')
      })
    )

    this.disposables.push(
      this.api!.onParagraphMathBlock(() => {
        this.safeExecute(() => {
          this.editorManager.insertMathBlock()
        }, 'onParagraphMathBlock')
      })
    )

    this.disposables.push(
      this.api!.onParagraphHorizontalRule(() => {
        this.safeExecute(() => {
          this.editorManager.insertHorizontalRule()
        }, 'onParagraphHorizontalRule')
      })
    )
  }

  /**
   * 注册表格相关的事件处理器
   */
  private registerTableHandlers(): void {
    this.disposables.push(
      this.api!.onTableInsert(() => {
        this.safeExecute(() => {
          this.editorManager.insertTable()
        }, 'onTableInsert')
      })
    )

    this.disposables.push(
      this.api!.onTableInsertRowAbove(() => {
        this.safeExecute(() => {
          this.editorManager.insertTableRowAbove()
        }, 'onTableInsertRowAbove')
      })
    )

    this.disposables.push(
      this.api!.onTableInsertRowBelow(() => {
        this.safeExecute(() => {
          this.editorManager.insertTableRowBelow()
        }, 'onTableInsertRowBelow')
      })
    )

    this.disposables.push(
      this.api!.onTableInsertColumnLeft(() => {
        this.safeExecute(() => {
          this.editorManager.insertTableColumnLeft()
        }, 'onTableInsertColumnLeft')
      })
    )

    this.disposables.push(
      this.api!.onTableInsertColumnRight(() => {
        this.safeExecute(() => {
          this.editorManager.insertTableColumnRight()
        }, 'onTableInsertColumnRight')
      })
    )

    this.disposables.push(
      this.api!.onTableDeleteRow(() => {
        this.safeExecute(() => {
          this.editorManager.deleteTableRow()
        }, 'onTableDeleteRow')
      })
    )

    this.disposables.push(
      this.api!.onTableDeleteColumn(() => {
        this.safeExecute(() => {
          this.editorManager.deleteTableColumn()
        }, 'onTableDeleteColumn')
      })
    )
  }

  /**
   * 注册视图相关的事件处理器
   */
  private registerViewHandlers(): void {
    this.disposables.push(
      this.api!.onToggleSidebar(() => {
        this.safeExecute(() => {
          this.prefsStore.showSidebar = !this.prefsStore.showSidebar
        }, 'onToggleSidebar')
      })
    )

    this.disposables.push(
      this.api!.onToggleTabBar(() => {
        this.safeExecute(() => {
          this.prefsStore.showTabBar = !this.prefsStore.showTabBar
        }, 'onToggleTabBar')
      })
    )

    this.disposables.push(
      this.api!.onToggleStatusBar(() => {
        this.safeExecute(() => {
          this.prefsStore.showStatusBar = !this.prefsStore.showStatusBar
        }, 'onToggleStatusBar')
      })
    )

    this.disposables.push(
      this.api!.onToggleTheme(() => {
        this.safeExecute(() => {
          this.prefsStore.toggleLightDark()
        }, 'onToggleTheme')
      })
    )

    this.disposables.push(
      this.api!.onToggleStickyNoteMode(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.TOGGLE_STICKY_NOTE_MODE)
        }, 'onToggleStickyNoteMode')
      })
    )

    this.disposables.push(
      this.api!.onToggleImmersiveMode(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.TOGGLE_IMMERSIVE_MODE)
        }, 'onToggleImmersiveMode')
      })
    )

    this.disposables.push(
      this.api!.onViewMode((mode) => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.VIEW_MODE_CHANGE, { mode: mode as 'wysiwyg' | 'source' | 'split' })
        }, 'onViewMode')
      })
    )

    this.disposables.push(
      this.api!.onZoomIn(() => {
        this.safeExecute(() => {
          this.prefsStore.zoomIn()
        }, 'onZoomIn')
      })
    )

    this.disposables.push(
      this.api!.onZoomOut(() => {
        this.safeExecute(() => {
          this.prefsStore.zoomOut()
        }, 'onZoomOut')
      })
    )

    this.disposables.push(
      this.api!.onZoomReset(() => {
        this.safeExecute(() => {
          this.prefsStore.resetZoom()
        }, 'onZoomReset')
      })
    )
  }

  /**
   * 注册导航相关的事件处理器
   */
  private registerNavigationHandlers(): void {
    this.disposables.push(
      this.api!.onNavigationQuickOpen(() => {
        this.safeExecute(() => {
          window.dispatchEvent(new CustomEvent('app:quickOpen'))
        }, 'onNavigationQuickOpen')
      })
    )

    this.disposables.push(
      this.api!.onNavigationGotoLine(() => {
        this.safeExecute(() => {
          window.dispatchEvent(new CustomEvent('editor:gotoLine'))
        }, 'onNavigationGotoLine')
      })
    )
  }

  /**
   * 注册工具相关的事件处理器
   */
  private registerToolsHandlers(): void {
    this.disposables.push(
      this.api!.onToolsPreferences(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.OPEN_SETTINGS)
        }, 'onToolsPreferences')
      })
    )

    this.disposables.push(
      this.api!.onOpenSettings(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.OPEN_SETTINGS)
        }, 'onOpenSettings')
      })
    )

    this.disposables.push(
      this.api!.onToolsExport(() => {
        this.safeExecute(() => {
          window.dispatchEvent(new CustomEvent('app:export'))
        }, 'onToolsExport')
      })
    )

    this.disposables.push(
      this.api!.onCaptureScreen(async () => {
        this.safeExecute(async () => {
          const result = await this.capture.captureEditor()
          if (result) {
            const action = prompt('截图完成！选择操作：\n1. 复制到剪贴板\n2. 下载到本地\n3. 取消', '1')
            if (action === '1') {
              await this.capture.copyCaptureToClipboard(result)
              alert('已复制到剪贴板')
            } else if (action === '2') {
              const filename = `screenshot-${Date.now()}.png`
              this.capture.downloadCapture(result, filename)
            }
          }
        }, 'onCaptureScreen')
      })
    )
  }

  /**
   * 注册帮助相关的事件处理器
   */
  private registerHelpHandlers(): void {
    this.disposables.push(
      this.api!.onHelpShortcuts(() => {
        this.safeExecute(() => {
          window.dispatchEvent(new CustomEvent('app:showShortcuts'))
        }, 'onHelpShortcuts')
      })
    )
  }

  /**
   * 注册窗口和标签页相关的事件处理器
   */
  private registerWindowAndTabHandlers(): void {
    this.disposables.push(
      this.api!.onNewWindow(() => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.NEW_WINDOW_REQUESTED)
        }, 'onNewWindow')
      })
    )

    this.disposables.push(
      this.api!.onTabMerge((tabData) => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.TAB_MERGE_REQUESTED, { tabData })
        }, 'onTabMerge')
      })
    )

    this.disposables.push(
      this.api!.onTabDetached((tabData) => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.TAB_DETACHED, { tabData })
        }, 'onTabDetached')
      })
    )

    this.disposables.push(
      this.api!.onFocusTabForFile((filePath) => {
        this.safeExecute(() => {
          eventBus.emit(AppEvents.FOCUS_TAB_FOR_FILE, { filePath })
        }, 'onFocusTabForFile')
      })
    )
  }

  /**
   * 清理所有事件监听器
   */
  dispose(): void {
    this.disposables.forEach(dispose => {
      try {
        dispose()
      } catch (error) {
        console.error('[ElectronEventHandler] Error during dispose:', error)
      }
    })
    this.disposables = []
    console.log('[ElectronEventHandler] Disposed')
  }
}
