# Muya 版 Alhagi 对比分析与借鉴思路

> 文档目的：对比 `reference/alhagi-Muya`（基于 Muya 引擎的旧版 Alhagi，MarkText fork）与当前 `alhagi/`（Vue 3 + Pinia + Milkdown/Crepe 的新版 Alhagi），梳理其架构优势点，评估每一项是否值得借鉴到当前项目，给出明确的"借/不借"决策与理由。
>
> 范围：仅讨论思路和设计原则，不照搬代码。
>
> 编写日期：2026/06/09

---

## 一、项目背景对比

| 维度 | Muya 版 Alhagi（旧） | 当前 Alhagi（新） |
|------|----------------------|---------------------|
| 渲染层基础 | MarkText fork，Muya 引擎（Snabbdom + contenteditable） | Milkdown/Crepe（基于 ProseMirror） |
| 前端框架 | Vue 3 + Options/Composition 混用 | Vue 3 Composition API |
| 状态管理 | Pinia | Pinia |
| 构建工具 | electron-vite | vite + electron-builder |
| 类型系统 | 纯 JS（仅 JSDoc） | TypeScript |
| 主要语言 | 中文（zh-CN） | 中文（zh-CN） |
| 规模 | 大型成熟项目（编辑器 store 1869 行） | 中型项目（约 230 模块） |
| 测试 | 框架齐全但用例稀少 | 无 |
| 多窗口 | 完整支持 | 基础支持 |

**结论**：Muya 版是大型成熟工程，沉淀了 MarkText 多年的运行经验；新版起步较新，编辑器内核更现代，但桌面应用层（主进程、IPC、菜单、键位、偏好、窗口管理）相对单薄。借鉴的重点应放在桌面应用层和工程化基础设施上，而不是编辑器内核（因为内核思路完全不同）。

---

## 二、高优先级借鉴点（强烈推荐）

### 1. 中心化 IPC 通道注册表

**Muya 的做法**：
- 在 `common/ipc/channels.js` 中集中定义全部约 200 个 IPC 通道常量，约束统一前缀（`mt::`），按业务分组（Window/File/Menu/Editor/Preferences/Keybindings/Spellchecker/Application/i18n/CommandCenter）。
- 提供通道工厂函数生成带 windowId、filePath 等动态参数的通道名，例如基于窗口 ID 的标签保存通道、基于路径的文件监视通道。
- 配套 `scripts/check-ipc-channels.js` 做静态扫描，检查实际使用与注册表是否对齐。
- 配套自定义错误类（`IPCError`、`IPCTimeoutError`、`IPCChannelNotFoundError`、`IPCHandlerError`、`IPCParameterError`、`IPCPermissionError`）和带重试、超时、统一响应封装的 wrapper。

**当前项目状况**：
- 已有 `electron-protocol/index.ts` 定义部分 `ElectronAPI` 接口和 `IPC_CHANNELS`，但通道字符串散落、缺乏命名约束。
- 主进程 `electron/main.ts` 约 750 行，~25 个 IPC handler 直接用 `ipcMain.handle/on` 注册，没有统一响应壳。
- 没有通道一致性检查。
- 存在两个 ElectronAPI 包装器（`ElectronService` 单例 vs `ElectronApiService` 类），API 不一致，部分方法在 preload 中根本不存在，会静默失败。

**借鉴价值**：⭐⭐⭐⭐⭐ 强烈推荐
- **借**：把全部通道集中到 `electron-protocol/channels.ts`，加统一前缀（建议 `alhagi::`），按业务分组，加上 TypeScript 字面量类型让 IDE 自动提示。
- **借**：写一个简单的 lint 脚本（甚至只是 grep）保证 `electron/main.ts` 和渲染端使用的通道字符串完全来自 `electron-protocol`。
- **不借**：暂不引入完整的错误类层级和重试/超时 wrapper——当前项目规模还撑不起这种基础设施，过度抽象反而成本高；只保留"通道集中 + 统一前缀"这一部分即可。
- **修复连带问题**：删除 `ElectronApiService`，统一用 `ElectronService`，让 preload 暴露的 API 与 `electron-protocol` 严格一致。

