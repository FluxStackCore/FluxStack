/**
 * Tests for Plugin Client Hooks system
 * Server-side: registry, signature, endpoint
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { pluginClientHooks } from '@core/server/plugin-client-hooks'

describe('PluginClientHookRegistry', () => {
  beforeEach(() => {
    pluginClientHooks.clear()
  })

  describe('register()', () => {
    it('should register a hook with a name and code', () => {
      pluginClientHooks.register('onEdenInit', 'console.log("hello")')
      const hooks = pluginClientHooks.getHooks()
      expect(hooks.onEdenInit).toEqual(['console.log("hello")'])
    })

    it('should append multiple codes to the same hook', () => {
      pluginClientHooks.register('onEdenInit', 'code1()')
      pluginClientHooks.register('onEdenInit', 'code2()')
      const hooks = pluginClientHooks.getHooks()
      expect(hooks.onEdenInit).toEqual(['code1()', 'code2()'])
    })

    it('should support multiple hook names', () => {
      pluginClientHooks.register('onEdenInit', 'eden()')
      pluginClientHooks.register('onLiveConnect', 'live()')
      const hooks = pluginClientHooks.getHooks()
      expect(Object.keys(hooks)).toHaveLength(2)
      expect(hooks.onEdenInit).toEqual(['eden()'])
      expect(hooks.onLiveConnect).toEqual(['live()'])
    })
  })

  describe('getHooks()', () => {
    it('should return empty object when no hooks registered', () => {
      expect(pluginClientHooks.getHooks()).toEqual({})
    })

    it('should return a copy (not the internal map)', () => {
      pluginClientHooks.register('test', 'code()')
      const hooks1 = pluginClientHooks.getHooks()
      const hooks2 = pluginClientHooks.getHooks()
      expect(hooks1).toEqual(hooks2)
      expect(hooks1).not.toBe(hooks2) // different objects
      expect(hooks1.test).not.toBe(hooks2.test) // different arrays
    })
  })

  describe('getHook()', () => {
    it('should return codes for a specific hook', () => {
      pluginClientHooks.register('onEdenInit', 'code()')
      expect(pluginClientHooks.getHook('onEdenInit')).toEqual(['code()'])
    })

    it('should return empty array for unregistered hook', () => {
      expect(pluginClientHooks.getHook('nonexistent')).toEqual([])
    })
  })

  describe('clear()', () => {
    it('should remove all hooks', () => {
      pluginClientHooks.register('a', 'code1()')
      pluginClientHooks.register('b', 'code2()')
      pluginClientHooks.clear()
      expect(pluginClientHooks.getHooks()).toEqual({})
    })
  })

  describe('getSignature()', () => {
    it('should return a hex string', () => {
      pluginClientHooks.register('onEdenInit', 'test()')
      const sig = pluginClientHooks.getSignature()
      expect(sig).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })

    it('should return consistent signature for same hooks', () => {
      pluginClientHooks.register('onEdenInit', 'test()')
      const sig1 = pluginClientHooks.getSignature()
      const sig2 = pluginClientHooks.getSignature()
      expect(sig1).toBe(sig2)
    })

    it('should change signature when hooks change', () => {
      pluginClientHooks.register('onEdenInit', 'code1()')
      const sig1 = pluginClientHooks.getSignature()
      pluginClientHooks.register('onEdenInit', 'code2()')
      const sig2 = pluginClientHooks.getSignature()
      expect(sig1).not.toBe(sig2)
    })

    it('should change signature after clear + re-register', () => {
      pluginClientHooks.register('a', 'x()')
      const sig1 = pluginClientHooks.getSignature()
      pluginClientHooks.clear()
      pluginClientHooks.register('b', 'y()')
      const sig2 = pluginClientHooks.getSignature()
      expect(sig1).not.toBe(sig2)
    })
  })

  describe('getSignedResponse()', () => {
    it('should return hooks and signature', () => {
      pluginClientHooks.register('onEdenInit', 'init()')
      const response = pluginClientHooks.getSignedResponse()
      expect(response.hooks).toEqual({ onEdenInit: ['init()'] })
      expect(response.signature).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return empty hooks with valid signature when nothing registered', () => {
      const response = pluginClientHooks.getSignedResponse()
      expect(response.hooks).toEqual({})
      expect(response.signature).toMatch(/^[a-f0-9]{64}$/)
    })

    it('signature should match getSignature()', () => {
      pluginClientHooks.register('test', 'code()')
      const response = pluginClientHooks.getSignedResponse()
      expect(response.signature).toBe(pluginClientHooks.getSignature())
    })
  })

  describe('integrity verification', () => {
    it('tampered hooks should not match original signature', () => {
      pluginClientHooks.register('onEdenInit', 'legitimate()')
      const originalSig = pluginClientHooks.getSignature()

      // Simulate tampering: clear and register malicious code
      pluginClientHooks.clear()
      pluginClientHooks.register('onEdenInit', 'malicious()')
      const tamperedSig = pluginClientHooks.getSignature()

      // Signatures should differ — server would detect the tampering
      expect(originalSig).not.toBe(tamperedSig)
    })
  })
})
