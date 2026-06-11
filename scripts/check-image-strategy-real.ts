// ============================================================
// Alhagi 图片插入策略 - 真实策略类端到端自检
// ============================================================
//
// 用法：cd alhagi && npx tsx scripts/check-image-strategy-real.ts
//
// 与 check-image-strategy.ts 不同：本脚本直接 import 真实 Strategy 类，
// 通过 polyfill `window.electronAPI` + `FileReader` 让策略在 Node 下也能跑，
// 把所有 IPC 调用记录到 ipcCalls，验证策略的真实路径合成与写盘参数。

type IpcCall = { method: string; args: unknown[] }
const ipcCalls: IpcCall[] = []
const fakeDocsDir = 'D:/Users/Documents'

interface FakeApi {
  getDocumentsDirectory: () => Promise<{ success: true; data: string }>
  ensureDirectory: (p: string) => Promise<{ success: true; data: boolean }>
  saveBinaryFile: (p: string, content: string) => Promise<{ success: true; data: boolean }>
}

const fakeApi: FakeApi = {
  getDocumentsDirectory: async () => {
    ipcCalls.push({ method: 'getDocumentsDirectory', args: [] })
    return { success: true, data: fakeDocsDir }
  },
  ensureDirectory: async (p: string) => {
    ipcCalls.push({ method: 'ensureDirectory', args: [p] })
    return { success: true, data: true }
  },
  saveBinaryFile: async (p: string, content: string) => {
    ipcCalls.push({ method: 'saveBinaryFile', args: [p, `<base64 ${content.length}B>`] })
    return { success: true, data: true }
  },
}

// 必须在 import 真实模块前 polyfill，否则 ElectronService 构造函数 throw
;(globalThis as { window?: { electronAPI?: FakeApi } }).window = { electronAPI: fakeApi }

// FileReader polyfill：persist.ts 用 readAsDataURL 把 File 转 base64
class NodeFileReader {
  onload: ((this: NodeFileReader, ev: Event) => unknown) | null = null
  onerror: ((this: NodeFileReader, ev: Event) => unknown) | null = null
  result: string | null = null

  readAsDataURL(file: Blob): void {
    void file.arrayBuffer().then((buf) => {
      const b64 = Buffer.from(buf).toString('base64')
      this.result = `data:${file.type || 'application/octet-stream'};base64,${b64}`
      this.onload?.call(this, new Event('load'))
    }).catch(() => {
      this.onerror?.call(this, new Event('error'))
    })
  }
}
;(globalThis as { FileReader?: typeof NodeFileReader }).FileReader = NodeFileReader

// 现在 import 真实策略（动态 import 确保在 polyfill 之后求值；
// 静态 import 会被 ESM 提到模块顶部，比 polyfill 先跑，导致 window 未定义）
const { KeepOriginalStrategy } = await import('../src/services/image/strategies/KeepOriginalStrategy')
const { CopyAbsoluteStrategy } = await import('../src/services/image/strategies/CopyAbsoluteStrategy')
const { CopyRelativeStrategy } = await import('../src/services/image/strategies/CopyRelativeStrategy')

// ---------- 测试工具 ----------

let pass = 0
let fail = 0
const failures: string[] = []