---

### 2. 主进程的服务容器（Accessor 模式）

**Muya 的做法**：
- 主进程入口构造一个 `Accessor` 对象，按固定顺序实例化所有核心服务：`Preference` → `DataCenter` → `Keybindings` → `AppMenu` → `WindowManager` → `CommandManager`，相互通过引用传递。
- 后续的窗口、命令、菜单都从 `Accessor` 取依赖，不到处用 `import` 或全局变量。
- `App` 类只负责生命周期事件（`ready`/`activate`/`second-instance` 等），业务逻辑全部委托给服务。

**当前项目状况**：
- 渲染端有 `serviceContainer` + `serviceFactory` + `SERVICE_IDENTIFIERS` 的 DI 系统，但实际没人通过容器解析服务——大部分代码直接 `import` 单例或调用 `useXxxService()`，容器形同虚设。
- 主进程 `electron/main.ts` 是单文件 750 行，没有服务分层，所有逻辑（窗口创建、IPC、菜单、ripgrep、文件树、主题）混在一起。
- `ElectronEventHandler` 在 `ElectronService.initialize()` 里被初始化一次，又在容器里再注册一次，导致重复监听。

**借鉴价值**：⭐⭐⭐⭐⭐ 强烈推荐
- **借**：把 `electron/main.ts` 拆成多个服务类（`WindowManager`、`MenuBuilder`、`FileSystemService`、`PreferenceService`、`SearchService`），在入口构造一个 `MainAppContext` 对象按顺序持有它们。
- **借**：服务的依赖通过构造函数注入，明确"谁依赖谁"，避免循环依赖和隐藏耦合。
- **取舍**：渲染端的 `serviceContainer` 既然没人用，应该**直接删除**而不是继续维护——避免给后人传递错误信号。新版项目里 Pinia + Composables 已经能覆盖渲染端的"服务"需求，不需要额外的 DI 框架。
- **不借**：避免引入全局 `global.windowManager`、`app._alhagiAppInstance` 这种 Muya 的全局可变状态——这是反模式，破坏可测试性。

---

### 3. 共享菜单配置（单一数据源）

**Muya 的做法**：
- `common/menu/config.js`（1119 行）是菜单结构的唯一数据源：每个菜单项有 `id`、`label`（i18n key）、`accelerator`（命令 id，通过 Keybindings 解析）、`children`、`type`（radio/checkbox/separator）、`visible`、`role`。
- 主进程通过 `convert.js` 将其转换为 Electron 原生菜单模板。
- 渲染端的自定义 HTML 菜单栏也消费同一份配置。
- 国际化、快捷键、可见性、勾选状态全部通过引用共享配置实现，菜单永远不会"漂移"。

**当前项目状况**：
- 已经有命令系统 `src/commands/registry.ts` 作为命令的单一数据源，包含 `category`/`label`/`keybinding`/`menuGroup`/`menuOrder`。
- 但是渲染端的菜单组件（`MenuBar.vue` 等）和主进程的菜单（如果有）尚未完全从 `registry.ts` 自动生成。
- 当前项目没有原生 Electron 菜单（Web 风格菜单栏），所以"主进程 + 渲染端共享"在新版意义稍弱。

**借鉴价值**：⭐⭐⭐⭐ 推荐
- **借核心思想**：菜单结构、命令、快捷键三者必须通过同一份数据源生成，避免任意一处单独维护。
- **借**：在 `src/commands/registry.ts` 中扩展菜单层级信息（已经有 `menuGroup`/`menuOrder`），让 `MenuBar.vue` 通过 `getGroupedMenuCommands()` 自动渲染。
- **借**：i18n key 应当作为 `label` 的可选第二字段，让菜单文本随语言切换。
- **不借**：不要为了"共享"而引入主进程菜单——新版用 HTML 菜单栏是合理选择，Muya 的"主+渲染双消费"是因为它两套都用。
- **修复连带问题**：当前 `i18n.ts` 不是响应式的（用普通变量而不是 ref），切换语言时 Vue 组件不会重新渲染，菜单文本不会更新。这应在引入 i18n 共享前先修复。

