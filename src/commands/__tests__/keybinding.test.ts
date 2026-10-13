import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../dispatcher', () => ({
  executeCommand: vi.fn(),
  canExecuteCommand: vi.fn(() => true),
}))

import { getKeybindingManager } from '../keybinding'
import { executeCommand } from '../dispatcher'

function pressKey(init: KeyboardEventInit): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  )
}

describe('KeybindingManager — 快捷键可达性', () => {
  const manager = getKeybindingManager()

  beforeEach(() => {
    vi.clearAllMocks()
    manager.attachGlobalListener()
  })

  afterEach(() => {
    manager.detachGlobalListener()
  })

  it('Ctrl+Y 触发 hidden 的 edit.redoAlt（Windows redo 别名不被 hidden 过滤）', () => {
    pressKey({ key: 'y', ctrlKey: true })
    expect(executeCommand).toHaveBeenCalledTimes(1)
    expect(executeCommand).toHaveBeenCalledWith('edit.redoAlt')
  })

  it('Ctrl+Shift+Z 触发 edit.redo', () => {
    pressKey({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(executeCommand).toHaveBeenCalledWith('edit.redo')
    expect(executeCommand).not.toHaveBeenCalledWith('edit.undo')
  })

  it('Ctrl+Z 触发 edit.undo，不触发 edit.redo', () => {
    pressKey({ key: 'z', ctrlKey: true })
    expect(executeCommand).toHaveBeenCalledWith('edit.undo')
    expect(executeCommand).not.toHaveBeenCalledWith('edit.redo')
  })

  it('无修饰键的字母键不触发任何命令', () => {
    pressKey({ key: 'y' })
    expect(executeCommand).not.toHaveBeenCalled()
  })
})
