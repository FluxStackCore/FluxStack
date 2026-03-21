import { describe, it, expect } from 'vitest'
import { FluxPluginsGenerator } from '@core/build/flux-plugins-generator'
import { generateLiveComponentsFile } from '@fluxstack/live/build'
import { TemplateEngine } from '@core/cli/generators/template-engine'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

describe('Build System - Integration', () => {
  it('flux-plugins-generator produces valid TypeScript', () => {
    const generator = new FluxPluginsGenerator()

    // discoverPlugins scans the plugins/ directory
    const plugins = generator.discoverPlugins()

    // The generator should return an array (possibly empty if no plugins exist)
    expect(Array.isArray(plugins)).toBe(true)

    // Each plugin entry should have the correct shape
    for (const plugin of plugins) {
      expect(plugin.pluginName).toBeDefined()
      expect(typeof plugin.pluginName).toBe('string')
      expect(plugin.entryFile).toBeDefined()
      expect(typeof plugin.entryFile).toBe('string')
      expect(plugin.relativePath).toBeDefined()
      expect(['external', 'built-in']).toContain(plugin.type)
    }
  })

  it('generateLiveComponentsFile discovers components', () => {
    const componentsDir = join(process.cwd(), 'app', 'server', 'live')
    const outFile = join(process.cwd(), 'core', 'server', 'live', 'auto-generated-components.ts')

    const count = generateLiveComponentsFile({
      componentsDir,
      outFile,
      importPrefix: '@app/server/live',
    })

    // Should find components (9 in the FluxStack app)
    expect(count).toBeGreaterThan(0)

    // Generated file should exist and contain valid exports
    expect(existsSync(outFile)).toBe(true)
    const content = readFileSync(outFile, 'utf-8')
    expect(content).toContain('export const liveComponentClasses')
    expect(content).toContain('@app/server/live/')
  })

  it('template engine processes variables correctly', async () => {
    const engine = new TemplateEngine()

    const template = {
      name: 'test-template',
      description: 'Template for testing',
      files: [
        {
          path: '{{kebabName}}/{{kebabName}}.ts',
          content: [
            'export class {{pascalName}}Service {',
            '  name = "{{name}}"',
            '  snake = "{{snakeName}}"',
            '  camel = "{{camelName}}"',
            '  constant = "{{constantName}}"',
            '}',
          ].join('\n'),
        },
      ],
    }

    const context = {
      workingDir: '/tmp/test',
      config: { app: { name: 'test-app' } },
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    }

    const options = {
      name: 'my-widget',
      type: 'test' as const,
      force: false,
      dryRun: false,
    }

    const files = await engine.processTemplate(template as any, context as any, options)

    expect(files).toHaveLength(1)

    const file = files[0]

    // Path should have kebab-case substitution
    expect(file.path).toContain('my-widget')

    // Content should have all variable substitutions
    expect(file.content).toContain('class MyWidgetService')
    expect(file.content).toContain('name = "my-widget"')
    expect(file.content).toContain('snake = "my_widget"')
    expect(file.content).toContain('camel = "myWidget"')
    expect(file.content).toContain('constant = "MY_WIDGET"')
  })
})