---

### 4. 跨进程的偏好同步与广播

**Muya 的做法**：
- 主进程 `Preference` 服务：基于 `electron-store` + JSON Schema 校验 + 迁移逻辑（旧字段自动转新格式）+ 首次启动从静态 JSON 加载默认值。
- 渲染端 `usePreferencesStore` 镜像主进程偏好，约 80 个 key。
- 双向同步：渲染端 `SET_USER_PREFERENCE` IPC → 主进程持久化 → 主进程通过 `BROADCAST_PREFERENCES_CHANGED` 通知**所有窗口** → 各窗口的 store、菜单、主题、文件监视器、i18n 都订阅这个广播。
- 敏感字段（如 GitHub token）由独立的 `DataCenter` + `keytar` 加密存储。

**当前项目状况**：
- 偏好完全在渲染端 `stores/preferences.ts`（~510 行），用 localStorage 持久化。
- 主进程不知道用户偏好，无法做基于偏好的窗口配置、菜单状态、文件监视行为。
- 多窗口情境下，一个窗口改了偏好其他窗口不会同步。
- 没有 schema 校验，损坏的 localStorage 会让应用启动失败。
- 没有迁移机制——新增/重命名偏好时，老用户的 localStorage 数据会"卡住"。

**借鉴价值**：⭐⭐⭐⭐ 推荐（但分阶段）
- **借**：将偏好持久化迁移到主进程 `electron-store`，渲染端通过 IPC 同步。这样：
  1. 多窗口可以收到广播自动同步。
  2. 主进程能基于偏好做"启动时打开上次会话"等决策，不必等渲染端就绪。
  3. 数据可以被主进程的菜单逻辑直接消费（如"显示侧边栏"作为菜单勾选状态）。
- **借**：引入偏好 schema 和迁移机制——哪怕是简单的 `version` 字段 + `migrators[]` 数组，也能避免老用户被"卡死"。
- **不借**：暂不需要 `DataCenter` + `keytar` 那一层——当前项目还没有云服务、token 等敏感数据需求；用到时再加。
- **分阶段**：第一阶段只迁移持久化路径，保留现有 store 接口；第二阶段引入广播；第三阶段引入 schema/migration。

---

### 5. 完善的快捷键系统（per-OS 默认 + 用户覆盖 + 键盘布局监听 + 冲突检测）

**Muya 的做法**：
- 每个平台一个默认键位文件（`keybindingsDarwin.js`、`keybindingsLinux.js`、`keybindingsWindows.js`），用 `Map<commandId, accelerator>` 表示。
- 用户覆盖写入 `<userData>/keybindings.json`，启动时与默认值合并。
- **重复检测**：合并时扫描冲突，给出警告。
- **键盘布局感知**：用 `native-keymap` 读取 OS 当前键盘布局（如法语 AZERTY、德语 QWERTZ），让 `Ctrl+]` 这种依赖物理按键位置的快捷键在非 US 布局下也工作正确。
- **布局变化监听**：用户切换 OS 键盘语言时，重新注册快捷键。
- 设置 UI 中可视化配置每个命令的快捷键，按下新键自动捕获。

**当前项目状况**：
- 刚刚完成命令系统统一（2026/06/09），快捷键全部在 `src/commands/registry.ts` 中定义。
- `KeybindingManager` 支持用户自定义覆盖（`setCustomKeybindings`），持久化到 localStorage。
- `KeyboardSettings.vue` 已重写为基于命令系统的可视化配置 UI。
- **缺**：无 per-OS 默认键位区分（虽然 `CommandEntry.platformOverrides` 类型已声明，但 `getPlatformKeybinding()` 没实现）。
- **缺**：无冲突检测——两个命令绑定同一快捷键不会报错。
- **缺**：无键盘布局感知——非 US 用户体验未知。

