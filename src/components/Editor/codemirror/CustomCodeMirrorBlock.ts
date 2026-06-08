/**
 * 自定义 CodeMirror 代码块节点视图
 * 
 * 完全重写了 @milkdown/components 的 CodeMirrorBlock，
 * 添加了主题动态切换能力。
 * 
 * 核心改进：
 * 1. 使用 themeCompartment 包裹主题扩展，支持动态 reconfigure
 * 2. 监听 AppEvents.THEME_CHANGED 事件
 * 3. 主题变化时立即更新所有已存在的 CodeMirror 实例
 * 
 * 功能完整性：
 * - 完全覆盖原生 CodeBlock 所有功能：Preview 面板、Icon 图标、Floating-UI 定位、
 *   config 配置项透传、无障碍属性、CopyButton fallback、renderPreview 等
 */

import type { Node } from '@milkdown/prose/model'
import type { EditorView, NodeView } from '@milkdown/prose/view'
import type { CodeBlockConfig } from '@milkdown/kit/component/code-block'

import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView as CodeMirrorView,
  type ViewUpdate,
  type KeyBinding,
  drawSelection,
  keymap as cmKeymap,
} from '@codemirror/view'
import { exitCode } from '@milkdown/prose/commands'
import { redo, undo } from '@milkdown/prose/history'
import { TextSelection } from '@milkdown/prose/state'
import {
  createApp,
  ref,
  computed,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  h,
  Fragment,
  type App,
  type WatchHandle,
} from 'vue'
import { computePosition } from '@floating-ui/dom'
import clsx from 'clsx'
import DOMPurify from 'dompurify'

import { eventBus, AppEvents } from '@/events/eventBus'
import { getCrepeCodeMirrorTheme } from './crepeTheme'
import type { LanguageLoader } from './loader'

// 共享的 IntersectionObserver
const visibilityCallbacks = new WeakMap<
  Element,
  (isIntersecting: boolean) => void
>()

let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const callback = visibilityCallbacks.get(entry.target)
          callback?.(entry.isIntersecting)
        }
      },
      { rootMargin: '200px' }
    )
  }
  return sharedObserver
}

/**
 * 自定义 CodeMirror 代码块节点视图
 */
export class CustomCodeMirrorBlock implements NodeView {
  dom: HTMLElement
  cm!: CodeMirrorView
  app!: App

  selected = ref(false)
  language = ref('')
  text = ref('')

  private initialized = false
  private updating = false
  private languageName: string = ''
  private disposeSelectedWatcher: WatchHandle
  
  // 关键改进：主题配置仓，用于动态切换
  private themeCompartment: Compartment
  private readOnlyConf: Compartment
  private languageConf: Compartment
  
  // 主题卸载定时器
  private teardownTimer: ReturnType<typeof setTimeout> | null = null
  
  // 主题事件解绑函数
  private unsubscribeThemeChange: (() => void) | null = null

  constructor(
    public node: Node,
    public view: EditorView,
    public getPos: () => number | undefined,
    public loader: LanguageLoader,
    public config: CodeBlockConfig
  ) {
    this.languageConf = new Compartment()
    this.readOnlyConf = new Compartment()
    this.themeCompartment = new Compartment()

    this.text.value = this.node.textContent
    this.language.value = this.node.attrs.language ?? ''

    this.dom = document.createElement('div')
    this.dom.className = 'milkdown-code-block'

    this.disposeSelectedWatcher = watchEffect(() => {
      const isSelected = this.selected.value
      if (isSelected) {
        this.dom.classList.add('selected')
      } else {
        this.dom.classList.remove('selected')
      }
    })

    this.renderPlaceholder()

    // 监听主题变化事件
    this.setupThemeListener()

    // 使用共享的 IntersectionObserver
    visibilityCallbacks.set(this.dom, (isIntersecting) => {
      if (isIntersecting) {
        this.cancelTeardown()
        this.initializeCodeMirror()
      } else if (this.initialized) {
        this.scheduleTeardown()
      }
    })
    getSharedObserver().observe(this.dom)
  }

