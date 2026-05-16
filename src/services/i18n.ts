export type Language = 'zh-CN' | 'en'

export interface Translations {
  [key: string]: string | Translations
}

const zhCN: Translations = {
  common: {
    save: '保存',
    saveAs: '另存为',
    newFile: '新建文件',
    openFile: '打开文件',
    close: '关闭',
    cancel: '取消',
    confirm: '确认',
    export: '导出',
    settings: '设置'
  },
  sidebar: {
    fileExplorer: '文件浏览器',
    globalSearch: '全局搜索',
    documentOutline: '文档大纲',
    recentFiles: '最近文件'
  },
  editor: {
    wysiwyg: '所见即所得',
    source: '源码',
    split: '分屏',
    typewriter: '打字机',
    focus: '专注'
  },
  settings: {
    general: '通用',
    save: '保存',
    appearance: '外观',
    editor: '编辑器',
    images: '图片',
    language: '语言',
    developer: '开发',
    launchMode: '启动模式',
    restore: '恢复上次',
    welcome: '欢迎页',
    blank: '空白编辑器',
    autoSave: '自动保存',
    autoSaveInterval: '自动保存间隔（秒）',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
    showSidebar: '显示侧边栏',
    showStatusBar: '显示状态栏',
    hideScrollBars: '隐藏滚动条',
    typewriterMode: '打字机模式',
    focusMode: '专注模式',
    fontSize: '字体大小',
    defaultImageInsertMode: '默认图片插入模式',
    keepOriginal: '保留原始路径',
    copyAbsolute: '复制并使用绝对路径',
    copyRelative: '复制并使用相对路径',
    imageStoragePath: '图片保存目录',
    interfaceLanguage: '界面语言',
    devToolsOnStartup: '启动时打开开发者工具'
  }
}

const en: Translations = {
  common: {
    save: 'Save',
    saveAs: 'Save As',
    newFile: 'New File',
    openFile: 'Open File',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    export: 'Export',
    settings: 'Settings'
  },
  sidebar: {
    fileExplorer: 'File Explorer',
    globalSearch: 'Global Search',
    documentOutline: 'Document Outline',
    recentFiles: 'Recent Files'
  },
  editor: {
    wysiwyg: 'WYSIWYG',
    source: 'Source',
    split: 'Split',
    typewriter: 'Typewriter',
    focus: 'Focus'
  },
  settings: {
    general: 'General',
    save: 'Save',
    appearance: 'Appearance',
    editor: 'Editor',
    images: 'Images',
    language: 'Language',
    developer: 'Developer',
    launchMode: 'Launch Mode',
    restore: 'Restore Last',
    welcome: 'Welcome Page',
    blank: 'Blank Editor',
    autoSave: 'Auto Save',
    autoSaveInterval: 'Auto Save Interval (seconds)',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    showSidebar: 'Show Sidebar',
    showStatusBar: 'Show Status Bar',
    hideScrollBars: 'Hide Scroll Bars',
    typewriterMode: 'Typewriter Mode',
    focusMode: 'Focus Mode',
    fontSize: 'Font Size',
    defaultImageInsertMode: 'Default Image Insert Mode',
    keepOriginal: 'Keep Original Path',
    copyAbsolute: 'Copy with Absolute Path',
    copyRelative: 'Copy with Relative Path',
    imageStoragePath: 'Image Storage Path',
    interfaceLanguage: 'Interface Language',
    devToolsOnStartup: 'Open Dev Tools on Startup'
  }
}

const translations: Record<Language, Translations> = {
  'zh-CN': zhCN,
  'en': en
}

let currentLanguage: Language = 'zh-CN'

export function setLanguage(lang: Language) {
  currentLanguage = lang
}

export function t(key: string): string {
  const keys = key.split('.')
  let value: any = translations[currentLanguage]
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      return key
    }
  }
  
  return typeof value === 'string' ? value : key
}
