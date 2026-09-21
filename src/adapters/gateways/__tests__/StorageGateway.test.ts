import { describe, it, expect, beforeEach } from 'vitest'
import { StorageGateway } from '../StorageGateway'

describe('StorageGateway', () => {
  let gateway: StorageGateway

  beforeEach(() => {
    gateway = new StorageGateway()
  })

  describe('get / set', () => {
    it('should return undefined for missing key', () => {
      expect(gateway.get('missing')).toBeUndefined()
    })

    it('should store and retrieve a value', () => {
      gateway.set('name', 'Alice')
      expect(gateway.get('name')).toBe('Alice')
    })

    it('should overwrite existing value', () => {
      gateway.set('key', 'first')
      gateway.set('key', 'second')
      expect(gateway.get('key')).toBe('second')
    })

    it('should handle different types', () => {
      gateway.set('string', 'hello')
      gateway.set('number', 42)
      gateway.set('boolean', true)
      gateway.set('object', { a: 1 })

      expect(gateway.get<string>('string')).toBe('hello')
      expect(gateway.get<number>('number')).toBe(42)
      expect(gateway.get<boolean>('boolean')).toBe(true)
      expect(gateway.get<{ a: number }>('object')).toEqual({ a: 1 })
    })
  })

  describe('delete', () => {
    it('should remove a key', () => {
      gateway.set('key', 'value')
      gateway.delete('key')
      expect(gateway.has('key')).toBe(false)
    })

    it('should not throw when deleting nonexistent key', () => {
      expect(() => gateway.delete('missing')).not.toThrow()
    })
  })

  describe('has', () => {
    it('should return true for existing key', () => {
      gateway.set('key', 'value')
      expect(gateway.has('key')).toBe(true)
    })

    it('should return false for missing key', () => {
      expect(gateway.has('missing')).toBe(false)
    })
  })

  describe('clear', () => {
    it('should remove all entries', () => {
      gateway.set('a', 1)
      gateway.set('b', 2)
      gateway.clear()
      expect(gateway.has('a')).toBe(false)
      expect(gateway.has('b')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return all entries as an object', () => {
      gateway.set('x', 10)
      gateway.set('y', 20)
      expect(gateway.getAll()).toEqual({ x: 10, y: 20 })
    })

    it('should return empty object when empty', () => {
      expect(gateway.getAll()).toEqual({})
    })
  })

  describe('setAll', () => {
    it('should replace all data', () => {
      gateway.set('old', 1)
      gateway.setAll({ new: 2, another: 3 })

      expect(gateway.has('old')).toBe(false)
      expect(gateway.get('new')).toBe(2)
      expect(gateway.get('another')).toBe(3)
    })
  })
})
