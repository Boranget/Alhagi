export interface ImageStorageResult {
  success: boolean
  filePath?: string
  relativePath?: string
  error?: string
}

export interface IImageStorage {
  saveImage(data: string, fileName: string, mimeType: string, targetDir: string): Promise<ImageStorageResult>
  ensureDirectory(dirPath: string): Promise<void>
  getDocumentsDirectory(): Promise<string>
}
