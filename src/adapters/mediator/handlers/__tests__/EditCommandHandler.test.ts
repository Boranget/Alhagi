import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const gateway = vi.hoisted(() => ({
  undo: vi.fn(),
  redo: vi.fn(),
  focus: vi.fn(),
  selectAll: vi.fn(),
  insertText: vi.fn(),
}))

vi.mock('@adapters/gateways/EditorServiceGateway', () => ({
  getEditorServiceGateway: () => gateway,
}))

import { EditCommandHandler } from '../EditCommandHandler'

function mockExecCommand(returnValue: boolean) {
  const fn = vi.fn().mockReturnValue(returnValue)
  Object.defineProperty(document, 'execCommand', {
    value: fn,
    configurable: true,
    writable: true,
  })
  return fn
}

function mockClipboardReadText(result: { ok: boolean; text?: string }) {
  const fn = vi.fn().mockImplementation(() =>
    result.ok ? Promise.resolve(result.text ?? '') : Promise.reject(new Error('denied'))
  )
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText: fn },
    configurable: true,
  })
  return fn
}

describe('EditCommandHandler', () => {
  const handler = new EditCommandHandler()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 还原 document.execCommand / navigator.clipboard 由下次 mock 覆盖
  })

  it('edit:undo → gateway.undo()', async () => {
    await handler.execute({ type: 'edit:undo' })
    expect(gateway.undo).toHaveBeenCalledTimes(1)
  })

  it('edit:redo → gateway.redo()', async () => {
    await handler.execute({ type: 'edit:redo' })
    expect(gateway.redo).toHaveBeenCalledTimes(1)
  })

  it('edit:selectAll → gateway.selectAll()', async () => {
    await handler.execute({ type: 'edit:selectAll' })
    expect(gateway.selectAll).toHaveBeenCalledTimes(1)
  })

  it('edit:cut → focus + execCommand(cut)', async () => {
    const exec = mockExecCommand(true)
    await handler.execute({ type: 'edit:cut' })
    expect(gateway.focus).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith('cut')
  })

  it('edit:copy → focus + execCommand(copy)', async () => {
    const exec = mockExecCommand(true)
    await handler.execute({ type: 'edit:copy' })
    expect(gateway.focus).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('edit:paste — execCommand 成功时不走剪贴板回退', async () => {
    const exec = mockExecCommand(true)
    const readText = mockClipboardReadText({ ok: true, text: 'hello' })

    await handler.execute({ type: 'edit:paste' })

    expect(exec).toHaveBeenCalledWith('paste')
    expect(readText).not.toHaveBeenCalled()
    expect(gateway.insertText).not.toHaveBeenCalled()
  })

  it('edit:paste — execCommand 被拒绝（Chromium）时回退 navigator.clipboard + insertText', async () => {
    const exec = mockExecCommand(false)
    const readText = mockClipboardReadText({ ok: true, text: 'fallback text' })

    await handler.execute({ type: 'edit:paste' })

    expect(exec).toHaveBeenCalledWith('paste')
    expect(readText).toHaveBeenCalledTimes(1)
    expect(gateway.insertText).toHaveBeenCalledWith('fallback text')
  })

  it('edit:paste — 剪贴板不可读时不抛异常', async () => {
    mockExecCommand(false)
    const readText = mockClipboardReadText({ ok: false })

    await expect(handler.execute({ type: 'edit:paste' })).resolves.toBeUndefined()
    expect(gateway.insertText).not.toHaveBeenCalled()
    expect(readText).toHaveBeenCalledTimes(1)
  })
})
