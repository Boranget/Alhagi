export interface IElectronSync {
  syncOpenedFiles(filePaths: string[]): Promise<void>
}