  /**
   * 设置主题变化监听
   */
  private setupThemeListener() {
    const unsubscribe = eventBus.on(AppEvents.THEME_CHANGED, (theme) => {
      console.log('[CustomCodeMirrorBlock] 收到主题变化事件:', theme)
      if (this.initialized && this.cm) {
        this.updateCodeMirrorTheme(theme as 'light' | 'dark' | 'system')
      }
    })
    
    this.unsubscribeThemeChange = () => {
      unsubscribe()
    }
  }

  /**
   * 更新 CodeMirror 主题
   */
  private updateCodeMirrorTheme(theme: 'light' | 'dark' | 'system') {
    if (!this.cm || !this.initialized) {
      console.warn('[CustomCodeMirrorBlock] CodeMirror 未初始化，无法更新主题')
      return
    }

    // 如果是 system 主题，需要转换为实际的亮/暗主题
    let actualTheme: 'light' | 'dark' = 'light'
    if (theme === 'system') {
      actualTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } else {
      actualTheme = theme
    }

    console.log('[CustomCodeMirrorBlock] 更新 CodeMirror 主题为:', actualTheme)

    try {
      const themeExtension = getCrepeCodeMirrorTheme(actualTheme)
      
      // 通过 compartment 动态更新主题
      this.cm.dispatch({
        effects: this.themeCompartment.reconfigure(themeExtension),
      })
      
      console.log('[CustomCodeMirrorBlock] 主题更新成功')
    } catch (error) {
      console.error('[CustomCodeMirrorBlock] 主题更新失败:', error)
    }
  }

  private renderPlaceholder() {
    const pre = document.createElement('pre')
    pre.className = 'milkdown-code-block-placeholder'
    const code = document.createElement('code')
    code.textContent = this.node.textContent
    pre.appendChild(code)
    this.dom.appendChild(pre)
  }

  private initializeCodeMirror() {
    if (this.initialized) return
    this.initialized = true

    console.log('[CustomCodeMirrorBlock] 初始化 CodeMirror')

    // 获取当前主题
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const themeExtension = getCrepeCodeMirrorTheme(isDark ? 'dark' : 'light')

    this.cm = new CodeMirrorView({
      doc: this.node.textContent,
      root: this.view.root,
      extensions: [
        this.readOnlyConf.of(EditorState.readOnly.of(!this.view.editable)),
        // 关键：使用 themeCompartment 包裹主题扩展
        this.themeCompartment.of(themeExtension),
        drawSelection(),
        // 使用自定义 keymap，支持代码块导航（最高优先级）
        cmKeymap.of(this.codeMirrorKeymap()),
        this.languageConf.of([]),
        EditorState.changeFilter.of(() => this.view.editable),
        // config.extensions 已包含 keymap(defaultKeymap+indentWithTab) + basicSetup + 用户扩展
        ...this.config.extensions,
        CodeMirrorView.updateListener.of(this.forwardUpdate),
      ],
    })

    // 移除 placeholder
    const placeholder = this.dom.querySelector(
      '.milkdown-code-block-placeholder'
    )
    if (placeholder) {
      this.dom.removeChild(placeholder)
    }

    // 创建并挂载 Vue 应用（Vue 组件会将 cm.dom 插入到 codemirror-host 容器中）
    this.app = this.createApp()
    this.app.mount(this.dom)

    // 更新语言
    this.updateLanguage()
  }

  private teardownCodeMirror() {
    if (!this.initialized) return
    // Don't tear down if the user is focused on this block
    if (this.cm.hasFocus || this.selected.value) return

    console.log('[CustomCodeMirrorBlock] 卸载 CodeMirror')
    
    this.app.unmount()
    this.cm.destroy()
    this.initialized = false
    this.languageName = ''

    // 清空 DOM 并重新渲染 placeholder
    while (this.dom.firstChild) {
      this.dom.removeChild(this.dom.firstChild)
    }
    this.renderPlaceholder()
  }

