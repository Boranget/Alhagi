import type { TabState } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { extractTitleFromPath, getDirname } from '@/utils/helpers'
import { detectDescriptor } from '@/fileTypes'
import { copyTempImagesToTarget, deleteTempImageDir } from '@/utils/tempImageManager'
import type { LineEnding } from '@electron-protocol/index'
import { electronService } from './electron/ElectronService'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'

export class TabService {
  private tabsStore = useTabsStore()
  private preferencesStore = usePreferencesStore()

  async openFile(): Promise<TabState | null> {
    if (!electronService.isAvailable()) return null

    const result = await electronService.openFile()
    if (!result.success || !result.data) return null

    const { filePath, content } = result.data

    const checkResult = await electronService.checkFileOpen(filePath)
    if (checkResult.success && checkResult.data && checkResult.data.windowId !== null) {
      await electronService.focusWindow(checkResult.data.windowId, filePath)
      return null
    }

    const existingTab = this.tabsStore.findTabByFilePath(filePath)
    if (existingTab) {
      this.tabsStore.switchTab(existingTab.id)
      return existingTab
    }

    const title = extractTitleFromPath(filePath)
    // 按 descriptor.loadStrategy 决定是否把 content 塞进 tab：
    //   utf8 → 用 dialog 给的 content；none → 留空（图片自取 binary 等）
    const descriptor = detectDescriptor(filePath)
    const tab = this.tabsStore.createTab({
      filePath,
      content: descriptor.loadStrategy === 'utf8' ? content : '',
      title,
      fileType: descriptor.id,
    })
    this.tabsStore.switchTab(tab.id)

    eventBus.emit(AppEvents.FILE_OPENED, { filePath, tabId: tab.id })

    return tab
  }

  async openRecentFile(filePath: string): Promise<TabState | null> {
    if (electronService.isAvailable()) {
      const checkResult = await electronService.checkFileOpen(filePath)
      if (checkResult.success && checkResult.data && checkResult.data.windowId !== null) {
        await electronService.focusWindow(checkResult.data.windowId, filePath)
        return null
      }
    }

    const existingTab = this.tabsStore.findTabByFilePath(filePath)
    if (existingTab) {
      this.tabsStore.switchTab(existingTab.id)
      return existingTab
    }

    if (!electronService.isAvailable()) return null

    try {
      const descriptor = detectDescriptor(filePath)
      let content = ''
      if (descriptor.loadStrategy === 'utf8') {
        const contentResp = await electronService.readFile(filePath)
        if (!contentResp.success || contentResp.data === undefined) return null
        content = contentResp.data
      }
      const title = extractTitleFromPath(filePath)
      const tab = this.tabsStore.createTab({ filePath, content, title, fileType: descriptor.id })
      this.tabsStore.switchTab(tab.id)

      eventBus.emit(AppEvents.FILE_OPENED, { filePath, tabId: tab.id })
      return tab
    } catch {
      return null
    }
  }

  async saveFile(tabId: string): Promise<boolean> {
    const tab = this.tabsStore.getTab(tabId)
    if (!tab) return false

    if (!electronService.isAvailable()) return false

    if (tab.filePath) {
      const lineEnding = this.preferencesStore.lineEnding as LineEnding
      await electronService.saveFile(tab.filePath, tab.content, lineEnding)
      this.tabsStore.markClean(tabId)

      eventBus.emit(AppEvents.FILE_SAVED, { filePath: tab.filePath, tabId })
      return true
    } else {
      return await this.saveFileAs(tabId)
    }
  }

  async saveFileAs(tabId: string): Promise<boolean> {
    const tab = this.tabsStore.getTab(tabId)
    if (!tab || !electronService.isAvailable()) return false

    const lineEnding = this.preferencesStore.lineEnding as LineEnding
    // 默认文件名：尊重 tab 已有的扩展名，否则用 descriptor.defaultExtension 补。
    //   - tab.title 已带扩展名（无论什么后缀）→ 原样
    //   - 没扩展名 + descriptor 给了 defaultExtension → 自动补
    //   - 没扩展名 + descriptor.defaultExtension 为空（如 text）→ 不强加，让用户对话框里自己写
    const hasExt = /\.[^.\\/]+$/.test(tab.title)
    const descriptor = detectDescriptor(tab.filePath ?? null)
    let defaultPath = tab.title
    if (!hasExt && descriptor.defaultExtension) {
      defaultPath = tab.title + descriptor.defaultExtension
    }

    const filePathResp = await electronService.saveAsFile(tab.content, defaultPath, lineEnding)

    if (filePathResp.success && filePathResp.data) {
      const filePath = filePathResp.data

      await this.handleTempImagesOnSave(tabId, filePath)

      // 另存为后路径变了，fileType 可能跟着变（.md 改名 .txt 或反之）。
      // 重新算并写回 tab，让 EditorContainer 的渲染分支随之切换。
      const newDescriptor = detectDescriptor(filePath)
      this.tabsStore.updateTab(tabId, {
        filePath,
        title: extractTitleFromPath(filePath),
        fileType: newDescriptor.id,
      })
      this.tabsStore.markClean(tabId)

      this.preferencesStore.addRecentFile(filePath, tab.title)

      eventBus.emit(AppEvents.FILE_SAVED, { filePath, tabId })
      return true
    }

    return false
  }

  async handleTempImagesOnSave(tabId: string, newFilePath: string): Promise<void> {
    const tab = this.tabsStore.getTab(tabId)
    if (!tab) return

    const mdDir = getDirname(newFilePath)
    await copyTempImagesToTarget(tabId, mdDir)
    await deleteTempImageDir(tabId)
  }

  async saveAllFiles(): Promise<boolean> {
    const dirtyTabs = this.tabsStore.dirtyTabs
    let allSaved = true

    for (const tab of dirtyTabs) {
      const saved = await this.saveFile(tab.id)
      if (!saved) allSaved = false
    }

    return allSaved
  }

  /**
   * P2-10：从磁盘重新读取指定文件，更新对应标签内容。
   * 调用方负责弹「是否丢弃当前修改」之类的确认对话框。
   *
   * 关键：除了刷新 tabsStore.content，还必须显式刷新 Crepe 编辑器内部
   * 的 ProseMirror 文档；store 字段变了 ≠ 编辑器视图变了。
   */
  async reloadFromDisk(filePath: string): Promise<boolean> {
    if (!electronService.isAvailable()) return false
    const tab = this.tabsStore.findTabByFilePath(filePath)
    if (!tab) return false
    const resp = await electronService.readFile(filePath)
    if (!resp.success || resp.data === undefined) return false
    const content = resp.data

    // 1. 更新 store 中的内容快照（让所有 watch(content) 的地方拿到新值）
    this.tabsStore.updateTab(tab.id, { content })
    this.tabsStore.markClean(tab.id)

    // 2. 若 reload 的是当前活动 tab，强制 Crepe 重新解析文档；
    //    其他 tab 内容也已更新，将来切换过去时 switchToTab 会自然 setMarkdown。
    if (this.tabsStore.activeTabId === tab.id) {
      const editorManager = useCrepeEditorManager()
      await editorManager.setMarkdown(content)
    }

    eventBus.emit(AppEvents.FILE_OPENED, { filePath, tabId: tab.id })
    return true
  }
}

export function useTabService() {
  return new TabService()
}