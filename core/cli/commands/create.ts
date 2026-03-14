/**
 * FluxStack CLI - Create Command
 * Create a new FluxStack project
 */

import type { CLICommand } from '../command-registry'
import { ProjectCreator } from '@core/templates/create-project'
import { buildLogger } from '@core/utils/build-logger'

export const createCommand: CLICommand = {
  name: 'create',
  description: 'Create a new FluxStack project',
  category: 'Project',
  usage: 'flux create <project-name> [template]',
  examples: [
    'flux create my-app          # Create basic project',
    'flux create my-app full     # Create full-featured project'
  ],
  arguments: [
    {
      name: 'project-name',
      description: 'Name of the project to create',
      required: true,
      type: 'string'
    },
    {
      name: 'template',
      description: 'Project template to use',
      required: false,
      type: 'string',
      default: 'basic',
      choices: ['basic', 'full']
    }
  ],
  handler: async (args, options, context) => {
    const projectName = args[0] as string
    const template = args[1] as string | undefined

    if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
      buildLogger.error("❌ Project name can only contain letters, numbers, hyphens, and underscores")
      return
    }

    try {
      const creator = new ProjectCreator({
        name: projectName as string,
        template: (template as 'basic' | 'full') || 'basic'
      })

      await creator.create()
    } catch (error) {
      buildLogger.error("❌ Failed to create project:", error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}
