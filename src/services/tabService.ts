import type { TabState } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus, AppEvents } from '@/events/eventBus'
import { extractTitleFromPath, getDirname } from '@/utils/helpers'
import { copyTempImagesToTarget, deleteTempImageDir } from '@/utils/tempImageManager'
import type { LineEnding } from '../../electron-protocol/index'

let instance: TabService | null = null

export class TabService {
  private tabsStore = useTabsStore()
  private preferencesStore = usePreferencesStore()

  private constructor() {}

  static getInstance(): TabService {
    if (!instance) {
      instance = new TabService()
    }
    return instance
  }

  async openFile(): Promise<TabState | null> {
    if (!window.electronAPI) return null

    const result = await window.electronAPI.openFile()
    if (!result.success || !result.data) return null

    const { filePath, content } = result.data

    const checkResult = await window.electronAPI.checkFileOpen(filePath)
    if (checkResult.success && checkResult.data && checkResult.data.windowId !== null) {
      await window.electronAPI.focusWindow(checkResult.data.windowId, filePath)
      return null
    }

    const existingTab = this.tabsStore.findTabByFilePath(filePath)
    if (existingTab) {
      this.tabsStore.switchTab(existingTab.id)
      return existingTab
    }

    const title = extractTitleFromPath(filePath)
    const tab = this.tabsStore.createTab({ filePath, content, title })
    this.tabsStore.switchTab(tab.id)

    eventBus.emit(AppEvents.FILE_OPENED, { filePath, tabId: tab.id })

    return tab
  }

  async openRecentFile(filePath: string): Promise<TabState | null> {
    if (window.electronAPI) {
      const checkResult = await window.electronAPI.checkFileOpen(filePath)
      if (checkResult.success && checkResult.data && checkResult.data.windowId !== null) {
        await window.electronAPI.focusWindow(checkResult.data.windowId, filePath)
        return null
      }
    }

    const existingTab = this.tabsStore.findTabByFilePath(filePath)
    if (existingTab) {
      this.tabsStore.switchTab(existingTab.id)
      return existingTab
    }

    if (!window.electronAPI) return null

    try {
      const contentResp = await window.electronAPI.readFile(filePath)
      if (!contentResp.success) return null
      const content = contentResp.data
      const title = extractTitleFromPath(filePath)
      const tab = this.tabsStore.createTab({ filePath, content, title })
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

    if (!window.electronAPI) return false

    if (tab.filePath) {
      const lineEnding = this.preferencesStore.lineEnding as LineEnding
      await window.electronAPI.saveFile(tab.filePath, tab.content, lineEnding)
      this.tabsStore.markClean(tabId)

      eventBus.emit(AppEvents.FILE_SAVED, { filePath: tab.filePath, tabId })
      return true
    } else {
      return await this.saveFileAs(tabId)
    }
  }

  async saveFileAs(tabId: string): Promise<boolean> {
    const tab = this.tabsStore.getTab(tabId)
    if (!tab || !window.electronAPI) return false

    const lineEnding = this.preferencesStore.lineEnding as LineEnding
    const defaultPath = tab.title.endsWith('.md') ? tab.title : tab.title + '.md'

    const filePathResp = await window.electronAPI.saveAsFile(tab.content, defaultPath, lineEnding)

    if (filePathResp.success && filePathResp.data) {
      const filePath = filePathResp.data

      await this.handleTempImagesOnSave(tabId, filePath)

      this.tabsStore.updateTab(tabId, { filePath, title: extractTitleFromPath(filePath) })
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
}

export function useTabService() {
  return TabService.getInstance()
}
