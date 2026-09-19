import type { IStorage } from '@core/domain/ports/gateways/IStorage'

export class StorageGateway implements IStorage {
  private storage: Map<string, unknown> = new Map()

  get<T>(key: string): T | undefined {
    return this.storage.get(key) as T | undefined
  }

  set<T>(key: string, value: T): void {
    this.storage.set(key, value)
  }

  delete(key: string): void {
    this.storage.delete(key)
  }

  has(key: string): boolean {
    return this.storage.has(key)
  }

  clear(): void {
    this.storage.clear()
  }

  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    this.storage.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  setAll(data: Record<string, unknown>): void {
    this.storage.clear()
    Object.entries(data).forEach(([key, value]) => {
      this.storage.set(key, value)
    })
  }
}

let instance: StorageGateway | null = null

export function useStorageGateway(): StorageGateway {
  if (!instance) {
    instance = new StorageGateway()
  }
  return instance
}
