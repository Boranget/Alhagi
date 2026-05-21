export type Language = 'zh-CN' | 'en'

export interface Translations {
  [key: string]: string | Translations
}

const zhCN: Translations = {
  common: {
    save: '保存',
    saveAs: '另存为',
    newFile: '新建文件',
    newFolder: '新建文件夹',
    openFile: '打开文件',
    openFolder: '打开文件夹',
    close: '关闭',
    cancel: '取消',
    confirm: '确认',
    export: '导出',
    settings: '设置',
    refresh: '刷新',
    delete: '删除',
    rename: '重命名',
    copy: '复制',
    cut: '剪切',
    paste: '粘贴',
    ok: '确定',
    yes: '是',
    no: '否',
    unsavedChanges: '未保存的更改'
  },
  sidebar: {
    fileExplorer: '文件浏览器',
    globalSearch: '全局搜索',
documentOutline: '文档大纲',
    noHeadings: '文档中没有标题',
    outlineNotAvailable: '大纲不可用',
    recentFiles: '最近文件',
    currentFile: '当前文件',
    currentFolder: '当前文件夹',
    allTabs: '所有标签页',
    clearHistory: '清除历史记录',
    pin: '固定',
    unpin: '取消固定',
    clickToStart: '点击"打开文件夹"开始',
    unsupportedFileType: '不支持当前文件格式'
  },
  editor: {
    wysiwyg: '所见即所得',
    source: '源码',
    split: '分屏',
    typewriter: '打字机',
    focus: '专注',
    wysiwygMode: 'WYSIWYG 模式',
    sourceMode: '源码模式',
    splitMode: '分屏模式',
    typewriterMode: '打字机模式',
    focusMode: '专注模式',
    plainTextChars: '渲染后纯文本字符数',
    rawMarkdownChars: '原始 Markdown 字符数',
    lineCount: '行数',
    cursorPosition: '光标位置',
    characters: '字符',
    unsupportedFileType: '不支持当前文件格式',
    onlyMarkdownSupported: '当前仅支持编辑 Markdown (.md, .markdown) 文件',
    loadingImage: '正在加载图片...',
    failedToLoadImage: '无法加载图片'
  },
  tabs: {
    untitled: '未命名',
    cannotDetachLast: '无法分离最后一个标签',
    closeThisTab: '关闭此标签页',
    closeOtherTabs: '关闭其他标签页',
    closeSavedTabs: '关闭已保存的标签页',
    closeAllTabs: '关闭所有标签页',
    copyPath: '复制路径',
    showInFolder: '在文件夹中显示',
    detachToNewWindow: '分离到新窗口',
    releaseToMerge: '释放以合并到其他窗口',
    releaseToNewWindow: '释放以创建新窗口'
  },
  statusBar: {
    switchTheme: '切换主题',
    renderTextCount: '渲染后纯文本字符数',
    toggleSidebar: '切换侧边栏',
    wordCountDisplay: '字数统计显示'
  },
  search: {
    searchPlaceholder: '搜索...',
    replacePlaceholder: '替换...',
    caseSensitive: '区分大小写',
    regex: '正则表达式',
    wholeWord: '全字匹配',
    includePattern: '包含文件',
    excludePattern: '排除文件',
    searchInFolder: '在文件夹中搜索',
    replaceAll: '全部替换',
    noResults: '未找到结果',
    previousMatch: '上一个匹配',
    nextMatch: '下一个匹配',
    replace: '替换',
    matchCount: '处匹配'
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
    devToolsOnStartup: '启动时打开开发者工具',
    showTabBar: '显示标签栏',
    openInNewWindow: '在新窗口中打开文件',
    openFolderInNewWindow: '在新窗口中打开文件夹'
  },
  contextMenu: {
    moveToTrash: '移动到回收站',
    copyFullPath: '复制完整路径',
    copyRelativePath: '复制相对路径',
    showInExplorer: '在文件夹中显示'
  }
}

