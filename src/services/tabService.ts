import type { TabState } from '@/types'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { eventBus as defaultEventBus, AppEvents } from '@/events/eventBus'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import { extractTitleFromPath, getDirname } from '@/utils/helpers'
import { detectDescriptor } from '@/fileTypes'
import { copyTempImagesToTarget, deleteTempImageDir } from '@/utils/tempImageManager'
import type { LineEnding } from '@electron-protocol/index'
import { electronService } from './electron/ElectronService'
import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { useTabActions } from '@/composables/useTabActions'

export class TabService {
  private tabsStore = useTabsStore()
  private preferencesStore = usePreferencesStore()
  private eventBus: IEventBus

  constructor(bus?: IEventBus) {
    this.eventBus = bus ?? defaultEventBus
  }
  private tabActions = useTabActions()

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
    const descriptor = detectDescriptor(filePath)
    const tab = await this.tabActions.createTab({
      filePath,
      content: descriptor.loadStrategy === 'utf8' ? content : '',
      title,
      fileType: descriptor.id,
    })

    return this.tabsStore.getTab(tab.id) ?? null
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
      const tab = await this.tabActions.createTab({ filePath, content, title, fileType: descriptor.id })

      return this.tabsStore.getTab(tab.id) ?? null
    } catch (error) {
      console.error('Failed to open recent file:', error)
      return null
    }
  }

  /**
   * 读取用于持久化的权威内容。
   *
   * 不直接用 `tab.content`：Crepe 编辑进 store 有 200ms 防抖，直接读 store
   * 会在防抖窗口内保存到旧内容。getMarkdown() 会先 flush 待定编辑再读权威，
   * 是「保存/导出拿已落定内容」的唯一正确入口。
   */
  private readAuthoritativeContent(tabId: string): string {
    return getEditorServiceGateway().getMarkdown(tabId)
  }

  async saveFile(tabId: string): Promise<boolean> {
    const tab = this.tabsStore.getTab(tabId)
    if (!tab) return false

    if (!electronService.isAvailable()) return false

    if (tab.filePath) {
      const lineEnding = this.preferencesStore.lineEnding as LineEnding
      const content = this.readAuthoritativeContent(tabId)
      const response = await electronService.saveFile(tab.filePath, content, lineEnding)
      if (!response.success) return false

      // 仅内容仍与落盘快照一致才清 dirty：IPC 往返期间的敲键保持 dirty，
      // 交由下一轮自动保存补存，否则关闭无提示、自动保存被 !isDirty 跳过。
      this.tabsStore.markCleanIfUnchanged(tabId, content)

      this.eventBus.emit(AppEvents.FILE_SAVED, { filePath: tab.filePath, tabId })
      return true
    } else {
      return await this.saveFileAs(tabId)
    }
  }

  async saveFileAs(tabId: string): Promise<boolean> {
    const tab = this.tabsStore.getTab(tabId)
    if (!tab || !electronService.isAvailable()) return false

    const lineEnding = this.preferencesStore.lineEnding as LineEnding
    // 快照先取（flush 到最新权威），落盘与清 dirty 都以它为准——原生对话框
    // 阻断输入，保存期间内容理应不变；若期间确有变化则保持 dirty。
    const content = this.readAuthoritativeContent(tabId)
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

    const filePathResp = await electronService.saveAsFile(content, defaultPath, lineEnding)

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
      this.tabsStore.markCleanIfUnchanged(tabId, content)

      this.preferencesStore.addRecentFile(filePath, tab.title)

      this.eventBus.emit(AppEvents.FILE_SAVED, { filePath, tabId })
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
   * 只写权威（tabsStore）：docSync watch 是权威 → 视图的唯一通道，
   * 会自动把新内容应用到该 tab 的编辑器（含相等短路/组合期护栏/echo
   * 抑制）。曾有 setTabContent 直写 replaceAll 的旁路，会绕过全部护栏、
   * 在 IME 组合期打断输入，已删除。
   */
  async reloadFromDisk(filePath: string): Promise<boolean> {
    if (!electronService.isAvailable()) return false
    const tab = this.tabsStore.findTabByFilePath(filePath)
    if (!tab) return false
    const resp = await electronService.readFile(filePath)
    if (!resp.success || resp.data === undefined) return false

    this.tabsStore.updateTab(tab.id, { content: resp.data })
    this.tabsStore.markClean(tab.id)
    return true
  }
}

export function useTabService() {
  return new TabService()
}