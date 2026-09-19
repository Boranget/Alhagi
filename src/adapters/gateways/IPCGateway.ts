import type { IIPC, IPCResponse } from '@core/domain/ports/gateways/IIPC'
import { ElectronService } from '@/services/electron/ElectronService'

export class IPCGateway implements IIPC {
  private electronService = ElectronService.getInstance()

  async invoke<T>(channel: string, ...args: unknown[]): Promise<IPCResponse<T>> {
    const api = this.electronService.getAPI()
    if (!api) {
      return { success: false, error: { code: 'NO_API', message: 'Electron API not available' } }
    }
    // Use the channel-based invoke approach
    return await (api as any).invoke(channel, ...args) as IPCResponse<T>
  }

  send(channel: string, ...args: unknown[]): void {
    const api = this.electronService.getAPI()
    if (api) {
      (api as any).send?.(channel, ...args)
    }
  }

  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    const api = this.electronService.getAPI()
    if (api && (api as any).on) {
      const handler = (...args: unknown[]) => callback(...args)
      ;(api as any).on(channel, handler)
      return () => {
        (api as any).off?.(channel, handler)
      }
    }
    return () => {}
  }

  once(channel: string, callback: (...args: unknown[]) => void): () => void {
    const api = this.electronService.getAPI()
    if (api && (api as any).once) {
      const handler = (...args: unknown[]) => callback(...args)
      ;(api as any).once(channel, handler)
      return () => {
        (api as any).off?.(channel, handler)
      }
    }
    return () => {}
  }

  off(channel: string, callback: (...args: unknown[]) => void): void {
    const api = this.electronService.getAPI()
    if (api && (api as any).off) {
      (api as any).off(channel, callback)
    }
  }
}

let instance: IPCGateway | null = null

export function useIPCGateway(): IPCGateway {
  if (!instance) {
    instance = new IPCGateway()
  }
  return instance
}
