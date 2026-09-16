import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { LAUNCH, I18N } from '@/constants'
import { setLanguage as setI18nLanguage } from '@/services/i18n'

export interface LaunchMode {
  mode: 'last-session' | 'welcome' | 'empty' | 'folder'
  folderPath?: string
}

export const useGeneralPreferencesStore = defineStore('preferences-general', () => {
  // 启动配置
  const launchMode = ref<LaunchMode['mode']>(LAUNCH.MODES.WELCOME)
  const launchFolderPath = ref<string | undefined>('')

  // 语言 & 开发
  const language = ref<'zh-CN' | 'en'>(I18N.DEFAULT_LANGUAGE)
  const devToolsOnStartup = ref<boolean>(false)
  const lineEnding = ref<'lf' | 'crlf'>('lf')

  // 文件 & 窗口行为
  const openFileInNewWindow = ref<boolean>(false)
  const openFolderInNewWindow = ref<boolean>(false)
  const imageInsertMode = ref<'keep-original' | 'copy'>('keep-original')
  const imageCopyPath = ref<string>('./')
  const imagePreferRelativePath = ref<boolean>(true)
  const imageApplyToLocal = ref<boolean>(true)
  const imageApplyToRemote = ref<boolean>(true)
  const imageEscapeUrl = ref<boolean>(false)

  // 窗口模式（仅持久化，运行时状态由 layout store 管理）
  const isStickyNoteMode = ref<boolean>(false)
  const isImmersiveMode = ref<boolean>(false)

  watch(language, (lang) => {
    setI18nLanguage(lang)
  }, { immediate: true })

  function applyPatch(patch: Partial<{
    launchMode: LaunchMode['mode']
    launchFolderPath: string
    language: 'zh-CN' | 'en'
    devToolsOnStartup: boolean
    lineEnding: 'lf' | 'crlf'
    openFileInNewWindow: boolean
    openFolderInNewWindow: boolean
    imageInsertMode: 'keep-original' | 'copy'
    imageCopyPath: string
    imagePreferRelativePath: boolean
    imageApplyToLocal: boolean
    imageApplyToRemote: boolean
    imageEscapeUrl: boolean
    isStickyNoteMode: boolean
    isImmersiveMode: boolean
  }>): void {
    if (patch.launchMode !== undefined) launchMode.value = patch.launchMode
    if (patch.launchFolderPath !== undefined) launchFolderPath.value = patch.launchFolderPath
    if (patch.language !== undefined) language.value = patch.language
    if (patch.devToolsOnStartup !== undefined) devToolsOnStartup.value = patch.devToolsOnStartup
    if (patch.lineEnding !== undefined) lineEnding.value = patch.lineEnding
    if (patch.openFileInNewWindow !== undefined) openFileInNewWindow.value = patch.openFileInNewWindow
    if (patch.openFolderInNewWindow !== undefined) openFolderInNewWindow.value = patch.openFolderInNewWindow
    if (patch.imageInsertMode !== undefined) imageInsertMode.value = patch.imageInsertMode
    if (patch.imageCopyPath !== undefined) imageCopyPath.value = patch.imageCopyPath
    if (patch.imagePreferRelativePath !== undefined) imagePreferRelativePath.value = patch.imagePreferRelativePath
    if (patch.imageApplyToLocal !== undefined) imageApplyToLocal.value = patch.imageApplyToLocal
    if (patch.imageApplyToRemote !== undefined) imageApplyToRemote.value = patch.imageApplyToRemote
    if (patch.imageEscapeUrl !== undefined) imageEscapeUrl.value = patch.imageEscapeUrl
    if (patch.isStickyNoteMode !== undefined) isStickyNoteMode.value = patch.isStickyNoteMode
    if (patch.isImmersiveMode !== undefined) isImmersiveMode.value = patch.isImmersiveMode
  }

  return {
    launchMode,
    launchFolderPath,
    language,
    devToolsOnStartup,
    lineEnding,
    openFileInNewWindow,
    openFolderInNewWindow,
    imageInsertMode,
    imageCopyPath,
    imagePreferRelativePath,
    imageApplyToLocal,
    imageApplyToRemote,
    imageEscapeUrl,
    isStickyNoteMode,
    isImmersiveMode,
    applyPatch,
  }
})
