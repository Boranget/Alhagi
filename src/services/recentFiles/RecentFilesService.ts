// ============================================================
// RecentFilesService - 最近文件 / 文件夹 列表（Single-Writer）
// ============================================================
//
// 在 single-writer 模式下，这里的所有"修改"都不能直接 mutate 数组 ref，
// 必须构造新数组通过 setOne('recentFiles' | 'recentFolders', newList) 推送。
// 主进程写盘后广播 patch 回来，渲染端 ref 才更新。

import { usePreferencesStore } from '@/stores/preferences'
import type { RecentFile, RecentFolder } from '@/types'

export function useRecentFilesService() {
  const prefs = usePreferencesStore()

  /** 限制 unpinned 数量，pinned 永不被裁剪。 */
  function trim<T extends { pinned: boolean }>(list: T[], limit: number): T[] {
    if (list.length <= limit) return list
    const pinned = list.filter((x) => x.pinned)
    const unpinned = list.filter((x) => !x.pinned)
    while (pinned.length + unpinned.length > limit && unpinned.length > 0) {
      unpinned.pop()
    }
    return [...pinned, ...unpinned]
  }

  function addRecentFile(filePath: string, title: string): void {
    const list = prefs.recentFiles
    const existingIndex = list.findIndex((f) => f.filePath === filePath)
    let next: RecentFile[]
    if (existingIndex !== -1) {
      const existing = { ...list[existingIndex], lastOpened: Date.now() }
      next = [existing, ...list.slice(0, existingIndex), ...list.slice(existingIndex + 1)]
    } else {
      next = [{ filePath, title, lastOpened: Date.now(), pinned: false }, ...list]
      next = trim(next, prefs.maxRecentFiles)
    }
    prefs.setOne('recentFiles', next)
  }

  function removeRecentFile(filePath: string): void {
    const next = prefs.recentFiles.filter((f) => f.filePath !== filePath)
    if (next.length !== prefs.recentFiles.length) {
      prefs.setOne('recentFiles', next)
    }
  }

  function pinRecentFile(filePath: string, pinned: boolean): void {
    const list = prefs.recentFiles
    const idx = list.findIndex((f) => f.filePath === filePath)
    if (idx === -1) return
    const updated = { ...list[idx], pinned }
    let next: RecentFile[] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)]
    if (pinned) {
      // pin → 移到 pinned 区开头
      next = [updated, ...next.filter((f) => f.filePath !== filePath)]
      const p = next.filter((f) => f.pinned)
      const u = next.filter((f) => !f.pinned)
      next = [...p, ...u]
    }
    prefs.setOne('recentFiles', next)
  }

  function clearRecentFiles(): void {
    prefs.setOne('recentFiles', prefs.recentFiles.filter((f) => f.pinned))
  }

  function addRecentFolder(folderPath: string, name: string): void {
    const list = prefs.recentFolders
    const existingIndex = list.findIndex((f) => f.folderPath === folderPath)
    let next: RecentFolder[]
    if (existingIndex !== -1) {
      const existing = { ...list[existingIndex], lastOpened: Date.now() }
      next = [existing, ...list.slice(0, existingIndex), ...list.slice(existingIndex + 1)]
    } else {
      next = [{ folderPath, name, lastOpened: Date.now(), pinned: false }, ...list]
      next = trim(next, prefs.maxRecentFolders)
    }
    prefs.setOne('recentFolders', next)
  }

  function removeRecentFolder(folderPath: string): void {
    const next = prefs.recentFolders.filter((f) => f.folderPath !== folderPath)
    if (next.length !== prefs.recentFolders.length) {
      prefs.setOne('recentFolders', next)
    }
  }

  function pinRecentFolder(folderPath: string, pinned: boolean): void {
    const list = prefs.recentFolders
    const idx = list.findIndex((f) => f.folderPath === folderPath)
    if (idx === -1) return
    const updated = { ...list[idx], pinned }
    let next: RecentFolder[] = [...list.slice(0, idx), updated, ...list.slice(idx + 1)]
    if (pinned) {
      next = [updated, ...next.filter((f) => f.folderPath !== folderPath)]
      const p = next.filter((f) => f.pinned)
      const u = next.filter((f) => !f.pinned)
      next = [...p, ...u]
    }
    prefs.setOne('recentFolders', next)
  }

  function clearRecentFolders(): void {
    prefs.setOne('recentFolders', prefs.recentFolders.filter((f) => f.pinned))
  }

  return {
    addRecentFile,
    removeRecentFile,
    pinRecentFile,
    clearRecentFiles,
    addRecentFolder,
    removeRecentFolder,
    pinRecentFolder,
    clearRecentFolders,
  }
}
