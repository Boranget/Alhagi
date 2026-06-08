export type ServiceIdentifier = string | symbol

export interface ServiceDefinition<T> {
  factory: () => T
  singleton: boolean
  instance?: T
}

export interface ServiceContainer {
  register<T>(id: ServiceIdentifier, factory: () => T, singleton?: boolean): void
  resolve<T>(id: ServiceIdentifier): T | undefined
  has(id: ServiceIdentifier): boolean
  remove(id: ServiceIdentifier): void
  clear(): void
}

export const SERVICE_IDENTIFIERS = {
  TAB_SERVICE: Symbol('TabService'),
  ELECTRON_SERVICE: Symbol('ElectronService'),
  EVENT_HANDLER: Symbol('ElectronEventHandler'),
  I18N_SERVICE: Symbol('I18nService'),
  CLIPBOARD_SERVICE: Symbol('ClipboardService'),
  CAPTURE_SERVICE: Symbol('CaptureService'),
  THEME_SERVICE: Symbol('ThemeService'),
  RECENT_FILES_SERVICE: Symbol('RecentFilesService'),
  ERROR_HANDLER: Symbol('ErrorHandler'),
  KEYBINDING_SERVICE: Symbol('KeybindingService'),
  IMAGE_PATH_RESOLVER: Symbol('ImagePathResolver'),
  XSS_SANITIZER: Symbol('XssSanitizer'),
} as const

export type ServiceIdentifierType = typeof SERVICE_IDENTIFIERS[keyof typeof SERVICE_IDENTIFIERS]