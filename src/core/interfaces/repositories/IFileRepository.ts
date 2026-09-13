import type { FileNode } from '@core/entities/FileNode'

export interface IFileRepository {
  getCurrentFolder(): string | null
  setCurrentFolder(path: string): void
  getFileTree(): FileNode | null
  setFileTree(tree: FileNode): void
  isLoading(): boolean
  setLoading(loading: boolean): void
  getError(): string | null
  setError(error: string | null): void
  clearError(): void
  toggleFolder(node: FileNode): void
  expandFolder(path: string): void
  collapseFolder(path: string): void
}
