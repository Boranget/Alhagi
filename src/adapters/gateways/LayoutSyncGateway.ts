import type { ILayoutSync } from '@core/domain/ports/gateways/ILayoutSync'

export class LayoutSyncGateway implements ILayoutSync {
  async notifyLayoutChanged(payload: Record<string, unknown>): Promise<void> {
    if (!window.electronAPI) return
    await window.electronAPI.layoutChanged(payload)
  }
}
