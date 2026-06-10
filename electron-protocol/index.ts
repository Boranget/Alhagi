// ============================================================
// Alhagi Electron Protocol - 主进程 / preload / 渲染端共享契约
// ============================================================
//
// 此聚合入口保持向后兼容，所有原始导出名继续可用。
// 新代码建议直接从子模块 import（例如 `from '@electron-protocol/channels'`），
// 让依赖更明确。

export * from './responses'
export * from './types'
export * from './channels'
export * from './electron-api'
