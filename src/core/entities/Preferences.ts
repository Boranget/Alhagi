import type { Theme } from '@shared/types'

export interface PreferencesProps {
  theme: Theme
  zoom: number
  fontSize: number
  lineHeight: number
  wordCountDisplayType: 'characters' | 'words'
  autoSave: boolean
  autoSaveInterval: number
  language: string
  showMenuBar: boolean
  hideScrollBars: boolean
  recentFiles: string[]
  recentFolders: string[]
  customThemes: Record<string, string>
  launchMode: 'lastSession' | 'fresh'
  launchFolderPath: string
  lineEnding: 'lf' | 'crlf'
}

export class Preferences {
  public theme: Theme
  public zoom: number
  public fontSize: number
  public lineHeight: number
  public wordCountDisplayType: 'characters' | 'words'
  public autoSave: boolean
  public autoSaveInterval: number
  public language: string
  public showMenuBar: boolean
  public hideScrollBars: boolean
  public recentFiles: string[]
  public recentFolders: string[]
  public customThemes: Record<string, string>
  public launchMode: 'lastSession' | 'fresh'
  public launchFolderPath: string
  public lineEnding: 'lf' | 'crlf'

  constructor(props: PreferencesProps) {
    this.theme = props.theme
    this.zoom = props.zoom
    this.fontSize = props.fontSize
    this.lineHeight = props.lineHeight
    this.wordCountDisplayType = props.wordCountDisplayType
    this.autoSave = props.autoSave
    this.autoSaveInterval = props.autoSaveInterval
    this.language = props.language
    this.showMenuBar = props.showMenuBar
    this.hideScrollBars = props.hideScrollBars
    this.recentFiles = props.recentFiles
    this.recentFolders = props.recentFolders
    this.customThemes = props.customThemes
    this.launchMode = props.launchMode
    this.launchFolderPath = props.launchFolderPath
    this.lineEnding = props.lineEnding
  }

  static createDefault(): Preferences {
    return new Preferences({
      theme: 'system',
      zoom: 1,
      fontSize: 16,
      lineHeight: 1.6,
      wordCountDisplayType: 'characters',
      autoSave: true,
      autoSaveInterval: 30000,
      language: 'zh-CN',
      showMenuBar: true,
      hideScrollBars: false,
      recentFiles: [],
      recentFolders: [],
      customThemes: {},
      launchMode: 'lastSession',
      launchFolderPath: '',
      lineEnding: 'lf',
    })
  }

  update<K extends keyof PreferencesProps>(key: K, value: PreferencesProps[K]): void {
    ;(this as any)[key] = value
  }

  updateMany(prefs: Partial<PreferencesProps>): void {
    Object.entries(prefs).forEach(([key, value]) => {
      if (value !== undefined) {
        ;(this as any)[key] = value
      }
    })
  }

  addRecentFile(filePath: string): void {
    const index = this.recentFiles.indexOf(filePath)
    if (index > -1) {
      this.recentFiles.splice(index, 1)
    }
    this.recentFiles.unshift(filePath)
    if (this.recentFiles.length > 50) {
      this.recentFiles.pop()
    }
  }

  addRecentFolder(folderPath: string): void {
    const index = this.recentFolders.indexOf(folderPath)
    if (index > -1) {
      this.recentFolders.splice(index, 1)
    }
    this.recentFolders.unshift(folderPath)
    if (this.recentFolders.length > 20) {
      this.recentFolders.pop()
    }
  }

  removeRecentFile(filePath: string): void {
    this.recentFiles = this.recentFiles.filter(f => f !== filePath)
  }

  removeRecentFolder(folderPath: string): void {
    this.recentFolders = this.recentFolders.filter(f => f !== folderPath)
  }

  zoomIn(): void {
    this.zoom = Math.min(3, this.zoom + 0.1)
  }

  zoomOut(): void {
    this.zoom = Math.max(0.5, this.zoom - 0.1)
  }

  resetZoom(): void {
    this.zoom = 1
  }

  toggleLightDark(): void {
    if (this.theme === 'light') {
      this.theme = 'dark'
    } else if (this.theme === 'dark') {
      this.theme = 'system'
    } else {
      this.theme = 'light'
    }
  }

  toggleWordCountDisplayType(): void {
    this.wordCountDisplayType = this.wordCountDisplayType === 'characters' ? 'words' : 'characters'
  }

  toProps(): PreferencesProps {
    return {
      theme: this.theme,
      zoom: this.zoom,
      fontSize: this.fontSize,
      lineHeight: this.lineHeight,
      wordCountDisplayType: this.wordCountDisplayType,
      autoSave: this.autoSave,
      autoSaveInterval: this.autoSaveInterval,
      language: this.language,
      showMenuBar: this.showMenuBar,
      hideScrollBars: this.hideScrollBars,
      recentFiles: [...this.recentFiles],
      recentFolders: [...this.recentFolders],
      customThemes: { ...this.customThemes },
      launchMode: this.launchMode,
      launchFolderPath: this.launchFolderPath,
      lineEnding: this.lineEnding,
    }
  }
}