**借鉴价值**：⭐⭐⭐⭐ 推荐（按需）
- **借**：实现 `platformOverrides` 的解析，让 macOS 默认用 `Cmd` 而非 `Ctrl`，Windows/Linux 保持 `Ctrl`。这是底线要求，对 Mac 用户体验影响很大。
- **借**：在 `KeybindingManager` 启动时扫描重复键位，开发模式下 console.warn，让 bug 早暴露。
- **谨慎借**：`native-keymap` 是 native 模块，需要重新编译、增加构建复杂度。如果项目暂时不面向欧洲/俄罗斯/阿拉伯用户，可以推迟；面向时再加。**不要为了"功能完整"提前引入。**
- **不借**：暂不需要"按下捕获"以外的复杂自定义 UI——现有 KeyboardSettings 已经够用。

---

### 6. CommandCenter 状态广播模式（命令的启用/勾选状态）

**Muya 的做法**：
- `CommandCenter` 不仅注册命令，还维护一个命令状态 Map（`enabled`/`visible`/`checked`）。
- 状态变化时，自动同步到原生菜单项（菜单中的勾号、灰显），并向所有渲染窗口广播 `mt::command:state-changed`。
- 渲染端有对应的 `commandCenter` store 缓存状态，UI 组件订阅。
- 例子：源码/WYSIWYG/分屏视图切换是 radio 状态，菜单中显示当前选中的；侧边栏显示/隐藏是 checkbox。

**当前项目状况**：
- 命令系统的 `context.ts` 已经有 `when`/`whenNot` 条件评估，能控制命令可执行性。
- 已经有 `REBUILD_TRIGGERS` 集合，部分上下文变化时触发回调。
- **缺**：没有完整的"勾选状态"（toggled）概念，菜单和工具栏无法显示某命令的开关状态。
- **缺**：没有跨窗口的状态广播，多窗口下侧边栏状态不同步。

**借鉴价值**：⭐⭐⭐ 中等推荐
- **借**：扩展 `CommandEntry`，增加可选的 `toggleState?: () => boolean` getter，让菜单/工具栏渲染时显示勾号。
- **借**：在命令执行后触发上下文重新评估（已经部分实现）。
- **暂不借**：跨窗口广播——除非新版决定强化多窗口体验，否则不值得。多窗口偏好同步（第 4 项）实现后，命令状态会自然同步（因为状态多来自偏好）。

---

### 7. 原子保存感知的文件监视器

**Muya 的做法**：
- 用 `chokidar` 监视打开文件和工作目录，但配置了 `awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 150 }`。
- 渲染端维护 `recentlySavedFiles: Map<path, timestamp>`，自己刚保存的文件 2 秒内忽略 watcher 回调，避免"刚保存就提示文件已被外部修改"的死循环。
- 外部修改触发时，弹出通知"文件已被外部修改"，提供 "Reload" 按钮。

**当前项目状况**：
- 当前项目是否有文件监视功能不明，但根据架构看应该没有完整实现。
- 多窗口/多编辑器场景下，如果用户在一个窗口改了文件，另一个窗口可能看到旧内容。
- 编辑器之外的修改（如 git checkout 切分支）完全无感知。

**借鉴价值**：⭐⭐⭐⭐ 推荐
- **借**：实现基础的"打开文件外部修改检测"，至少给用户一个 reload 提示。这是 Markdown 编辑器的基本素养——用户经常在编辑器外用 git/同步工具操作文件。
- **借**：必须配套 `recentlySavedFiles` 抖动逻辑，否则会变成 bug 之源。
- **谨慎借**：项目级别的目录监视（监视整个文件夹的增删改）实现成本较高，且对大型项目有性能影响。可先只监视已打开的文件，工作区监视按需迭代。

---

### 8. 偏好驱动的统一变更总线

**Muya 的做法**：
- `BROADCAST_PREFERENCES_CHANGED` 是通用的"配置变更"信号，菜单、主题、i18n、文件监视器、编辑器选项全部订阅这一个广播。
- 任何模块改了偏好，所有依赖偏好的模块自动重建。