  private scheduleTeardown() {
    this.cancelTeardown()
    this.teardownTimer = setTimeout(
      () => this.teardownCodeMirror(),
      5000 // 5 秒后卸载离屏的代码块
    )
  }

  private cancelTeardown() {
    if (this.teardownTimer != null) {
      clearTimeout(this.teardownTimer)
      this.teardownTimer = null
    }
  }

  private forwardUpdate = (update: ViewUpdate) => {
    if (this.updating || !this.cm.hasFocus) return
    let offset = (this.getPos() ?? 0) + 1
    const { main } = update.state.selection
    const selFrom = offset + main.from
    const selTo = offset + main.to
    const pmSel = this.view.state.selection
    if (update.docChanged || pmSel.from !== selFrom || pmSel.to !== selTo) {
      const tr = this.view.state.tr
      update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
        if (text.length)
          tr.replaceWith(
            offset + fromA,
            offset + toA,
            this.view.state.schema.text(text.toString())
          )
        else tr.delete(offset + fromA, offset + toA)
        offset += toB - fromB - (toA - fromA)
      })
      tr.setSelection(TextSelection.create(tr.doc, selFrom, selTo))
      this.view.dispatch(tr)
    }
  }

  /**
   * CodeMirror 自定义快捷键映射
   * 复制自原始 CodeMirrorBlock 的 codeMirrorKeymap 方法
   */
  private codeMirrorKeymap = (): KeyBinding[] => {
    const view = this.view
    return [
      { key: 'ArrowUp', run: () => this.maybeEscape('line', -1) },
      { key: 'ArrowLeft', run: () => this.maybeEscape('char', -1) },
      { key: 'ArrowDown', run: () => this.maybeEscape('line', 1) },
      { key: 'ArrowRight', run: () => this.maybeEscape('char', 1) },
      {
        key: 'Mod-Enter',
        run: () => {
          if (!exitCode(view.state, view.dispatch)) return false
          view.focus()
          return true
        },
      },
      { key: 'Mod-z', run: () => undo(view.state, view.dispatch) },
      { key: 'Shift-Mod-z', run: () => redo(view.state, view.dispatch) },
      { key: 'Mod-y', run: () => redo(view.state, view.dispatch) },
      {
        key: 'Backspace',
        run: () => {
          const ranges = this.cm.state.selection.ranges

          if (ranges.length > 1) return false

          const selection = ranges[0]

          if (selection && (!selection.empty || selection.anchor > 0))
            return false

          if (this.cm.state.doc.lines >= 2) return false

          const state = this.view.state
          const pos = this.getPos() ?? 0
          const tr = state.tr.replaceWith(
            pos,
            pos + this.node.nodeSize,
            state.schema.nodes.paragraph!.createChecked({}, this.node.content)
          )

          tr.setSelection(TextSelection.near(tr.doc.resolve(pos)))

          this.view.dispatch(tr)
          this.view.focus()
          return true
        },
      },
    ]
  }

  /**
   * 处理方向键导航
   */
  private maybeEscape = (unit: 'line' | 'char', dir: -1 | 1): boolean => {
    const { state } = this.cm
    const main = state.selection.main
    if (!main.empty) return false
    let range: { from: number; to: number } = main
    if (unit === 'line') range = state.doc.lineAt(main.head)
    if (dir < 0 ? range.from > 0 : range.to < state.doc.length) return false

    const targetPos = (this.getPos() ?? 0) + (dir < 0 ? 0 : this.node.nodeSize)
    const selection = TextSelection.near(
      this.view.state.doc.resolve(targetPos),
      dir
    )
    const tr = this.view.state.tr.setSelection(selection).scrollIntoView()
    this.view.dispatch(tr)
    this.view.focus()
    return true
  }

  // ---------------------------------------------------------------------------
  // 辅助：Icon 函数式组件（对应原生 __internal__/components/icon.tsx）
  // ---------------------------------------------------------------------------
  private IconComponent(props: { icon?: string | null; class?: string }) {
    return h('span', {
      class: clsx('milkdown-icon', props.class),
      innerHTML: props.icon ? DOMPurify.sanitize(props.icon.trim()) : undefined,
    })
  }

  // ---------------------------------------------------------------------------
  // 辅助：copyToClipboard（带 execCommand fallback，对应原生 copy-button.tsx）
  // ---------------------------------------------------------------------------
  private async copyToClipboard(text: string) {
    try {
      return navigator.clipboard.writeText(text)
    } catch {
      const element = document.createElement('textarea')
      const previouslyFocusedElement = document.activeElement

      element.value = text
      element.setAttribute('readonly', '')
      element.style.contain = 'strict'
      element.style.position = 'absolute'
      element.style.left = '-9999px'
      element.style.fontSize = '12pt'

      const selection = document.getSelection()
      const originalRange = selection
        ? selection.rangeCount > 0 && selection.getRangeAt(0)
        : null

      document.body.appendChild(element)
      element.select()
      element.selectionStart = 0
      element.selectionEnd = text.length

      document.execCommand('copy')
      document.body.removeChild(element)

      if (originalRange) {
        selection!.removeAllRanges()
        selection!.addRange(originalRange)
      }

      if (previouslyFocusedElement) {
        (previouslyFocusedElement as HTMLElement).focus()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 辅助：SVG-aware sanitizer（对应原生 preview-panel.tsx 中的 sanitizeSvg）
  // ---------------------------------------------------------------------------
  private static _svgSanitizer: ((dirty: string | globalThis.Node) => ReturnType<typeof DOMPurify.sanitize>) | undefined

  private sanitizeSvg(dirty: string | globalThis.Node): ReturnType<typeof DOMPurify.sanitize> {
    const SVG_NS = 'http://www.w3.org/2000/svg'
    if (!CustomCodeMirrorBlock._svgSanitizer) {
      const purify = DOMPurify()
      purify.addHook('uponSanitizeElement', (node, data) => {
        if (data.tagName === 'foreignobject') {
          const parent = node.parentElement
          if (!parent || parent.namespaceURI !== SVG_NS) {
            node.parentNode?.removeChild(node)
          }
        }
      })
      CustomCodeMirrorBlock._svgSanitizer = (d) =>
        purify.sanitize(d, {
          ADD_TAGS: ['foreignObject'],
          ADD_ATTR: ['xmlns'],
          HTML_INTEGRATION_POINTS: { foreignobject: true },
        })
    }
    return CustomCodeMirrorBlock._svgSanitizer(dirty)
  }

  // ---------------------------------------------------------------------------
  // Vue 应用创建（完全覆盖原生 CodeBlock 的所有功能）
  // ---------------------------------------------------------------------------
  private createApp = () => {
    const self = this
    const config = self.config

    const CodeBlockFull = {
      setup() {
        // -- 预览模式 --
        const previewOnlyByDefault =
          config.previewOnlyByDefault ?? !self.view.editable
        const previewOnlyMode = ref(previewOnlyByDefault)
        const preview = ref<null | string | HTMLElement>(null)

        // -- CodeMirror 宿主 --
        const codemirrorHostRef = ref<HTMLDivElement>()

        onMounted(() => {
          const host = codemirrorHostRef.value
          if (host) {
            while (host.firstChild) host.removeChild(host.firstChild)
            host.appendChild(self.cm.dom)
          }
        })

        // -- renderPreview 监听 --
        watch(
          () => [self.text.value, self.language.value] as const,
          () => {
            const result = config.renderPreview(
              self.language.value,
              self.text.value,
              (value) => (preview.value = value)
            )
            if (result) {
              preview.value = result
            }
            const isAsyncPreview = result === undefined
            if (isAsyncPreview && !preview.value) {
              preview.value = DOMPurify.sanitize(config.previewLoading)
            }
            if (result === null) {
              preview.value = null
            }
          },
          { immediate: true }
        )

        // -- 语言选择器（对应原生 language-picker.tsx） --
        const showPicker = ref(false)
        const filter = ref('')
        const triggerRef = ref<HTMLButtonElement>()
        const pickerRef = ref<HTMLDivElement>()
        const searchRef = ref<HTMLInputElement>()

        // Floating-UI 定位
        watch(
          () => [showPicker.value, triggerRef.value, pickerRef.value] as const,
          () => {
            filter.value = ''
            const trigger = triggerRef.value
            const picker = pickerRef.value
            if (!trigger || !picker) return
            computePosition(trigger, picker, {
              placement: 'bottom-start',
            })
              .then(({ x, y }) => {
                Object.assign(picker.style, {
                  left: `${x}px`,
                  top: `${y}px`,
                })
              })
              .catch(console.error)
          }
        )

        const onTogglePicker = (e: Event) => {
          e.preventDefault()
          e.stopPropagation()
          if (!self.view.editable) return
          const next = !showPicker.value
          showPicker.value = next
          if (next) {
            setTimeout(() => searchRef.value?.focus(), 0)
          }
        }

        const onSearchKeydown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') filter.value = ''
        }

        // 点击外部关闭
        const clickHandler = (e: MouseEvent) => {
          const target = e.target as HTMLElement
          if (triggerRef.value?.contains(target)) return
          if (!pickerRef.value || !triggerRef.value) return
          if (triggerRef.value.dataset.expanded !== 'true') return
          if (!pickerRef.value.contains(target)) showPicker.value = false
        }

        onMounted(() => {
          window.addEventListener('click', clickHandler)
        })

        onUnmounted(() => {
          window.removeEventListener('click', clickHandler)
        })

        const languages = computed(() => {
          if (!showPicker.value) return []
          const all = self.getAllLanguages() ?? []
          const selected = all.find(
            (info) =>
              info.name.toLowerCase() === self.language.value.toLowerCase()
          )
          const filtered = all.filter((info) => {
            const cur = filter.value.toLowerCase()
            return (
              (info.name.toLowerCase().includes(cur) ||
                info.alias.some((a) => a.toLowerCase().includes(cur))) &&
              info !== selected
            )
          })
          if (filtered.length === 0) return []
          if (!selected) return filtered
          return [selected, ...filtered]
        })

        // -- Preview 面板渲染（对应原生 preview-panel.tsx） --
        const previewRef = ref<HTMLDivElement>()

        watchEffect(() => {
          const container = previewRef.value
          if (!container) return
          while (container.firstChild) {
            container.removeChild(container.firstChild)
          }
          const content = preview.value
          if (content instanceof globalThis.Node || typeof content === 'string') {
            container.innerHTML = self.sanitizeSvg(content) as string
          }
        })

        // -- 渲染 --
        const emptyFn = () => {}

        return () => {
          const previewContent = preview.value
          const previewHasContent = !!previewContent
          const copyIcon = config.copyIcon
          const copyText = config.copyText

          return h(Fragment, {}, [
            // ============== 工具栏 ==============
            h('div', { class: 'tools' }, [
              // ---- 语言选择器 ----
              h(Fragment, {}, [
                h(
                  'button',
                  {
                    type: 'button',
                    ref: triggerRef,
                    class: 'language-button',
                    'data-expanded': String(showPicker.value),
                    onClick: onTogglePicker,
                  },
                  [
                    self.language.value || 'Text',
                    h('div', { class: 'expand-icon' }, [
                      self.IconComponent({ icon: config.expandIcon }),
                    ]),
                  ]
                ),
                h(
                  'div',
                  { ref: pickerRef, class: 'language-picker' },
                  ...(showPicker.value
                    ? [
                        h('div', { class: 'list-wrapper' }, [
                          // 搜索框
                          h('div', { class: 'search-box' }, [
                            h('div', { class: 'search-icon' }, [
                              self.IconComponent({ icon: config.searchIcon }),
                            ]),
                            h('input', {
                              ref: searchRef,
                              class: 'search-input',
                              placeholder: config.searchPlaceholder,
                              value: filter.value,
                              onInput: (e: Event) => {
                                filter.value = (
                                  e.target as HTMLInputElement
                                ).value
                              },
                              onKeydown: onSearchKeydown,
                            }),
                            h(
                              'div',
                              {
                                class: clsx(
                                  'clear-icon',
                                  filter.value.length === 0 && 'hidden'
                                ),
                                onMousedown: (e: MouseEvent) => {
                                  e.preventDefault()
                                  filter.value = ''
                                },
                              },
                              [
                                self.IconComponent({
                                  icon: config.clearSearchIcon,
                                }),
                              ]
                            ),
                          ]),
                          // 语言列表
                          h(
                            'ul',
                            {
                              class: 'language-list',
                              role: 'listbox',
                              onKeydown: (e: KeyboardEvent) => {
                                if (e.key === 'Enter') {
                                  const active =
                                    document.activeElement
                                  if (
                                    active instanceof HTMLElement &&
                                    active.dataset.language
                                  ) {
                                    self.setLanguage(
                                      active.dataset.language
                                    )
                                  }
                                }
                              },
                            },
                            !languages.value.length
                              ? [
                                  h(
                                    'li',
                                    {
                                      class:
                                        'language-list-item no-result',
                                    },
                                    config.noResultText
                                  ),
                                ]
                              : languages.value.map((info) =>
                                  h(
                                    'li',
                                    {
                                      key: info.name,
                                      role: 'listitem',
                                      tabindex: 0,
                                      class: 'language-list-item',
                                      'aria-selected': String(
                                        info.name.toLowerCase() ===
                                          self.language.value.toLowerCase()
                                      ),
                                      'data-language': info.name,
                                      onClick: () => {
                                        self.setLanguage(info.name)
                                        showPicker.value = false
                                      },
                                    },
                                    config.renderLanguage(
                                      info.name,
                                      info.name.toLowerCase() ===
                                        self.language.value.toLowerCase()
                                    )
                                  )
                                )
                          ),
                        ]),
                      ]
                    : [])
                ),
              ]),

              // ---- 按钮组 ----
              h('div', { class: 'tools-button-group' }, [
                // 复制按钮
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'copy-button',
                    onClick: () => {
                      self
                        .copyToClipboard(self.text.value)
                        .then(() =>
                          (config.onCopy ?? emptyFn)(self.text.value)
                        )
                        .catch(console.error)
                    },
                  },
                  [
                    self.IconComponent({ icon: copyIcon }),
                    copyText,
                  ]
                ),

                // 预览切换按钮
                ...(previewHasContent
                  ? [
                      h(
                        'button',
                        {
                          class: 'preview-toggle-button',
                          onClick: () =>
                            (previewOnlyMode.value =
                              !previewOnlyMode.value),
                        },
                        [
                          self.IconComponent({
                            icon: config.previewToggleButton(
                              previewOnlyMode.value
                            ),
                          }),
                        ]
                      ),
                    ]
                  : []),
              ]),
            ]),

            // ============== CodeMirror 宿主 ==============
            h('div', {
              ref: codemirrorHostRef,
              class: clsx(
                'codemirror-host',
                previewHasContent && previewOnlyMode.value && 'hidden'
              ),
            }),

            // ============== Preview 面板 ==============
            ...(previewHasContent
              ? [
                  h('div', { class: 'preview-panel' }, [
                    ...(!previewOnlyMode.value
                      ? [
                          h('div', { class: 'preview-divider' }),
                          h(
                            'div',
                            { class: 'preview-label' },
                            config.previewLabel
                          ),
                        ]
                      : []),
                    h('div', { ref: previewRef, class: 'preview' }),
                  ]),
                ]
              : []),
          ])
        }
      },
    }

    return createApp(CodeBlockFull)
  }

  private updateLanguage() {
    const languageName = this.node.attrs.language

    if (languageName === this.languageName) return

    this.language.value = languageName
    const language = this.loader.load(languageName ?? '')

    language
      .then((lang) => {
        if (lang) {
          this.cm.dispatch({
            effects: this.languageConf.reconfigure(lang),
          })
          this.languageName = languageName
        }
      })
      .catch(console.error)
  }

  setSelection(anchor: number, head: number) {
    if (!this.initialized) {
      this.initializeCodeMirror()
    }

    if (!this.cm.dom.isConnected) return

    this.cm.focus()
    this.updating = true
    this.cm.dispatch({ selection: { anchor, head } })
    this.updating = false
  }

  update(node: Node) {
    if (node.type !== this.node.type) return false

    if (this.updating) return true

    this.node = node
    this.text.value = node.textContent
    this.language.value = node.attrs.language ?? ''

    if (!this.initialized) {
      // Update the placeholder text
      const code = this.dom.querySelector(
        '.milkdown-code-block-placeholder code'
      )
      if (code) {
        code.textContent = node.textContent
      }
      return true
    }

    this.updateLanguage()
    if (this.view.editable === this.cm.state.readOnly) {
      this.cm.dispatch({
        effects: this.readOnlyConf.reconfigure(
          EditorState.readOnly.of(!this.view.editable)
        ),
      })
    }

    const change = computeChange(this.cm.state.doc.toString(), node.textContent)
    if (change) {
      this.updating = true
      this.cm.dispatch({
        changes: { from: change.from, to: change.to, insert: change.text },
        scrollIntoView: true,
      })
      this.updating = false
    }
    return true
  }

  selectNode() {
    if (!this.initialized) {
      this.initializeCodeMirror()
    }
    this.selected.value = true
    this.cm.focus()
  }

  deselectNode() {
    this.selected.value = false
  }

  stopEvent() {
    return true
  }

  destroy() {
    this.cancelTeardown()
    // 清理 IntersectionObserver
    getSharedObserver().unobserve(this.dom)
    visibilityCallbacks.delete(this.dom)
    
    if (this.initialized) {
      this.app.unmount()
      this.cm.destroy()
    }
    this.disposeSelectedWatcher()
    
    // 清理主题监听
    if (this.unsubscribeThemeChange) {
      this.unsubscribeThemeChange()
      this.unsubscribeThemeChange = null
    }
  }

  setLanguage = (language: string) => {
    this.view.dispatch(
      this.view.state.tr.setNodeAttribute(
        this.getPos() ?? 0,
        'language',
        language
      )
    )
  }

  getAllLanguages = () => {
    return this.loader.getAll()
  }
}

function computeChange(
  oldVal: string,
  newVal: string
): { from: number; to: number; text: string } | null {
  if (oldVal === newVal) return null

  let start = 0
  let oldEnd = oldVal.length
  let newEnd = newVal.length

  while (
    start < oldEnd &&
    oldVal.charCodeAt(start) === newVal.charCodeAt(start)
  )
    ++start

  while (
    oldEnd > start &&
    newEnd > start &&
    oldVal.charCodeAt(oldEnd - 1) === newVal.charCodeAt(newEnd - 1)
  ) {
    oldEnd--
    newEnd--
  }

  return { from: start, to: oldEnd, text: newVal.slice(start, newEnd) }
}
