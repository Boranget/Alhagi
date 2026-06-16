/**
 * 应用常量定义
 * 集中管理所有魔法字符串和魔法数字
 */

// ==================== 编辑器常量 ====================

export const EDITOR = {
  // 视图模式
  VIEW_MODES: {
    WYSIWYG: 'wysiwyg',
    SOURCE: 'source',
    SPLIT: 'split'
  } as const,
  
  // 编辑器配置
  DEBOUNCE_DELAY: 300,
  SCROLL_SYNC_THRESHOLD: 50,
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 32,
  DEFAULT_FONT_SIZE: 14,

  // 行高（无单位倍数）：1.0 = 紧凑，1.6 = 阅读舒适，3.0 = 极松
  MIN_LINE_HEIGHT: 1.0,
  MAX_LINE_HEIGHT: 3.0,
  DEFAULT_LINE_HEIGHT: 1.6,

  // 源码模式（CodeMirror）独立的字体/行高，与 wysiwyg 解耦
  DEFAULT_SOURCE_FONT_SIZE: 14,
  DEFAULT_SOURCE_LINE_HEIGHT: 1.5,
  
  // 历史记录
  MAX_UNDO_STACK_SIZE: 100,
  MAX_REDO_STACK_SIZE: 50
} as const

// ==================== 标签页常量 ====================

export const TABS = {
  // 标签页状态
  NEW_TAB_TITLE: '未命名',
  DIRTY_INDICATOR: '●',
  CLOSE_BUTTON: '×',
  
  // 拖拽配置
  DRAG_GHOST_OFFSET: 10,
  MIN_TAB_WIDTH: 120,
  MAX_TAB_WIDTH: 200,
  
  // 限制
  MAX_TABS: 50
} as const

// ==================== 自动保存常量 ====================

export const AUTO_SAVE = {
  DEFAULT_INTERVAL: 30,
  MIN_INTERVAL: 1,
  MAX_INTERVAL: 300,
  TIMEOUT: 10000
} as const

// ==================== 文件操作常量 ====================

export const FILE = {
  // 文件类型
  MARKDOWN_EXTENSIONS: ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'],
  IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
  
  // 默认路径
  DEFAULT_FOLDER: '',
  // 与主流 markdown 工具（Typora、marktext、VSCode 等）对齐用 'assets' 单层；
  // 旧版本曾用 'assets/images'，已升级到单层。
  DEFAULT_IMAGE_FOLDER: 'assets',
  
  // 文件名生成
  IMAGE_PREFIX: 'image-',
  IMAGE_DATE_FORMAT: 'YYYYMMDD-HHmmss'
} as const

// ==================== 导出常量 ====================

export const EXPORT = {
  // 导出格式
  FORMATS: {
    HTML: 'html',
    PDF: 'pdf',
    TXT: 'txt'
  } as const,
  
  // 文件名后缀
  SUFFIXES: {
    HTML: '.html',
    PDF: '.pdf',
    TXT: '.txt'
  } as const,
  
  // 默认元数据
  DEFAULT_TITLE: '未命名文档',
  DEFAULT_AUTHOR: 'Alhagi Editor'
} as const

// ==================== 界面常量 ====================

export const UI = {
  // 主题
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
  } as const,
  
  // 侧边栏
  SIDEBAR: {
    DEFAULT_WIDTH: 280,
    MIN_WIDTH: 200,
    MAX_WIDTH: 600
  } as const,
  
  // 窗口
  WINDOW: {
    MIN_WIDTH: 250,
    MIN_HEIGHT: 300,
    DEFAULT_WIDTH: 1200,
    DEFAULT_HEIGHT: 800
  } as const,
  
  // 动画时长
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  } as const
} as const

// ==================== 快捷键常量 ====================

export const KEYBINDING = {
  // 修饰键
  MODIFIERS: {
    CTRL: 'ctrl',
    ALT: 'alt',
    SHIFT: 'shift',
    META: 'meta'
  } as const,
  
  // 特殊键
  KEYS: {
    ESCAPE: 'Escape',
    ENTER: 'Enter',
    TAB: 'Tab',
    BACKSPACE: 'Backspace',
    DELETE: 'Delete',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight'
  } as const,
  
  // 快捷键分类
  CATEGORIES: {
    FILE: 'file',
    EDIT: 'edit',
    VIEW: 'view',
    TOOLS: 'tools',
    HELP: 'help'
  } as const
} as const

// ==================== 语言常量 ====================

export const I18N = {
  // 支持的语言
  LANGUAGES: {
    ZH_CN: 'zh-CN',
    EN: 'en'
  } as const,
  
  // 默认语言
  DEFAULT_LANGUAGE: 'zh-CN' as const
} as const

// ==================== 图片插入模式 ====================

export const IMAGE = {
  INSERT_MODES: {
    KEEP_ORIGINAL: 'keep-original',
    COPY_ABSOLUTE: 'copy-absolute',
    COPY_RELATIVE: 'copy-relative'
  } as const
} as const

// ==================== 启动模式 ====================

export const LAUNCH = {
  MODES: {
    RESTORE: 'last-session',
    WELCOME: 'welcome',
    BLANK: 'empty',
    FOLDER: 'folder'
  } as const
} as const

// ==================== 正则表达式 ====================

export const REGEX = {
  // Markdown 标题
  HEADING: /^#{1,6}\s+(.+)$/gm,
  
  // Markdown 链接
  LINK: /\[([^\]]+)\]\(([^)]+)\)/g,
  
  // Markdown 图片
  IMAGE: /!\[([^\]]*)\]\(([^)]+)\)/g,
  
  // Markdown 代码块
  CODE_BLOCK: /```[\s\S]*?```/g,
  
  // Markdown 引用
  BLOCKQUOTE: /^>\s*/gm,
  
  // Markdown 列表
  LIST: /^[-*+]\s+/gm,
  
  // Markdown 强调
  EMPHASIS: /[*_~`]+/g,
  
  // 文件路径
  FILE_PATH: /^[a-zA-Z]:[\\/]|\//,
  
  // URL
  URL: /^https?:\/\//
} as const

// ==================== 导出所有常量 ====================

export const CONSTANTS = {
  EDITOR,
  TABS,
  AUTO_SAVE,
  FILE,
  EXPORT,
  UI,
  KEYBINDING,
  I18N,
  IMAGE,
  LAUNCH,
  REGEX
} as const

export default CONSTANTS
