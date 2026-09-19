import type { IPreferencesRepository } from '@core/domain/ports/repositories/IPreferencesRepository'
import type { PreferencesProps } from '@core/entities/Preferences'

export class SyncPreferences {
  private unsubscribe: (() => void) | null = null

  constructor(
    private preferencesRepository: IPreferencesRepository
  ) {}

  start(): void {
    this.unsubscribe = this.preferencesRepository.subscribe((_patch) => {
      // Preferences are already synced via the repository's subscribe mechanism
    })
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }
}
