// ============================================================
// Alhagi 设置窗渲染入口
// ============================================================
//
// 独立 BrowserWindow 加载的入口，与主窗 (src/main.ts) 完全分离。
// 设计原则：
//
//   1. 不引入 EditorContainer / Crepe / CodeMirror 这堆几 MB 的依赖；
//      设置窗只做"读偏好 / 改偏好 / 实时预览"，组件依赖应当最小。
//   2. 共用主窗的 src/styles/main.scss —— 设置面板里的部分项（字体大小
//      预览、行高预览）需要相同的 CSS 变量在 :root 上生效。
//   3. 共用主窗的 EditorTypographyService —— 在设置窗内拖滑杆时，主窗
//      通过 PREFERENCES.CHANGED 广播自动同步；但设置窗也需要在自己进程
//      里调一次 setupEditorTypography()，否则它自身 :root 上没有 CSS
//      变量值（设置窗内若要做"预览块"，预览块依赖这套变量）。
//   4. 不复用 useApp() —— useApp 里有命令系统/菜单/事件总线/编辑器初始化
//      等一大堆主窗专属逻辑，设置窗都不需要。
//
// store 加载流程：mount → loadPreferences()（IPC 异步取） → 自动订阅
// onPreferencesChanged 广播 → 后续主窗写入会推过来。

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SettingsApp from './SettingsApp.vue'
import '../styles/main.scss'

const app = createApp(SettingsApp)
app.use(createPinia())
app.mount('#settings-app')
