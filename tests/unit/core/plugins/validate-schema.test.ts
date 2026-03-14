/**
 * Tests for DefaultPluginConfigManager.validatePluginConfig()
 * and createPluginUtils().validateSchema()
 *
 * Verifies that the real validation logic (replacing always-true stubs)
 * correctly validates data against JSON schemas.
 */

import { describe, it, expect } from 'vitest'
import { DefaultPluginConfigManager, createPluginUtils } from '@core/plugins/config'
import type { PluginConfigSchema } from '@core/plugins/types'

// ─── DefaultPluginConfigManager direct tests ───────────────────────────

describe('DefaultPluginConfigManager.validatePluginConfig', () => {
  const manager = new DefaultPluginConfigManager()

  const plugin = (schema?: PluginConfigSchema) => ({
    name: 'test-plugin',
    ...(schema ? { configSchema: schema } : {})
  })

  it('should return valid when plugin has no configSchema', () => {
    const result = manager.validatePluginConfig(plugin(), { anything: true })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // ── Type checking ──

  it('should reject non-object data when schema type is object', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {}
    }
    const result = manager.validatePluginConfig(plugin(schema), 'not-an-object')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('must be an object'))).toBe(true)
  })

  it('should accept valid object data', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { name: 'hello' })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // ── Required properties ──

  it('should reject missing required properties', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        secret: { type: 'string' }
      },
      required: ['apiKey', 'secret']
    }
    const result = manager.validatePluginConfig(plugin(schema), { apiKey: 'abc' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('secret'))).toBe(true)
  })

  it('should accept data with all required properties present', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        apiKey: { type: 'string' }
      },
      required: ['apiKey']
    }
    const result = manager.validatePluginConfig(plugin(schema), { apiKey: 'abc' })
    expect(result.valid).toBe(true)
  })

  // ── Property type validation ──

  it('should reject property with wrong type', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        port: { type: 'number' }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { port: 'not-a-number' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('port') && e.includes('number'))).toBe(true)
  })

  // ── String constraints ──

  it('should reject string shorter than minLength', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        token: { type: 'string', minLength: 10 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { token: 'abc' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at least 10 characters'))).toBe(true)
  })

  it('should reject string exceeding maxLength', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        code: { type: 'string', maxLength: 5 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { code: 'toolongvalue' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at most 5 characters'))).toBe(true)
  })

  it('should reject string not matching pattern', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        email: { type: 'string', pattern: '^\\S+@\\S+$' }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { email: 'invalid' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('pattern'))).toBe(true)
  })

  it('should accept string matching pattern', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        email: { type: 'string', pattern: '^\\S+@\\S+$' }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { email: 'a@b.com' })
    expect(result.valid).toBe(true)
  })

  // ── Number constraints ──

  it('should reject number below minimum', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        port: { type: 'number', minimum: 1 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { port: 0 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at least 1'))).toBe(true)
  })

  it('should reject number above maximum', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        port: { type: 'number', maximum: 65535 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { port: 70000 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at most 65535'))).toBe(true)
  })

  it('should reject number not a multiple of multipleOf', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        step: { type: 'number', multipleOf: 5 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { step: 7 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('multiple of 5'))).toBe(true)
  })

  it('should accept valid number within constraints', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { port: 3000 })
    expect(result.valid).toBe(true)
  })

  // ── Array constraints ──

  it('should reject array with fewer items than minItems', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        tags: { type: 'array', minItems: 1 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { tags: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at least 1 items'))).toBe(true)
  })

  it('should reject array exceeding maxItems', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        tags: { type: 'array', maxItems: 2 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { tags: ['a', 'b', 'c'] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at most 2 items'))).toBe(true)
  })

  it('should validate array item types', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        ports: { type: 'array', items: { type: 'number' } }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { ports: [3000, 'oops', 8080] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('[1]') && e.includes('number'))).toBe(true)
  })

  it('should accept valid array', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        ports: { type: 'array', items: { type: 'number' }, minItems: 1, maxItems: 5 }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { ports: [3000, 8080] })
    expect(result.valid).toBe(true)
  })

  // ── Enum validation ──

  it('should reject value not in enum', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['debug', 'info', 'error'] }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { level: 'verbose' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('must be one of'))).toBe(true)
  })

  it('should accept value in enum', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['debug', 'info', 'error'] }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { level: 'info' })
    expect(result.valid).toBe(true)
  })

  // ── Nested object validation ──

  it('should validate nested object properties', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            port: { type: 'number' }
          },
          required: ['host']
        }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { db: { port: 5432 } })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('host'))).toBe(true)
  })

  it('should accept valid nested object', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        db: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            port: { type: 'number' }
          },
          required: ['host']
        }
      }
    }
    const result = manager.validatePluginConfig(plugin(schema), { db: { host: 'localhost', port: 5432 } })
    expect(result.valid).toBe(true)
  })

  // ── additionalProperties ──

  it('should warn on unexpected properties when additionalProperties is false', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      additionalProperties: false
    }
    const result = manager.validatePluginConfig(plugin(schema), { name: 'test', extra: true })
    expect(result.warnings.some(w => w.includes('extra'))).toBe(true)
  })

  // ── Multiple errors ──

  it('should collect multiple errors in a single validation', () => {
    const schema: PluginConfigSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        port: { type: 'number' }
      },
      required: ['name', 'port']
    }
    const result = manager.validatePluginConfig(plugin(schema), {})
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── createPluginUtils().validateSchema integration tests ──────────────

describe('createPluginUtils().validateSchema', () => {
  const utils = createPluginUtils()

  it('should validate data against a schema and return valid for correct data', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        apiKey: { type: 'string' }
      },
      required: ['apiKey']
    }
    const result = utils.validateSchema({ apiKey: 'my-key' }, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should return errors for invalid data', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        apiKey: { type: 'string' }
      },
      required: ['apiKey']
    }
    const result = utils.validateSchema({}, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should reject wrong property types', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        port: { type: 'number' }
      }
    }
    const result = utils.validateSchema({ port: 'abc' }, schema)
    expect(result.valid).toBe(false)
  })

  it('should return valid when schema is undefined (no constraints)', () => {
    const result = utils.validateSchema({ anything: true }, undefined)
    expect(result.valid).toBe(true)
  })
})
