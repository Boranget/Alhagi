import { serviceContainer } from './serviceContainer'
import { SERVICE_IDENTIFIERS } from '@/types/services'
import { TabService } from './tabService'
import { electronService } from './electron/ElectronService'
import { ElectronEventHandler } from './electron/ElectronEventHandler'
import { useI18n } from './i18n'
import { useClipboard } from './clipboard'
import { useCapture } from './capture'
import { useThemeService } from './theme/ThemeService'
import { useRecentFilesService } from './recentFiles/RecentFilesService'
import { errorManager } from './errorHandler'
import { imagePathResolver } from './imagePathResolver'
import { xssSanitizer } from './xssSanitizer'

export function registerAllServices(): void {
  serviceContainer.register(SERVICE_IDENTIFIERS.TAB_SERVICE, () => new TabService())
  serviceContainer.register(SERVICE_IDENTIFIERS.ELECTRON_SERVICE, () => electronService)
  
  serviceContainer.register(SERVICE_IDENTIFIERS.EVENT_HANDLER, () => {
    const api = window.electronAPI
    const handler = new ElectronEventHandler(api)
    handler.initialize()
    return handler
  })
  
  serviceContainer.register(SERVICE_IDENTIFIERS.I18N_SERVICE, () => useI18n())
  serviceContainer.register(SERVICE_IDENTIFIERS.CLIPBOARD_SERVICE, () => useClipboard())
  serviceContainer.register(SERVICE_IDENTIFIERS.CAPTURE_SERVICE, () => useCapture())
  serviceContainer.register(SERVICE_IDENTIFIERS.THEME_SERVICE, () => useThemeService())
  serviceContainer.register(SERVICE_IDENTIFIERS.RECENT_FILES_SERVICE, () => useRecentFilesService())
  serviceContainer.register(SERVICE_IDENTIFIERS.ERROR_HANDLER, () => errorManager)
  serviceContainer.register(SERVICE_IDENTIFIERS.IMAGE_PATH_RESOLVER, () => imagePathResolver)
  serviceContainer.register(SERVICE_IDENTIFIERS.XSS_SANITIZER, () => xssSanitizer)
}

export function getTabService(): TabService {
  return serviceContainer.resolve(SERVICE_IDENTIFIERS.TAB_SERVICE)!
}