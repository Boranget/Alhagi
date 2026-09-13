import type { IPreferencesRepository } from '@core/interfaces/repositories/IPreferencesRepository'
import type { PreferencesProps } from '@core/entities/Preferences'

export class UpdatePreference {
  constructor(
    private preferencesRepository: IPreferencesRepository
  ) {}

  async execute<K extends keyof PreferencesProps>(key: K, value: PreferencesProps[K]): Promise<void> {
    await this.preferencesRepository.set(key, value)
  }
}
