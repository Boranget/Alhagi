import type { IFileWatcherService } from '@core/domain/ports/services/IFileWatcherService'
import { ElectronService } from '@/services/electron/ElectronService'

export class FileWatcherServiceGateway implements IFileWatcherService {
  private electronService = ElectronService.getInstance()
  private watchers: Map<string, () => void> = new Map()

  watch(path: string, callback: (event: string, path: string) => void): () => void {
    const api = this.electronService.getAPI()
    if (!api) {
      return () => {}
    }

    const handler = (_event: unknown, changedPath: string) => {
      if (changedPath === path || changedPath.startsWith(path + '/')) {
        callback('change', changedPath)
      }
    }

    // Register the watcher if available
    if ((api as any).onFileChanged) {
      const unsubscribe = (api as any).onFileChanged(handler)
      this.watchers.set(path, unsubscribe)
      return () => {
        this.unwatch(path)
      }
    }

    return () => {}
  }

  unwatch(path: string): void {
    const unsubscribe = this.watchers.get(path)
    if (unsubscribe) {
      unsubscribe()
      this.watchers.delete(path)
    }
  }

  unwatchAll(): void {
    this.watchers.forEach((unsubscribe) => {
      unsubscribe()
    })
    this.watchers.clear()
  }

  isWatching(path: string): boolean {
    return this.watchers.has(path)
  }

  getWatchedPaths(): string[] {
    return Array.from(this.watchers.keys())
  }
}

let instance: FileWatcherServiceGateway | null = null

export function useFileWatcherServiceGateway(): FileWatcherServiceGateway {
  if (!instance) {
    instance = new FileWatcherServiceGateway()
  }
  return instance
}
