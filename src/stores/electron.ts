import { defineStore } from 'pinia'
import { electronService } from '@/services/electron/ElectronService'
import type {
  LineEnding,
  DetachedTabData,
  IPCResponse,
  FileTreeNode,
  DirectoryEntry,
  SearchOptions,
  SearchResult,
} from '@electron-protocol/index'

export const useElectronStore = defineStore('electron', () => {
  function initialize(): void {
    electronService.initialize()
  }

  function dispose(): void {
    electronService.dispose()
  }

  function isAvailable(): boolean {
    return electronService.isAvailable()
  }

  function openFile() {
    return electronService.openFile()
  }

  function saveFile(filePath: string, content: string, lineEnding?: LineEnding): Promise<IPCResponse<boolean>> {
    return electronService.saveFile(filePath, content, lineEnding)
  }

  function saveAsFile(content: string, defaultPath?: string, lineEnding?: LineEnding): Promise<IPCResponse<string | null>> {
    return electronService.saveAsFile(content, defaultPath, lineEnding)
  }

  function readFile(filePath: string): Promise<IPCResponse<string>> {
    return electronService.readFile(filePath)
  }

  function readBinaryFile(filePath: string): Promise<IPCResponse<string>> {
    return electronService.readBinaryFile(filePath)
  }

  function saveBinaryFile(filePath: string, content: string): Promise<IPCResponse<boolean>> {
    return electronService.saveBinaryFile(filePath, content)
  }

  function ensureDirectory(dirPath: string): Promise<IPCResponse<boolean>> {
    return electronService.ensureDirectory(dirPath)
  }

  function getDocumentsDirectory(): Promise<IPCResponse<string>> {
    return electronService.getDocumentsDirectory()
  }

  function showInFolder(filePath: string): Promise<IPCResponse<boolean>> {
    return electronService.showInFolder(filePath)
  }

  function openFolder(): Promise<IPCResponse<{ path: string; tree: FileTreeNode[] } | null>> {
    return electronService.openFolder()
  }

  function readDirectory(dirPath: string): Promise<IPCResponse<DirectoryEntry[]>> {
    return electronService.readDirectory(dirPath)
  }

  function createFile(dirPath: string, fileName: string): Promise<IPCResponse<string | null>> {
    return electronService.createFile(dirPath, fileName)
  }

  function createDirectory(dirPath: string, dirName: string): Promise<IPCResponse<string | null>> {
    return electronService.createDirectory(dirPath, dirName)
  }

  function deleteFile(filePath: string): Promise<IPCResponse<boolean>> {
    return electronService.deleteFile(filePath)
  }

  function renameFile(oldPath: string, newName: string): Promise<IPCResponse<string | null>> {
    return electronService.renameFile(oldPath, newName)
  }

  function copyFile(sourcePath: string, targetDir: string): Promise<IPCResponse<string | null>> {
    return electronService.copyFile(sourcePath, targetDir)
  }

  function moveFile(sourcePath: string, targetDir: string): Promise<IPCResponse<string | null>> {
    return electronService.moveFile(sourcePath, targetDir)
  }

  function selectDirectory(): Promise<IPCResponse<string | null>> {
    return electronService.selectDirectory()
  }

  function searchInDirectory(dirPath: string, query: string, options?: SearchOptions): Promise<IPCResponse<SearchResult[]>> {
    return electronService.searchInDirectory(dirPath, query, options)
  }

  function checkFileOpen(filePath: string): Promise<IPCResponse<{ windowId: number | null }>> {
    return electronService.checkFileOpen(filePath)
  }

  function focusWindow(windowId: number, filePath?: string): Promise<IPCResponse<boolean>> {
    return electronService.focusWindow(windowId, filePath)
  }

  function getWindowId(): Promise<IPCResponse<number | null>> {
    return electronService.getWindowId()
  }

  function listWindows(): Promise<IPCResponse<Array<{ id: number; title: string; bounds: { x: number; y: number; width: number; height: number } }>>> {
    return electronService.listWindows()
  }

  function openNewWindow(options?: { filePath?: string; tabData?: DetachedTabData; bounds?: { x: number; y: number; width: number; height: number } }): Promise<IPCResponse<boolean | number>> {
    return electronService.openNewWindow(options)
  }

  function mergeTab(tabData: DetachedTabData, targetWindowId: number): Promise<IPCResponse<boolean>> {
    return electronService.mergeTab(tabData, targetWindowId)
  }

  function updateOpenedFiles(filePaths: string[]): Promise<IPCResponse<boolean>> {
    return electronService.updateOpenedFiles(filePaths)
  }

  function getCursorScreenPoint(): Promise<IPCResponse<{ x: number; y: number } | null>> {
    return electronService.getCursorScreenPoint()
  }

  function getScreenDisplay(): Promise<IPCResponse<{ x: number; y: number; width: number; height: number } | null>> {
    return electronService.getScreenDisplay()
  }

  function openDevTools(): void {
    electronService.openDevTools()
  }

  function openBlankNewWindow(): Promise<void> {
    return electronService.openBlankNewWindow()
  }

  function setupTabMergeHandler(handler: (tabData: DetachedTabData) => void): void {
    electronService.setupTabMergeHandler(handler)
  }

  function setupTabDetachHandler(handler: (tabData: DetachedTabData) => void): void {
    electronService.setupTabDetachHandler(handler)
  }

  function setupFocusTabHandler(handler: (filePath: string) => void): void {
    electronService.setupFocusTabHandler(handler)
  }

  function $reset() {
    electronService.dispose()
  }

  return {
    initialize,
    dispose,
    isAvailable,
    openFile,
    saveFile,
    saveAsFile,
    readFile,
    readBinaryFile,
    saveBinaryFile,
    ensureDirectory,
    getDocumentsDirectory,
    showInFolder,
    openFolder,
    readDirectory,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,
    copyFile,
    moveFile,
    selectDirectory,
    searchInDirectory,
    checkFileOpen,
    focusWindow,
    getWindowId,
    listWindows,
    openNewWindow,
    mergeTab,
    updateOpenedFiles,
    getCursorScreenPoint,
    getScreenDisplay,
    openDevTools,
    openBlankNewWindow,
    setupTabMergeHandler,
    setupTabDetachHandler,
    setupFocusTabHandler,
    $reset,
  }
})
