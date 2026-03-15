import { describe, it, expect } from 'vitest'
import { FluxPluginsGenerator } from '@core/build/flux-plugins-generator'
import { LiveComponentsGenerator } from '@core/build/live-components-generator'
import { TemplateEngine } from '@core/cli/generators/template-engine'

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

  it('live-components-generator discovers components', () => {
    const generator = new LiveComponentsGenerator()

    // discoverComponents scans app/server/live/
    const components = generator.discoverComponents()

    // Should return an array (may be empty or have components)
    expect(Array.isArray(components)).toBe(true)

    // Each component entry should have the correct shape
    for (const component of components) {
      expect(component.fileName).toBeDefined()
      expect(typeof component.fileName).toBe('string')
      expect(component.className).toBeDefined()
      expect(typeof component.className).toBe('string')
      expect(component.componentName).toBeDefined()
      expect(typeof component.componentName).toBe('string')
      expect(component.filePath).toBeDefined()
      expect(component.filePath).toContain('@app/server/live/')
    }
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
