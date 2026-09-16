export interface ImageStorageResult {
  success: boolean
  filePath?: string
  relativePath?: string
  error?: string
}

export interface IImageStorage {
  saveImage(data: string, fileName: string, mimeType: string, targetDir: string): Promise<ImageStorageResult>
  getImagePath(fileName: string, targetDir: string): Promise<string>
  ensureDirectory(dirPath: string): Promise<void>
  getRelativePath(fromPath: string, toPath: string): Promise<string>
  getDocumentsDirectory(): Promise<string>
}
