import type { IFileRepository } from '@core/interfaces/repositories/IFileRepository'
import type { FileTreeNodeType } from '@shared/types'
import { FileNode } from '@core/entities/FileNode'
import { defineStore } from 'pinia'
import { useFileExplorerStore } from '@/stores/fileExplorer'

/**
 * FileExplorerRepository adapter - 代理原始 useFileExplorerStore
 * 
 * 架构设计：
 * - 实现 Core 层定义的 IFileRepository 接口
 * - 内部代理原始 Pinia store，保持数据一致性
 * - 将 FileTreeNodeType[] 转换为 FileNode 树供 Core 层使用
 */
export const useFileRepository = defineStore('fileExplorerRepo', (): IFileRepository => {
  const originalStore = useFileExplorerStore()

  // FileTreeNodeType[] -> FileNode 树转换
  function toFileNodeTree(nodes: FileTreeNodeType[]): FileNode | null {
    if (nodes.length === 0) return null

    // 找到根节点（通常是第一个）
    const root = nodes[0]
    return buildFileNode(root, nodes)
  }

  function buildFileNode(node: FileTreeNodeType, allNodes: FileTreeNodeType[]): FileNode {
    const children = allNodes
      .filter(n => n.path.startsWith(node.path + '/') || n.path.startsWith(node.path + '\\'))
      .filter(n => {
        // 只处理直接子节点
        const relativePath = n.path.substring(node.path.length + 1)
        return !relativePath.includes('/') && !relativePath.includes('\\')
      })
      .map(n => buildFileNode(n, allNodes))

    return new FileNode({
      path: node.path,
      name: node.name,
      isDirectory: node.type === 'directory' || (node.type as string) === 'folder',
      children: children.map(c => c.toProps()),
      isExpanded: node.expanded || false,
    })
  }

  // FileNode 树 -> FileTreeNodeType[] 转换（用于写回）
  function toFileTreeNodeArray(node: FileNode): FileTreeNodeType[] {
    const result: FileTreeNodeType[] = [{
      name: node.name,
      path: node.path,
      type: node.isDirectory ? 'directory' : 'file',
      expanded: node.isExpanded,
      children: node.children.length > 0 ? [] : undefined,
    }]

    for (const child of node.children) {
      result.push(...toFileTreeNodeArray(child))
    }

    return result
  }

  const getCurrentFolder = (): string | null => {
    return originalStore.currentFolder
  }

  const setCurrentFolder = (path: string): void => {
    originalStore.currentFolder = path
  }

  const getFileTree = (): FileNode | null => {
    return toFileNodeTree(originalStore.fileTree)
  }

  const setFileTree = (tree: FileNode): void => {
    originalStore.fileTree = toFileTreeNodeArray(tree)
  }

  const isLoading = (): boolean => {
    return originalStore.isLoading
  }

  const setLoading = (loading: boolean): void => {
    originalStore.isLoading = loading
  }

  const getError = (): string | null => {
    return originalStore.error
  }

  const setError = (errorMsg: string | null): void => {
    originalStore.error = errorMsg
  }

  const clearError = (): void => {
    originalStore.error = null
  }

  const toggleFolder = (node: FileNode): void => {
    node.toggleExpanded()
  }

  const expandFolder = (path: string): void => {
    // 通过原始 store 的方法实现
    const node = originalStore.fileTree.find(n => n.path === path)
    if (node) {
      node.expanded = true
    }
  }

  const collapseFolder = (path: string): void => {
    const node = originalStore.fileTree.find(n => n.path === path)
    if (node) {
      node.expanded = false
    }
  }

  return {
    getCurrentFolder,
    setCurrentFolder,
    getFileTree,
    setFileTree,
    isLoading,
    setLoading,
    getError,
    setError,
    clearError,
    toggleFolder,
    expandFolder,
    collapseFolder,
  }
})
