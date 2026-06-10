/**
 * 自定义 CodeMirror 插件
 *
 * 替代 @milkdown/crepe 默认的 CodeMirror 功能，
 * 提供完整的主题动态切换能力。
 *
 * 使用方法：
 * 在 Crepe 初始化时，禁用默认的 CodeMirror 功能，
 * 然后在 editor 配置中添加此插件。
 */

import type { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { basicSetup } from 'codemirror'

import type { Ctx } from '@milkdown/ctx'
import type { EditorView } from '@milkdown/prose/view'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { $view } from '@milkdown/utils'
import { codeBlockSchema } from '@milkdown/preset-commonmark'
import { codeBlockConfig, type CodeBlockConfig } from '@milkdown/kit/component/code-block'

import { CustomCodeMirrorBlock } from './CustomCodeMirrorBlock'

// 使用我们自己的 LanguageLoader
import { LanguageLoader } from './loader'

/**
 * 自定义 CodeMirror 插件配置
 */
export interface CustomCodeMirrorConfig {
  /**
   * 支持的语言列表
   * @default 所有支持的语言
   */
  languages?: LanguageDescription[]

  /**
   * 额外的 CodeMirror 扩展
   */
  extensions?: Extension[]
}

/**
 * 默认配置（仅本插件关心的两个字段；其余 CodeBlockConfig 字段
 * 由 codeBlockConfig.key 的默认值提供，在 ctx.update 时只覆盖这两项）
 */
const defaultConfig: Pick<CodeBlockConfig, 'languages' | 'extensions'> = {
  languages: languages, // 使用 @codemirror/language-data 提供的所有语言
  extensions: [],
}

/**
 * 创建自定义 CodeMirror 插件
 *
 * 模仿原始 Crepe codeMirror feature 的行为：
 * 1. 通过 ctx.update(codeBlockConfig.key, ...) 注入 languages + extensions
 * 2. 使用 LanguageLoader 管理语言加载
 * 3. 创建 $view 节点视图
 *
 * @param config - 插件配置
 * @returns Milkdown 插件
 */
export function createCustomCodeMirrorPlugin(config: CustomCodeMirrorConfig = {}) {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
  }

  // 与原始 Crepe feature 一致：构建 extensions
  const extensions: Extension[] = [
    keymap.of(defaultKeymap.concat(indentWithTab)),
    basicSetup,
    ...(config.extensions ?? []),
  ]

  // 创建语言加载器
  const languageLoader = new LanguageLoader(mergedConfig.languages)

  let configInjected = false

  // 创建节点视图插件
  const codeBlockViewPlugin = $view(
    codeBlockSchema.node,
    (ctx: Ctx) => {
      // 关键修复：模仿原始 Crepe feature，通过 ctx.update 注入配置
      // 这确保 Vue CodeBlock 组件中的 LanguagePicker 能获取到语言列表
      // 只需注入一次
      if (!configInjected) {
        configInjected = true
        ctx.update(codeBlockConfig.key, (prev) => ({
          ...prev,
          languages: mergedConfig.languages,
          extensions,
        }))
      }

      const finalConfig = ctx.get(codeBlockConfig.key)

      return (node: ProseNode, view: EditorView, getPos: () => number | undefined) => {
        return new CustomCodeMirrorBlock(
          node,
          view,
          getPos,
          languageLoader,
          finalConfig
        )
      }
    }
  )

  return codeBlockViewPlugin
}

/**
 * 获取默认的 CodeMirror 配置（仅本插件关心的字段）
 */
export function getDefaultCodeMirrorConfig(): Pick<CodeBlockConfig, 'languages' | 'extensions'> {
  return { ...defaultConfig }
}
