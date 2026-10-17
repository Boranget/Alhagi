import type { IIPC, IPCResponse } from '@core/domain/ports/gateways/IIPC'
import { ElectronService } from '@/services/electron/ElectronService'

/** preload 未声明的 channel 级通信面（invoke/send/on/once/off）——按结构收窄访问 */
type ChannelIpcApi = {
  invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
  send?: (channel: string, ...args: unknown[]) => void
  on?: (channel: string, handler: (...args: unknown[]) => void) => void
  once?: (channel: string, handler: (...args: unknown[]) => void) => void
  off?: (channel: string, handler: (...args: unknown[]) => void) => void
}

function channelApi(api: unknown): ChannelIpcApi | null {
  return api && typeof api === 'object' ? (api as ChannelIpcApi) : null
}

export class IPCGateway implements IIPC {
  private electronService = ElectronService.getInstance()

  async invoke<T>(channel: string, ...args: unknown[]): Promise<IPCResponse<T>> {
    const api = channelApi(this.electronService.getAPI())
    if (!api?.invoke) {
      return { success: false, error: { code: 'NO_API', message: 'Electron API not available' } }
    }
    // Use the channel-based invoke approach
    return await api.invoke(channel, ...args) as IPCResponse<T>
  }

  send(channel: string, ...args: unknown[]): void {
    const api = channelApi(this.electronService.getAPI())
    api?.send?.(channel, ...args)
  }

  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    const api = channelApi(this.electronService.getAPI())
    if (api?.on) {
      const handler = (...args: unknown[]) => callback(...args)
      api.on(channel, handler)
      return () => {
        api.off?.(channel, handler)
      }
    }
    return () => {}
  }

  once(channel: string, callback: (...args: unknown[]) => void): () => void {
    const api = channelApi(this.electronService.getAPI())
    if (api?.once) {
      const handler = (...args: unknown[]) => callback(...args)
      api.once(channel, handler)
      return () => {
        api.off?.(channel, handler)
      }
    }
    return () => {}
  }

  off(channel: string, callback: (...args: unknown[]) => void): void {
    const api = channelApi(this.electronService.getAPI())
    api?.off?.(channel, callback)
  }
}

let instance: IPCGateway | null = null

export function useIPCGateway(): IPCGateway {
  if (!instance) {
    instance = new IPCGateway()
  }
  return instance
}
