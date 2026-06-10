// ============================================================
// Alhagi MenuBuilder - 命令 ID → Electron 原生 role 映射表
// ============================================================
//
// 部分命令应该由 Electron 原生菜单 role 处理（cut/copy/paste/selectAll/quit），
// 而不是由我们的 renderer 进程执行。这些命令的 click handler 会跳过 IPC 通道，
// 直接返回 { role }。

export const NATIVE_ROLE_MAP: Record<string, string> = {
  'edit.cut': 'cut',
  'edit.copy': 'copy',
  'edit.paste': 'paste',
  'edit.selectAll': 'selectAll',
  // quit 不由 registry 定义，但 Electron 菜单需要它
  // 单独在模板列表追加即可
}