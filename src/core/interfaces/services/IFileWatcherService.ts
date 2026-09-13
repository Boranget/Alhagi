export interface IFileWatcherService {
  watch(path: string, callback: (event: string, path: string) => void): () => void
  unwatch(path: string): void
  unwatchAll(): void
  isWatching(path: string): boolean
  getWatchedPaths(): string[]
}
