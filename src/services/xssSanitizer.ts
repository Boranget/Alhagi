/**
 * XSS 防护服务
 * 提供安全的 HTML 转义和内容净化
 */

export interface SanitizeOptions {
  /** 允许的标签 */
  allowedTags?: string[]
  /** 允许的属性 */
  allowedAttributes?: Record<string, string[]>
  /** 是否允许样式 */
  allowStyles?: boolean
  /** 是否允许图片 */
  allowImages?: boolean
  /** 是否允许链接 */
  allowLinks?: boolean
}

/**
 * HTML 实体编码表
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
}

/**
 * 默认允许的标签
 */
const DEFAULT_ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'strong', 'em', 'b', 'i', 'u', 's',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span'
]

/**
 * 默认允许的属性
 */
const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'target'],
  'img': ['src', 'alt', 'title', 'width', 'height'],
  'code': ['class'],
  'pre': ['class']
}

class XSSSanitizer {
  /**
   * 转义 HTML 特殊字符
   */
  escapeHtml(text: string): string {
    return text.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)
  }
  
  /**
   * 解码 HTML 实体
   */
  unescapeHtml(text: string): string {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    return textarea.value
  }
  
  /**
   * 净化 HTML，移除危险的标签和属性
   */
  sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
    const {
      allowedTags = DEFAULT_ALLOWED_TAGS,
      allowedAttributes = DEFAULT_ALLOWED_ATTRIBUTES,
      allowStyles = false
    } = options
    
    // 创建 DOM 解析器
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // 递归净化节点
    const sanitizeNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true)
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        const tagName = element.tagName.toLowerCase()
        
        // 检查标签是否允许
        if (!allowedTags.includes(tagName)) {
          // 不允许的标签，只保留文本内容
          const fragment = document.createDocumentFragment()
          element.childNodes.forEach(child => {
            const sanitized = sanitizeNode(child)
            if (sanitized) {
              fragment.appendChild(sanitized)
            }
          })
          return fragment
        }
        
        // 创建新的净化元素
        const newElement = document.createElement(tagName)
        
        // 复制允许的属性
        const allowedAttrs = allowedAttributes[tagName] || []
        allowedAttrs.forEach(attr => {
          const value = element.getAttribute(attr)
          if (value) {
            // 对链接进行 URL 验证
            if (tagName === 'a' && attr === 'href') {
              if (this.isValidUrl(value)) {
                newElement.setAttribute(attr, value)
                // 安全打开链接
                if (attr === 'href') {
                  newElement.setAttribute('target', '_blank')
                  newElement.setAttribute('rel', 'noopener noreferrer')
                }
              }
            } else if (tagName === 'img' && attr === 'src') {
              // 图片源验证
              if (this.isValidImageUrl(value)) {
                newElement.setAttribute(attr, value)
              }
            } else if (attr === 'class') {
              // 样式类白名单过滤
              newElement.setAttribute(attr, this.sanitizeClass(value))
            } else if (!allowStyles || attr !== 'style') {
              newElement.setAttribute(attr, this.escapeHtml(value))
            }
          }
        })
        
        // 处理样式
        if (allowStyles && element.hasAttribute('style')) {
          const style = element.getAttribute('style')
          if (style && this.isValidStyle(style)) {
            newElement.setAttribute('style', style)
          }
        }
        
        // 递归处理子节点
        element.childNodes.forEach(child => {
          const sanitized = sanitizeNode(child)
          if (sanitized) {
            newElement.appendChild(sanitized)
          }
        })
        
        return newElement
      }
      
      return null
    }
    
    // 处理 body 内容
    const body = doc.body
    const fragment = document.createDocumentFragment()
    body.childNodes.forEach(child => {
      const sanitized = sanitizeNode(child)
      if (sanitized) {
        fragment.appendChild(sanitized)
      }
    })
    
    return fragment.textContent || ''
  }
  
  /**
   * 验证 URL 是否安全
   */
  isValidUrl(url: string): boolean {
    if (!url) return false
    
    try {
      const parsed = new URL(url, window.location.origin)
      // 只允许 http, https 协议
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      // 相对路径也允许
      return url.startsWith('/') || !url.includes('://')
    }
  }
  
  /**
   * 验证图片 URL 是否安全
   */
  isValidImageUrl(url: string): boolean {
    if (!url) return false
    
    try {
      const parsed = new URL(url, window.location.origin)
      return ['http:', 'https:', 'data:'].includes(parsed.protocol)
    } catch {
      return url.startsWith('/') || url.startsWith('./') || url.startsWith('../')
    }
  }
  
  /**
   * 验证样式是否安全（只允许安全属性）
   */
  isValidStyle(style: string): boolean {
    // 移除所有表达式和 URL
    const dangerousPatterns = [
      /expression\s*\(/gi,
      /javascript\s*:/gi,
      /url\s*\([^)]*\)/gi,
      /behavior\s*:/gi,
      /-moz-binding\s*:/gi
    ]
    
    return !dangerousPatterns.some(pattern => pattern.test(style))
  }
  
  /**
   * 净化样式类名
   */
  sanitizeClass(className: string): string {
    // 只保留字母、数字、短横线和下划线
    return className.split(/\s+/).filter(c => /^[a-zA-Z0-9_-]+$/.test(c)).join(' ')
  }
  
  /**
   * 高亮搜索结果（安全版本）
   */
  highlightSearch(text: string, query: string, options: {
    caseSensitive?: boolean
    wholeWord?: boolean
    regex?: boolean
  } = {}): string {
    if (!query || !text) return this.escapeHtml(text)
    
    let pattern: RegExp
    try {
      if (options.regex) {
        pattern = new RegExp(`(${query})`, options.caseSensitive ? 'g' : 'gi')
      } else if (options.wholeWord) {
        const escaped = this.escapeHtml(query)
        pattern = new RegExp(`\\b(${escaped})\\b`, options.caseSensitive ? 'g' : 'gi')
      } else {
        const escaped = this.escapeHtml(query)
        pattern = new RegExp(`(${escaped})`, options.caseSensitive ? 'g' : 'gi')
      }
    } catch {
      // 无效的正则表达式，使用纯文本匹配
      return this.escapeHtml(text)
    }
    
    // 先转义整个文本，然后高亮匹配项
    return this.escapeHtml(text).replace(pattern, '<mark>$1</mark>')
  }
  
  /**
   * 移除所有 HTML 标签
   */
  stripHtml(html: string): string {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  }
  
  /**
   * 移除 Markdown 语法，返回纯文本
   */
  stripMarkdown(markdown: string): string {
    let text = markdown
    
    // 移除代码块
    text = text.replace(/```[\s\S]*?```/g, '')
    
    // 移除行内代码
    text = text.replace(/`[^`]+`/g, '')
    
    // 移除链接和图片
    text = text.replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    
    // 移除标题标记
    text = text.replace(/^#{1,6}\s+/gm, '')
    
    // 移除强调标记
    text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    
    // 移除引用标记
    text = text.replace(/^>\s+/gm, '')
    
    // 移除列表标记
    text = text.replace(/^[-*+]\s+/gm, '')
    text = text.replace(/^\d+\.\s+/gm, '')
    
    return text
  }
}

export const xssSanitizer = new XSSSanitizer()

/**
 * 便捷的转义函数
 */
export function escapeHtml(text: string): string {
  return xssSanitizer.escapeHtml(text)
}

/**
 * 便捷的净化函数
 */
export function sanitizeHtml(html: string, options?: SanitizeOptions): string {
  return xssSanitizer.sanitizeHtml(html, options)
}

/**
 * 便捷的高亮函数
 */
export function highlightSearch(
  text: string,
  query: string,
  options?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }
): string {
  return xssSanitizer.highlightSearch(text, query, options)
}
