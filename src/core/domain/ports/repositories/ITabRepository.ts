import type { Tab } from '@core/entities/Tab'
import type { ViewMode, FileType } from '@shared/types'

export interface ITabRepository {
  getAll(): Tab[]
  getById(id: string): Tab | undefined
  create(options?: CreateTabOptions): Tab
  insert(tab: Tab): void
  update(id: string, updates: Partial<TabUpdates>): void
  delete(id: string): void
  getActiveTab(): Tab | undefined
  getActiveTabId(): string | null
  setActiveTab(id: string): void
  getDirtyTabs(): Tab[]
  markDirty(id: string): void
  markClean(id: string): void
  setViewMode(id: string, mode: ViewMode): void
  setSplitRatio(id: string, ratio: number): void
  findTabByFilePath(filePath: string): Tab | undefined
  getTabCount(): number
  getTabOrder(): string[]
  hasOpenFiles(): boolean
}

export interface CreateTabOptions {
  filePath?: string
  content?: string
  title?: string
  viewMode?: ViewMode
  fileType?: FileType
  splitRatio?: number
}

export interface TabUpdates {
  filePath?: string | null
  title: string
  content: string
  isDirty: boolean
  viewMode: ViewMode
  splitRatio: number
  fileType: FileType
  cursor: { from: number; to: number }
  scrollTop: number
  lastModified: number
}
