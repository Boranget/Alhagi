import type { ICommandHandler } from '@core/domain/ports/IMediator'
import type { Preferences } from '@/stores/preferences'
import { usePreferencesStore } from '@/stores/preferences'

/** 命令 payload 在中介者边界是动态的；按各 case 实际消费的字段声明 */
interface PreferenceCommandParams {
  key: keyof Preferences
  value: Preferences[keyof Preferences]
  patch: Partial<Preferences>
  filePath: string
  title: string
  pinned: boolean
  folderPath: string
  name: string
  data: Preferences['lastSession']
}

export class PreferenceCommandHandler {
  private store = usePreferencesStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type, ...params } = payload as { type: string } & PreferenceCommandParams
    switch (type) {
      case 'pref:set':
        return this.store.setOne(params.key, params.value)
      case 'pref:setMany':
        return this.store.setMany(params.patch)
      case 'pref:zoomIn':
        return this.store.zoomIn()
      case 'pref:zoomOut':
        return this.store.zoomOut()
      case 'pref:resetZoom':
        return this.store.resetZoom()
      case 'pref:toggleLightDark':
        return this.store.toggleLightDark()
      case 'pref:toggleWordCountDisplay':
        return this.store.toggleWordCountDisplayType()
      case 'pref:resetToDefaults':
        return this.store.resetToDefaults()
      case 'pref:addRecentFile':
        return this.store.addRecentFile(params.filePath, params.title)
      case 'pref:removeRecentFile':
        return this.store.removeRecentFile(params.filePath)
      case 'pref:pinRecentFile':
        return this.store.pinRecentFile(params.filePath, params.pinned)
      case 'pref:clearRecentFiles':
        return this.store.clearRecentFiles()
      case 'pref:addRecentFolder':
        return this.store.addRecentFolder(params.folderPath, params.name)
      case 'pref:removeRecentFolder':
        return this.store.removeRecentFolder(params.folderPath)
      case 'pref:pinRecentFolder':
        return this.store.pinRecentFolder(params.folderPath, params.pinned)
      case 'pref:clearRecentFolders':
        return this.store.clearRecentFolders()
      case 'pref:saveSession':
        return this.store.saveSession(params.data)
      case 'pref:clearSession':
        return this.store.clearSession()
      default:
        throw new Error(`Unknown preference command: ${type}`)
    }
  }
}