function eq(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  ✗ ${name}`)
    console.log(`     expected: ${JSON.stringify(expected)}`)
    console.log(`     actual:   ${JSON.stringify(actual)}`)
  }
}

function match(name: string, actual: string, regex: RegExp): void {
  const ok = regex.test(actual)
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  ✗ ${name}`)
    console.log(`     expected match: ${regex}`)
    console.log(`     actual:         ${JSON.stringify(actual)}`)
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ──`)
}

function fakeFile(name: string, sizeBytes = 16): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'image/png' })
}

function clearIpcCalls(): void {
  ipcCalls.length = 0
}

// ---------- KeepOriginalStrategy ----------
section('KeepOriginalStrategy 三协议分支')

const keep = new KeepOriginalStrategy()

eq('http URL → 原样返回',
  await keep.resolveFinalPath({
    file: fakeFile('a.png'),
    originalUrl: 'http://example.com/foo.png',
    tabId: 't1',
  }),
  'http://example.com/foo.png',
)

eq('https URL → 原样返回',
  await keep.resolveFinalPath({
    file: fakeFile('a.png'),
    originalUrl: 'https://cdn.example.com/x.jpg',
    tabId: 't1',
  }),
  'https://cdn.example.com/x.jpg',
)

clearIpcCalls()
const fileProtoRes = await keep.resolveFinalPath({
  file: fakeFile('local.png'),
  originalUrl: 'file:///C:/Users/Pictures/x.png',
  tabId: 't1',
  tabFilePath: 'D:/notes/foo.md',
})
match('file:/// → 走 absolute 落本地',
  fileProtoRes,
  /^D:\/Users\/Documents\/alhagi\/images\/\d+_local\.png$/,
)
eq('file:/// → 触发 ensureDir + saveBinaryFile',
  ipcCalls.some(c => c.method === 'saveBinaryFile'),
  true,
)

clearIpcCalls()
match('无 URL（截图）→ 走 relative',
  await keep.resolveFinalPath({
    file: fakeFile('screenshot.png'),
    tabId: 't1',
    tabFilePath: 'D:/notes/foo.md',
  }),
  /^\.\/assets\/\d+_screenshot\.png$/,
)

// ---------- CopyRelativeStrategy ----------
section('CopyRelativeStrategy 完整路径')

const rel = new CopyRelativeStrategy()

// 5a 已保存 + 无 userSetting
clearIpcCalls()
const r5a = await rel.resolveFinalPath({
  file: fakeFile('a.png'),
  tabId: 't1',
  tabFilePath: 'D:/notes/foo.md',
})
match('已保存 + 无设 → ./assets/<ts>_a.png',
  r5a,
  /^\.\/assets\/\d+_a\.png$/,
)
match('写盘路径 = mdDir/assets/...',
  ipcCalls.find(c => c.method === 'saveBinaryFile')?.args[0] as string,
  /^D:\/notes\/assets\/\d+_a\.png$/,
)

// 5b 已保存 + userSetting='pics'
clearIpcCalls()
match('已保存 + userSetting=pics → ./pics/<ts>_b.png',
  await rel.resolveFinalPath({
    file: fakeFile('b.png'),
    tabId: 't1',
    tabFilePath: 'D:/notes/foo.md',
    storagePathTemplate: 'pics',
  }),
  /^\.\/pics\/\d+_b\.png$/,
)

// 5c 已保存 + 绝对 userSetting → warn + 回退
clearIpcCalls()
const origWarn = console.warn
let warned = ''
console.warn = (msg: unknown) => { warned = String(msg) }
const r5c = await rel.resolveFinalPath({
  file: fakeFile('c.png'),
  tabId: 't1',
  tabFilePath: 'D:/notes/foo.md',
  storagePathTemplate: 'D:/global-images',
})
console.warn = origWarn
match('绝对 userSetting → 回退 ./assets',
  r5c,
  /^\.\/assets\/\d+_c\.png$/,
)
eq('绝对 userSetting → 触发警告',
  warned.includes('imageStoragePath 是绝对路径'),
  true,
)

// 5d {filename} 展开
clearIpcCalls()
match('{filename} → ./assets/d/<ts>_d.png',
  await rel.resolveFinalPath({
    file: fakeFile('d.png'),
    tabId: 't1',
    tabFilePath: 'D:/notes/foo.md',
    storagePathTemplate: 'assets/{filename}',
  }),
  /^\.\/assets\/d\/\d+_d\.png$/,
)

// 5e 未保存 + 用户值（修复 B3）
clearIpcCalls()
const r5e = await rel.resolveFinalPath({
  file: fakeFile('e.png'),
  tabId: 't_unsaved',
  storagePathTemplate: 'pics',
})
match('未保存 + userSetting=pics → ./pics/...（修复 B3）',
  r5e,
  /^\.\/pics\/\d+_e\.png$/,
)
match('未保存写盘到 temp/<tabId>/pics/...',
  ipcCalls.find(c => c.method === 'saveBinaryFile')?.args[0] as string,
  /alhagi\/cache\/image\/t_unsaved\/pics\/\d+_e\.png$/,
)

// 5f 未保存 + 无设
clearIpcCalls()
match('未保存 + 无设 → ./assets/<ts>_f.png',
  await rel.resolveFinalPath({
    file: fakeFile('f.png'),
    tabId: 't_unsaved2',
  }),
  /^\.\/assets\/\d+_f\.png$/,
)

// 5g 深层 mdDir
clearIpcCalls()
const r5g = await rel.resolveFinalPath({
  file: fakeFile('g.png'),
  tabId: 't1',
  tabFilePath: 'D:/notes/sub/inner/bar.md',
})
match('深层 mdDir → 相对路径正常',
  r5g,
  /^\.\/assets\/\d+_g\.png$/,
)
match('深层写盘',
  ipcCalls.find(c => c.method === 'saveBinaryFile')?.args[0] as string,
  /^D:\/notes\/sub\/inner\/assets\/\d+_g\.png$/,
)

// ---------- CopyAbsoluteStrategy ----------
section('CopyAbsoluteStrategy 完整路径')

const abs = new CopyAbsoluteStrategy()

// 6a 无设 + 无 ws → 全局可见目录
clearIpcCalls()
match('absolute + 无设 + 无ws → <Doc>/alhagi/images/<ts>_a.png',
  await abs.resolveFinalPath({
    file: fakeFile('a.png'),
    tabId: 't1',
    tabFilePath: 'D:/notes/foo.md',
  }),
  /^D:\/Users\/Documents\/alhagi\/images\/\d+_a\.png$/,
)

// 6b 无设 + 有 ws → 仍走全局
clearIpcCalls()
match('absolute + 无设 + 有ws → 仍走全局',
  await abs.resolveFinalPath({
    file: fakeFile('b.png'),
    tabId: 't1',
    tabFilePath: 'D:/workspace/notes/bar.md',
    workspaceRoot: 'D:/workspace',
  }),
  /^D:\/Users\/Documents\/alhagi\/images\/\d+_b\.png$/,
)

// 6c 相对 userSetting + 有 ws
clearIpcCalls()
match('absolute + 相对设 + 有ws → workspace/assets/...',
  await abs.resolveFinalPath({
    file: fakeFile('c.png'),
    tabId: 't1',
    tabFilePath: 'D:/workspace/notes/bar.md',
    workspaceRoot: 'D:/workspace',
    storagePathTemplate: 'assets',
  }),
  /^D:\/workspace\/assets\/\d+_c\.png$/,
)

// 6d 相对 userSetting + 无 ws（修复 B4）
clearIpcCalls()
match('absolute + 相对设 + 无ws → 全局/pics（修复 B4）',
  await abs.resolveFinalPath({
    file: fakeFile('d.png'),
    tabId: 't1',
    storagePathTemplate: 'pics',
  }),
  /^D:\/Users\/Documents\/alhagi\/images\/pics\/\d+_d\.png$/,
)

// 6e 绝对 userSetting
clearIpcCalls()
match('absolute + 绝对设 → 直接用',
  await abs.resolveFinalPath({
    file: fakeFile('e.png'),
    tabId: 't1',
    storagePathTemplate: 'D:/Pictures',
  }),
  /^D:\/Pictures\/\d+_e\.png$/,
)

// 6f {date}
clearIpcCalls()
match('{date} 展开',
  await abs.resolveFinalPath({
    file: fakeFile('f.png'),
    tabId: 't1',
    storagePathTemplate: 'D:/Pictures/{date}',
  }),
  /^D:\/Pictures\/\d{4}-\d{2}-\d{2}\/\d+_f\.png$/,
)

// 6g {filename}
clearIpcCalls()
match('{filename} = file.name 去扩展名',
  await abs.resolveFinalPath({
    file: fakeFile('g.png'),
    tabId: 't1',
    storagePathTemplate: 'D:/Pictures/{filename}',
  }),
  /^D:\/Pictures\/g\/\d+_g\.png$/,
)

// ---------- 边界 ----------
section('边界')

// 7a 无扩展名
clearIpcCalls()
const r7a = await rel.resolveFinalPath({
  file: fakeFile('README'),
  tabId: 't1',
  tabFilePath: 'D:/notes/foo.md',
})
match('无扩展名 README → 不补 .README',
  r7a,
  /^\.\/assets\/\d+_README$/,
)
eq('确认末尾不是 .README', r7a.endsWith('.README'), false)

// 7b 跨盘符
clearIpcCalls()
match('跨盘符 mdFile + 默认相对',
  await rel.resolveFinalPath({
    file: fakeFile('x.png'),
    tabId: 't1',
    tabFilePath: 'C:/notes/foo.md',
  }),
  /^\.\/assets\/\d+_x\.png$/,
)
match('确认写盘到 C: 盘',
  ipcCalls.find(c => c.method === 'saveBinaryFile')?.args[0] as string,
  /^C:\/notes\/assets\/\d+_x\.png$/,
)

// 7c 相对路径回到父目录
clearIpcCalls()
const r7c = await rel.resolveFinalPath({
  file: fakeFile('p.png'),
  tabId: 't1',
  tabFilePath: 'D:/notes/sub/foo.md',
  storagePathTemplate: '../assets',
})
console.log('  ℹ storagePathTemplate="../assets" 输出:', r7c)
match('相对回退路径生成 (无论 ./ 还是 ../)',
  r7c,
  /\.png$/,
)

// 7d 多点扩展
clearIpcCalls()
const r7d = await rel.resolveFinalPath({
  file: fakeFile('archive.tar.gz'),
  tabId: 't1',
  tabFilePath: 'D:/notes/foo.md',
})
match('archive.tar.gz → 保留 archive.tar.gz',
  r7d,
  /\d+_archive\.tar\.gz$/,
)

// 7e 隐藏文件
clearIpcCalls()
const r7e = await rel.resolveFinalPath({
  file: fakeFile('.gitkeep'),
  tabId: 't1',
  tabFilePath: 'D:/notes/foo.md',
})
match('.gitkeep → 无 .gitkeep 双后缀',
  r7e,
  /\d+_\.gitkeep$/,
)
eq('确认末尾是 _.gitkeep 不是 _.gitkeep.gitkeep',
  r7e.split('_').pop(),
  '.gitkeep',
)

// ---------- 总结 ----------
console.log('\n══════════════════════════════════════════')
console.log(`${pass} pass / ${fail} fail`)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  -', f)
  process.exit(1)
}
