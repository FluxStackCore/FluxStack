/**
 * Validation Tests for Config Schema System
 * Tests for config schema validation and error handling
 */

import { describe, it, expect } from 'vitest'
import { defineConfig, config as configHelpers } from '@core/utils/config-schema'

describe('Config Schema Validation', () => {
  describe('Schema Helpers', () => {
    it('should validate string fields', () => {
      const schema = {
        name: configHelpers.string('TEST_NAME', 'default', true)
      }

      const result = defineConfig(schema)
      expect(typeof result.name).toBe('string')
    })

    it('should validate number fields', () => {
      const schema = {
        port: configHelpers.number('TEST_PORT', 3000, true)
      }

      const result = defineConfig(schema)
      expect(typeof result.port).toBe('number')
    })

    it('should validate boolean fields', () => {
      const schema = {
        enabled: configHelpers.boolean('TEST_ENABLED', false)
      }

      const result = defineConfig(schema)
      expect(typeof result.enabled).toBe('boolean')
    })

    it('should validate array fields', () => {
      const schema = {
        items: configHelpers.array('TEST_ITEMS', ['a', 'b'])
      }

      const result = defineConfig(schema)
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('should validate enum fields', () => {
      const schema = {
        env: configHelpers.enum(
          'TEST_ENV',
          ['dev', 'prod'] as const,
          'dev'
        )
      }

      const result = defineConfig(schema)
      expect(['dev', 'prod']).toContain(result.env)
    })
  })

  describe('Custom Validation', () => {
    it('should support custom validation functions', () => {
      const schema = {
        port: {
          type: 'number' as const,
          env: 'TEST_VALIDATION_PORT',
          default: 3000,
          required: true,
          validate: (value: number) => {
            if (value < 1 || value > 65535) {
              return 'Port must be between 1 and 65535'
            }
            return true
          }
        }
      }

      const result = defineConfig(schema)
      expect(result.port).toBeGreaterThan(0)
      expect(result.port).toBeLessThanOrEqual(65535)
    })

    it('should support transform functions', () => {
      const schema = {
        uppercase: {
          type: 'string' as const,
          env: 'TEST_TRANSFORM',
          default: 'test',
          transform: (value: string) => value.toUpperCase()
        }
      }

      const result = defineConfig(schema)
      expect(result.uppercase).toBe('TEST')
    })
  })

  describe('Default Values', () => {
    it('should use default values when env var is not set', () => {
      const schema = {
        withDefault: configHelpers.string('NONEXISTENT_VAR_12345', 'default-value')
      }

      const result = defineConfig(schema)
      expect(result.withDefault).toBe('default-value')
    })

    it('should handle optional fields', () => {
      const schema = {
        optional: configHelpers.string('OPTIONAL_VAR_12345', undefined, false)
      }

      const result = defineConfig(schema)
      expect(result.optional).toBeUndefined()
    })
  })

  describe('Type Inference', () => {
    it('should infer correct types from schema', () => {
      const schema = {
        stringField: configHelpers.string('TEST_STR', 'test'),
        numberField: configHelpers.number('TEST_NUM', 42),
        boolField: configHelpers.boolean('TEST_BOOL', true),
        arrayField: configHelpers.array('TEST_ARR', ['a']),
        enumField: configHelpers.enum('TEST_ENUM', ['a', 'b'] as const, 'a')
      }

      const result = defineConfig(schema)

      // TypeScript should infer these correctly
      const str: string = result.stringField
      const num: number = result.numberField
      const bool: boolean = result.boolField
      const arr: string[] = result.arrayField
      const enm: 'a' | 'b' = result.enumField

      expect(str).toBeDefined()
      expect(num).toBeDefined()
      expect(bool).toBeDefined()
      expect(arr).toBeDefined()
      expect(enm).toBeDefined()
    })
  })

  describe('Nested Config Support', () => {
    it('should support nested config structures', () => {
      const schema1 = {
        field1: configHelpers.string('NESTED1', 'value1')
      }

      const schema2 = {
        field2: configHelpers.number('NESTED2', 100)
      }

      const config1 = defineConfig(schema1)
      const config2 = defineConfig(schema2)

      const nested = {
        group1: config1,
        group2: config2
      }

      expect(nested.group1.field1).toBe('value1')
      expect(nested.group2.field2).toBe(100)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for required fields without value', () => {
      expect(() => {
        const schema = {
          required: {
            type: 'string' as const,
            env: 'ABSOLUTELY_NONEXISTENT_REQUIRED_VAR',
            default: undefined,
            required: true
          }
        }

        defineConfig(schema)
      }).toThrow()
    })
  })

  describe('Type Safety Validation', () => {
    it('should preserve const types', () => {
      const schema = {
        literal: configHelpers.enum('TEST_LITERAL', ['a', 'b', 'c'] as const, 'a')
      } as const

      const result = defineConfig(schema)

      // This should be typed as 'a' | 'b' | 'c', not string
      const value: 'a' | 'b' | 'c' = result.literal
      expect(['a', 'b', 'c']).toContain(value)
    })
  })
})