**当前项目状况**：
- 当前用 `watch(() => prefsStore.theme, ...)` 这种细粒度 watcher，分散在各处。
- `useApp.ts` 中已经监听主题、语言等变化分别处理。
- 优点是细粒度，缺点是新增偏好需要在多处加监听。

**借鉴价值**：⭐⭐⭐ 中等
- **部分借**：在 `prefsStore` 上提供一个统一的 `onPreferenceChanged(key, callback)` 接口，订阅特定 key 的变化，比 `watch` 更声明式。
- **不必照搬**：Vue 3 + Pinia 的响应式系统已经能自然处理"配置变 → UI 变"的链路，单独引入广播总线是多余的。Muya 用广播是因为它跨进程，新版渲染端单进程不需要。
- **跨进程时再考虑**：如果将来按第 4 项把偏好放到主进程，那时引入跨进程广播就是必要的。

---

### 9. 错误处理 / 崩溃恢复 / 自动 GitHub issue

**Muya 的做法**：
- 主进程顶层 `exceptionHandler.js`：捕获 uncaught/unhandled error，弹出错误对话框，提供 **"Copy Error" / "Report..."** 按钮。"Report" 按钮通过 `createGitHubIssue.js` 自动生成预填的 GitHub issue URL，包含版本、OS、堆栈。
- 渲染进程崩溃（`render-process-gone`）：弹对话框让用户选择 "Close / Reload / Keep It Open"。
- Muya 编辑器自身有 `MutationObserver` 检测"编辑器崩溃"（contenteditable DOM 进入不一致状态），自动派发 `'crashed'` 事件。

**当前项目状况**：
- 渲染端有 `services/errorHandler.ts`（`ErrorManager` + `ErrorCode`），但同时还有 `utils/errorHandler.ts`，两个并存且功能重叠。
- 主进程错误处理不明确。
- 没有崩溃报告机制。

**借鉴价值**：⭐⭐⭐⭐ 推荐
- **借**：实现主进程顶层异常 handler + 用户友好的错误对话框，至少 "Copy Error" 让用户能粘贴到反馈渠道。
- **借**：渲染进程崩溃时的 reload/close 对话框——成本极低，体验显著提升。
- **借（如果项目开源）**："Report..." 按钮 → 预填 GitHub issue。如果项目不开源，可以是 mailto: 或内部反馈链接。
- **必须先做**：合并两个 errorHandler 文件——保留 `services/errorHandler.ts`（结构更好），删除 `utils/errorHandler.ts`。
- **不借**：Muya 内核的 MutationObserver 崩溃检测是为 contenteditable 设计的，Milkdown/Crepe（ProseMirror）有自己的事务模型，不需要这种 hack。

---

### 10. 动态导入的按需加载（渲染器注册表）

**Muya 的做法**：
- Muya 的 `renderers/index.js` 用动态 `import()` 注册 mermaid、vega、vega-lite、flowchart、prismjs、katex 等大型依赖。
- 只在文档中出现对应语言的代码块时才加载对应的渲染器，启动时间大幅缩短。
- Vite 配置中显式声明 manualChunks，把 vue-core / element-plus / muya-core / markdown-render / editor-libs / charting / utils 分别打包。

**当前项目状况**：
- 已经做了部分按需加载：`App.vue` 中 `SettingsPanel`、`CommandPalette`、`ShortcutsDialog` 都是 `defineAsyncComponent`。
- vite.config.ts 是否配置 manualChunks 需要确认。
- 当前 milkdown vendor chunk 1059 KB，codemirror vendor chunk 1659 KB，体积较大，按需加载收益高。

