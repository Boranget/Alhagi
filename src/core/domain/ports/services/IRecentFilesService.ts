// ============================================================
// IRecentFilesService – 最近文件服务接口
// ============================================================
//
// 定义最近文件/文件夹操作的契约。
// 由 RecentFilesServiceGateway 实现。

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
