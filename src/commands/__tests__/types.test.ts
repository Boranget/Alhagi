import { describe, it, expect } from 'vitest'
import { matchKeyEvent } from '../types'

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init)
}

describe('matchKeyEvent — 对象形式 Keybinding', () => {
  // registry 中绝大多数绑定只写 ctrl: true，不显式声明 alt/shift。
  // 严格匹配必须把缺省字段视为 false，否则全部失配（回归重点）。
  const ctrlW = { key: 'w', modifiers: { ctrl: true } }

  it('Ctrl+W 匹配 { ctrl: true }（缺省 alt/shift 视为 false）', () => {
    expect(matchKeyEvent(key({ key: 'w', ctrlKey: true }), ctrlW)).toBe(true)
  })

  it('Ctrl+Shift+W 不匹配 { ctrl: true }（严格 shift）', () => {
    expect(matchKeyEvent(key({ key: 'w', ctrlKey: true, shiftKey: true }), ctrlW)).toBe(false)
  })

  it('Ctrl+Alt+W 不匹配 { ctrl: true }（严格 alt）', () => {
    expect(matchKeyEvent(key({ key: 'w', ctrlKey: true, altKey: true }), ctrlW)).toBe(false)
  })

  it('裸 W 不匹配 { ctrl: true }', () => {
    expect(matchKeyEvent(key({ key: 'w' }), ctrlW)).toBe(false)
  })

  it('Cmd 视为主修饰键（ctrl 折叠 ctrlKey||metaKey）', () => {
    expect(matchKeyEvent(key({ key: 'w', metaKey: true }), ctrlW)).toBe(true)
  })

  it('无修饰键绑定匹配裸键', () => {
    const f1 = { key: 'f1', modifiers: {} }
    expect(matchKeyEvent(key({ key: 'F1' }), f1)).toBe(true)
    expect(matchKeyEvent(key({ key: 'F1', ctrlKey: true }), f1)).toBe(false)
  })

  it('Ctrl+Shift+Z 匹配 { ctrl, shift }，不误触 { ctrl } 的 Ctrl+Z 绑定', () => {
    const ctrlZ = { key: 'z', modifiers: { ctrl: true } }
    const ctrlShiftZ = { key: 'z', modifiers: { ctrl: true, shift: true } }
    const evt = key({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(matchKeyEvent(evt, ctrlShiftZ)).toBe(true)
    expect(matchKeyEvent(evt, ctrlZ)).toBe(false)
    expect(matchKeyEvent(key({ key: 'z', ctrlKey: true }), ctrlZ)).toBe(true)
  })
})

describe('matchKeyEvent — 字符串 accelerator', () => {
  it('Ctrl+S 匹配字符串 "Ctrl+S"', () => {
    expect(matchKeyEvent(key({ key: 's', ctrlKey: true }), 'Ctrl+S')).toBe(true)
  })

  it('Ctrl+Shift+S 不匹配 "Ctrl+S"（严格 shift）', () => {
    expect(matchKeyEvent(key({ key: 's', ctrlKey: true, shiftKey: true }), 'Ctrl+S')).toBe(false)
  })

  it('无修饰键的 accelerator 不匹配带 Ctrl 的事件', () => {
    expect(matchKeyEvent(key({ key: 's', ctrlKey: true }), 'S')).toBe(false)
  })
})
