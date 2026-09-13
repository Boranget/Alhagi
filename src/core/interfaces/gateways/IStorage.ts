export interface IStorage {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  delete(key: string): void
  has(key: string): boolean
  clear(): void
  getAll(): Record<string, unknown>
  setAll(data: Record<string, unknown>): void
}