const en: Translations = {
  common: {
    save: 'Save',
    saveAs: 'Save As',
    newFile: 'New File',
    newFolder: 'New Folder',
    openFile: 'Open File',
    openFolder: 'Open Folder',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    export: 'Export',
    settings: 'Settings',
    refresh: 'Refresh',
    delete: 'Delete',
    rename: 'Rename',
    copy: 'Copy',
    cut: 'Cut',
    paste: 'Paste',
    ok: 'OK',
    yes: 'Yes',
    no: 'No',
    unsavedChanges: 'Unsaved changes'
  },
  sidebar: {
    fileExplorer: 'File Explorer',
    globalSearch: 'Global Search',
documentOutline: 'Document Outline',
    noHeadings: 'No headings found',
    outlineNotAvailable: 'Outline not available',
    recentFiles: 'Recent Files',
    currentFile: 'Current File',
    currentFolder: 'Current Folder',
    allTabs: 'All Tabs',
    clearHistory: 'Clear History',
    pin: 'Pin',
    unpin: 'Unpin',
    clickToStart: 'Click "Open Folder" to start',
    unsupportedFileType: 'Unsupported file format'
  },
  editor: {
    wysiwyg: 'WYSIWYG',
    source: 'Source',
    split: 'Split',
    typewriter: 'Typewriter',
    focus: 'Focus',
    wysiwygMode: 'WYSIWYG Mode',
    sourceMode: 'Source Mode',
    splitMode: 'Split Mode',
    typewriterMode: 'Typewriter Mode',
    focusMode: 'Focus Mode',
    plainTextChars: 'Rendered Plain Text Characters',
    rawMarkdownChars: 'Raw Markdown Character Count',
    lineCount: 'Line Count',
    cursorPosition: 'Cursor Position',
    characters: 'chars',
    unsupportedFileType: 'Unsupported File Format',
    onlyMarkdownSupported: 'Currently only Markdown (.md, .markdown) files are supported for editing',
    loadingImage: 'Loading image...',
    failedToLoadImage: 'Failed to load image'
  },
  tabs: {
    untitled: 'Untitled',
    cannotDetachLast: 'Cannot detach last tab',
    closeThisTab: 'Close This Tab',
    closeOtherTabs: 'Close Other Tabs',
    closeSavedTabs: 'Close Saved Tabs',
    closeAllTabs: 'Close All Tabs',
    copyPath: 'Copy Path',
    showInFolder: 'Show in Folder',
    detachToNewWindow: 'Detach to New Window',
    releaseToMerge: 'Release to merge to other window',
    releaseToNewWindow: 'Release to create new window'
  },
  statusBar: {
    switchTheme: 'Switch Theme',
    renderTextCount: 'Rendered plain text character count',
    toggleSidebar: 'Toggle Sidebar',
    wordCountDisplay: 'Word Count Display'
  },
  search: {
    searchPlaceholder: 'Search...',
    replacePlaceholder: 'Replace...',
    caseSensitive: 'Case Sensitive',
    regex: 'Regular Expression',
    wholeWord: 'Whole Word',
    includePattern: 'Include Files',
    excludePattern: 'Exclude Files',
    searchInFolder: 'Search in Folder',
    replaceAll: 'Replace All',
    noResults: 'No results found'
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
    devToolsOnStartup: 'Open Dev Tools on Startup',
    showTabBar: 'Show Tab Bar',
    openInNewWindow: 'Open File in New Window',
    openFolderInNewWindow: 'Open Folder in New Window'
  },
  contextMenu: {
    moveToTrash: 'Move to Trash',
    copyFullPath: 'Copy Full Path',
    copyRelativePath: 'Copy Relative Path',
    showInExplorer: 'Show in Explorer'
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
  let value: unknown = translations[currentLanguage]
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return key
    }
  }
  
  return typeof value === 'string' ? value : key
}