**借鉴价值**：⭐⭐⭐⭐⭐ 强烈推荐
- **借**：把 KaTeX、Mermaid（如果集成）、PrismJS 语言包等改为动态 import，仅在内容中检测到对应类型代码块时加载。
- **借**：在 `vite.config.ts` 中配置 manualChunks，把 milkdown 拆得更细——Milkdown 的各 preset（gfm、math、prism）独立成 chunk，让首屏只加载基础包。
- **借**：CodeMirror 的语言包按需加载（已经有 `loader.ts`，可以扩展）。
- **效果可量化**：当前首屏 215 KB index + 1059 KB milkdown + 1659 KB codemirror。激进按需加载后，目标首屏应能压到 1MB 以内。

---

### 11. "找最合适的窗口打开文件"启发式

**Muya 的做法**：
- 用户通过 Finder / second-instance 打开多个文件时，`App._openPathList` 对每个文件评分：
  - 已经打开了文件所在目录的窗口 → 高分
  - 已经打开了文件父目录的窗口 → 中分
  - 没有相关性的窗口 → 低分
- 选最高分窗口打开新标签，避免新开窗口。

**当前项目状况**：
- 多窗口支持基础，新文件打开行为简单。

**借鉴价值**：⭐⭐ 低优先级
- 仅在新版强化多窗口体验时再考虑。当前用户主要单窗口使用，收益有限。

---

### 12. 拼写检查（Chromium 原生）

**Muya 的做法**：
- 用 Chromium 内置 `session.setSpellCheckerLanguages` + `addWordToSpellCheckerDictionary`。
- macOS 自动检测语言。
- 渲染端 `SpellChecker` 包装类，原生右键菜单显示拼写建议。
- 几乎是"白送"的功能——主要工作量在配置和 UI。

**当前项目状况**：
- 无拼写检查。

**借鉴价值**：⭐⭐⭐ 中等
- **借**：成本低、体验显著提升，但优先级取决于用户群体——中文用户对英文拼写检查需求较低；如果用户群有英文写作场景，应该加。
- **简化思路**：先做最小化集成（启用 Chromium 默认 + 自定义词典），UI 上不做"切换语言"等高级功能。

---

## 三、不推荐借鉴的点

### A. Muya 内核（Snabbdom + contenteditable + ContentState mixin）

- Muya 是 MarkText 时代的产物，内核基于 contenteditable + 自己实现的 Snabbdom 渲染 + 28 个 `*Ctrl.js` 通过原型链 monkey-patch `ContentState` 的混入模式。
- 这种架构的 bug 数量是 ProseMirror/Tiptap/Milkdown 的数倍——Muya 自己都需要 MutationObserver 检测"编辑器崩溃"。
- 新版选择 Milkdown/Crepe 就是为了摆脱这一切，**绝对不要回头**。

### B. 两套并存的命令系统（commands/ + commandCenter/）

- Muya 同时存在旧的 `CommandManager`（Map 注册）和新的 `CommandCenter`（含状态广播），是迁移没完成的痕迹。
- **当前项目刚完成命令系统统一，绝不能再回到双系统状态。** 借鉴 CommandCenter 的状态广播思想即可（见第 6 项），不要引入第二套注册机制。

### C. nodeIntegration: true + 渲染端直接 require electron/fs-extra/ripgrep

- Muya 在渲染端开启 `nodeIntegration: true`，直接 `require('electron')`、`require('fs-extra')`、`require('@vscode/ripgrep')`，preload 只是辅助。
- 这是 Electron 早期写法，安全性差，与现代 contextIsolation 最佳实践冲突。
- 新版应该坚持 preload-only 模式，所有 Node/Electron 能力通过 `contextBridge.exposeInMainWorld` 暴露。

### D. 渲染端"util/" 和 "utils/" 两个文件夹并存

- 历史遗留导致目录重复，纯反模式。
- 新版已经只有 `utils/`，不要重蹈覆辙。

### E. 主进程到处依赖 global.windowManager / app._alhagiAppInstance

- 全局可变状态污染了 process global，破坏可测试性。
- 用第 2 项的服务容器替代。

### F. 1869 行的 editor mega-store

