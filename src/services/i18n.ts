// ============================================================
// Alhagi i18n - 渲染端响应式翻译包装
// ============================================================
//
// 字典本身搬到 electron-protocol/i18n/dictionaries.ts（主/渲染共享）。
// 此文件只持有：currentLanguage 响应式 ref、t()/tComputed()/setLanguage 等
// Vue 模板友好的包装。

export type { Language, Translations } from '@electron-protocol/i18n/dictionaries'
import type { Language, Translations } from '@electron-protocol/i18n/dictionaries'
import { zhCN, en } from '@electron-protocol/i18n/dictionaries'


import { ref, computed, type Ref, type ComputedRef } from 'vue'

const translations: Record<Language, Translations> = {
  'zh-CN': zhCN,
  'en': en
}

// 响应式当前语言：被 t() 读取，模板中调用 t() 会建立追踪，语言切换时模板自动重渲染
const currentLanguage: Ref<Language> = ref('zh-CN')

export function setLanguage(lang: Language): void {
  if (currentLanguage.value !== lang) {
    currentLanguage.value = lang
    // 通知主进程按新语言重建原生应用菜单（P2-12）。
    // 失败静默——主进程菜单可能在下次重启时同步，不影响渲染端 UI。
    const api = (globalThis as { electronAPI?: { rebuildMenu?: (l: Language) => Promise<unknown> } }).electronAPI
    api?.rebuildMenu?.(lang).catch((err: unknown) => {
      console.warn('[i18n] rebuildMenu failed:', err)
    })
  }
}

export function getLanguage(): Language {
  return currentLanguage.value
}

/**
 * 翻译函数。在 Vue 模板/computed/watchEffect 中调用时，
 * 因为读取了响应式的 `currentLanguage.value`，会自动建立依赖追踪，
 * 切换语言时所有调用 t() 的位置会重新求值。
 */
export function t(key: string): string {
  const keys = key.split('.')
  let value: unknown = translations[currentLanguage.value]

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return key
    }
  }

  return typeof value === 'string' ? value : key
}

/**
 * 返回一个 computed 翻译，适合非模板场景下需要"语言变更自动更新"时使用。
 * 例如 watch(tComputed('common.save'), val => ...).
 */
export function tComputed(key: string): ComputedRef<string> {
  return computed(() => t(key))
}

export function useI18n() {
  return {
    t,
    tComputed,
    setLanguage,
    getLanguage,
    currentLanguage,
  }
}
