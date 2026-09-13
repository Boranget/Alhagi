import type { RecentFile, RecentFolder } from '@shared/types'

export interface IRecentFilesService {
  addRecentFile(filePath: string, title: string): void
  removeRecentFile(filePath: string): void
  pinRecentFile(filePath: string, pinned: boolean): void
  clearRecentFiles(): void
  addRecentFolder(folderPath: string, name: string): void
  removeRecentFolder(folderPath: string): void
  pinRecentFolder(folderPath: string, pinned: boolean): void
  clearRecentFolders(): void
}

export class RecentFilesServiceGateway implements IRecentFilesService {
  private recentFiles: RecentFile[] = []
  private recentFolders: RecentFolder[] = []
  private maxRecentFiles = 50
  private maxRecentFolders = 20

  setRecentFiles(files: RecentFile[]): void {
    this.recentFiles = files
  }

  setRecentFolders(folders: RecentFolder[]): void {
    this.recentFolders = folders
  }

  setMaxRecentFiles(max: number): void {
    this.maxRecentFiles = max
  }

  setMaxRecentFolders(max: number): void {
    this.maxRecentFolders = max
  }

  private trim<T extends { pinned: boolean }>(list: T[], limit: number): T[] {
    if (list.length <= limit) return list
    const pinned = list.filter((x) => x.pinned)
    const unpinned = list.filter((x) => !x.pinned)
    while (pinned.length + unpinned.length > limit && unpinned.length > 0) {
      unpinned.pop()
    }
    return [...pinned, ...unpinned]
  }

  addRecentFile(filePath: string, title: string): void {
    const existingIndex = this.recentFiles.findIndex((f) => f.filePath === filePath)
    let next: RecentFile[]
    if (existingIndex !== -1) {
      const existing = { ...this.recentFiles[existingIndex], lastOpened: Date.now() }
      next = [existing, ...this.recentFiles.slice(0, existingIndex), ...this.recentFiles.slice(existingIndex + 1)]
    } else {
      next = [{ filePath, title, lastOpened: Date.now(), pinned: false }, ...this.recentFiles]
      next = this.trim(next, this.maxRecentFiles)
    }
    this.recentFiles = next
  }

  removeRecentFile(filePath: string): void {
    const next = this.recentFiles.filter((f) => f.filePath !== filePath)
    if (next.length !== this.recentFiles.length) {
      this.recentFiles = next
    }
  }

  pinRecentFile(filePath: string, pinned: boolean): void {
    const idx = this.recentFiles.findIndex((f) => f.filePath === filePath)
    if (idx === -1) return
    const updated = { ...this.recentFiles[idx], pinned }
    let next: RecentFile[] = [...this.recentFiles.slice(0, idx), updated, ...this.recentFiles.slice(idx + 1)]
    if (pinned) {
      next = [updated, ...next.filter((f) => f.filePath !== filePath)]
      const p = next.filter((f) => f.pinned)
      const u = next.filter((f) => !f.pinned)
      next = [...p, ...u]
    }
    this.recentFiles = next
  }

  clearRecentFiles(): void {
    this.recentFiles = this.recentFiles.filter((f) => f.pinned)
  }

  addRecentFolder(folderPath: string, name: string): void {
    const existingIndex = this.recentFolders.findIndex((f) => f.folderPath === folderPath)
    let next: RecentFolder[]
    if (existingIndex !== -1) {
      const existing = { ...this.recentFolders[existingIndex], lastOpened: Date.now() }
      next = [existing, ...this.recentFolders.slice(0, existingIndex), ...this.recentFolders.slice(existingIndex + 1)]
    } else {
      next = [{ folderPath, name, lastOpened: Date.now(), pinned: false }, ...this.recentFolders]
      next = this.trim(next, this.maxRecentFolders)
    }
    this.recentFolders = next
  }

  removeRecentFolder(folderPath: string): void {
    const next = this.recentFolders.filter((f) => f.folderPath !== folderPath)
    if (next.length !== this.recentFolders.length) {
      this.recentFolders = next
    }
  }

  pinRecentFolder(folderPath: string, pinned: boolean): void {
    const idx = this.recentFolders.findIndex((f) => f.folderPath === folderPath)
    if (idx === -1) return
    const updated = { ...this.recentFolders[idx], pinned }
    let next: RecentFolder[] = [...this.recentFolders.slice(0, idx), updated, ...this.recentFolders.slice(idx + 1)]
    if (pinned) {
      next = [updated, ...next.filter((f) => f.folderPath !== folderPath)]
      const p = next.filter((f) => f.pinned)
      const u = next.filter((f) => !f.pinned)
      next = [...p, ...u]
    }
    this.recentFolders = next
  }

  clearRecentFolders(): void {
    this.recentFolders = this.recentFolders.filter((f) => f.pinned)
  }
}

let instance: RecentFilesServiceGateway | null = null

export function useRecentFilesServiceGateway(): RecentFilesServiceGateway {
  if (!instance) {
    instance = new RecentFilesServiceGateway()
  }
  return instance
}