- Muya 把标签、文档、自动保存、文件变化、行尾、编码、搜索、导出、菜单状态全塞进一个 store。
- 即使有 composables 提取也已经无法挽救。
- 新版的 `tabsStore` 当前还可控，要警惕功能增加时不要往里堆——按职责拆分（标签管理 / 文档生命周期 / 自动保存 / 搜索状态分开）。

### G. 重度依赖 mitt 全局事件总线做组件通信

- Muya 用 `bus.emit('paragraph', 'heading 1')` 这种方式让组件向编辑器发命令，调用图完全不可追踪。
- 新版已经有命令系统 + Pinia + Vue events，能力足够，**不要再引入 mitt** 这类全局事件总线作为常规通信手段。
- 当前项目的 `eventBus` 只用于 Electron 主进程事件转发到渲染端的场景，这是合理的；不要扩散到组件间通信。

---

## 四、当前项目自身需要优先解决的问题（综合 Muya 经验反思）

按优先级排列：

### P0（必须做）

1. **删除冗余的 ElectronApiService**，统一到 `ElectronService`。Muya 的 IPC 通道注册表借鉴可以与此一起做。
2. **合并两个 errorHandler**（`services/errorHandler.ts` vs `utils/errorHandler.ts`），保留前者，确保只有一套错误处理。
3. **删除从未真正使用的 serviceContainer + serviceFactory + SERVICE_IDENTIFIERS**——容器不解决问题就是噪音，留着误导后人。
4. **修复 i18n 不响应式问题**：`services/i18n.ts` 当前用 `let currentLanguage`，必须改为 `ref`，否则切换语言菜单不变。这是借鉴菜单共享配置的前置条件。

### P1（应当做）

5. **拆分 electron/main.ts**：按 Muya 的 Accessor 思路引入服务分层（WindowManager、PreferenceService、SearchService、FileSystemService），让 750 行的单文件可维护。
6. **IPC 通道集中化**：建立 `electron-protocol/channels.ts`，强制所有通道字符串来自常量。
7. **偏好系统升级**：迁移到主进程 `electron-store`，引入 schema + 版本/迁移机制。
8. **per-OS 默认键位**：实现 `CommandEntry.platformOverrides`，让 macOS 用 Cmd。

### P2（可以做）

9. **首屏按需加载优化**：vite manualChunks 拆分 milkdown/codemirror 子模块，KaTeX/Mermaid 动态 import。
10. **打开文件外部修改检测**：基础 chokidar 监视 + recentlySavedFiles 抖动。
11. **崩溃报告对话框**：主进程顶层异常 + 渲染进程崩溃 reload 对话框。
12. **菜单从命令注册表自动生成**：`MenuBar.vue` 完全数据驱动。

### P3（按需）

13. 拼写检查、`native-keymap` 键盘布局感知、`keytar` 加密存储、ripgrep 项目搜索——按用户场景出现时再加。

---

## 五、总结

Muya 版的核心价值**不在编辑器内核**（那是新版要摆脱的部分），而在它沉淀的**桌面应用工程化经验**：IPC 治理、服务分层、共享菜单/键位/偏好的单一数据源、跨进程广播、原子保存监视、崩溃恢复、动态加载等。

新版 Alhagi 目前在编辑器内核侧（Milkdown/Crepe + TypeScript）显著领先，但桌面应用层相对单薄。借鉴 Muya 的桌面应用模式 + 保留新版的现代编辑器内核 + 现代前端工程化（TypeScript、Composition API、Pinia），才能得到一个真正的"下一代 Alhagi"。

借鉴的优先顺序应该是：
1. 先收拾自家烂摊子（P0 项）
2. 再借桌面应用层骨架（P1 项：IPC、服务、偏好、键位）
3. 然后优化体验（P2 项：性能、外部修改检测、崩溃恢复）
4. 最后按需加功能（P3 项）

**不要为了"对齐 Muya 功能列表"而堆砌特性**——Muya 的某些功能（如多种主题、ripgrep 项目搜索、云图床）是它经年累月的功能堆积，不是每个都符合新版的产品定位。每加一个都要问"我们的用户真的需要吗"，而不是"Muya 有所以我们也要有"。
