export interface DirectoryEntry {
  name: string
  isDirectory: boolean
}

export interface FileStats {
  isDirectory: boolean
  size: number
  lastModified: number
}

export interface IFileSystem {
  readFile(path: string): Promise<string>
  readBinary(path: string): Promise<{ data: string; mimeType: string }>
  writeFile(path: string, content: string): Promise<void>
  writeBinary(path: string, data: string, mimeType: string): Promise<void>
  exists(path: string): Promise<boolean>
  existsBatch(paths: string[]): Promise<boolean[]>
  mkdir(path: string): Promise<void>
  readdir(path: string): Promise<DirectoryEntry[]>
  stat(path: string): Promise<FileStats>
  rename(oldPath: string, newPath: string): Promise<void>
  delete(path: string): Promise<void>
  copy(source: string, destination: string): Promise<void>
  move(source: string, destination: string): Promise<void>
  ensureDirectory(path: string): Promise<void>
  showInFolder(path: string): Promise<void>
  getDocumentsDirectory(): Promise<string>
}
