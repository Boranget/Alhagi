export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface IIPC {
  invoke<T>(channel: string, ...args: unknown[]): Promise<IPCResponse<T>>
  send(channel: string, ...args: unknown[]): void
  on(channel: string, callback: (...args: unknown[]) => void): () => void
  once(channel: string, callback: (...args: unknown[]) => void): () => void
  off(channel: string, callback: (...args: unknown[]) => void): void
}
