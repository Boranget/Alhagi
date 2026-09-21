import type { IElectronSync } from '@core/domain/ports/gateways/IElectronSync'

export class ElectronSyncGateway implements IElectronSync {
  async syncOpenedFiles(filePaths: string[]): Promise<void> {
    if (!window.electronAPI) return
    await window.electronAPI.updateOpenedFiles(filePaths)
  }
}
