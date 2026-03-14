import type { PromptConfig } from "./types"
import { buildLogger } from "@core/utils/build-logger"

export class PromptSystem {
  async prompt(config: PromptConfig): Promise<unknown> {
    // Simple implementation using process.stdin
    // In a real implementation, you'd use a library like inquirer or prompts
    
    return new Promise((resolve) => {
      process.stdout.write(`${config.message} `)
      
      if (config.default !== undefined) {
        process.stdout.write(`(${config.default}) `)
      }
      
      if (config.choices) {
        process.stdout.write(`\nChoices: ${config.choices.map(c => c.name || c.value).join(', ')}\n`)
      }
      
      process.stdout.write(': ')
      
      process.stdin.once('data', (data) => {
        const input = data.toString().trim()
        
        if (!input && config.default !== undefined) {
          resolve(config.default)
          return
        }
        
        if (config.validate) {
          const validation = config.validate(input)
          if (validation !== true) {
            buildLogger.error(`${validation}`)
            // In a real implementation, you'd re-prompt
            resolve(input)
            return
          }
        }
        
        if (config.choices) {
          const choice = config.choices.find(c => 
            c.name === input || c.value === input
          )
          if (choice) {
            resolve(choice.value)
            return
          }
        }
        
        resolve(input)
      })
    })
  }

  async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    return this.prompt({
      type: 'confirm',
      message: `${message} (y/n)`,
      default: defaultValue
    }).then(result => {
      const value = String(result).toLowerCase()
      return value === 'y' || value === 'yes' || value === 'true'
    })
  }

  async select(message: string, choices: Array<{ name: string; value: unknown; description?: string }>): Promise<unknown> {
    return this.prompt({
      type: 'select',
      message,
      choices
    })
  }

  async input(message: string, defaultValue?: string, validate?: (value: string) => boolean | string): Promise<string> {
    return this.prompt({
      type: 'input',
      message,
      default: defaultValue,
      validate: validate ? (value: unknown) => validate(String(value)) : undefined
    }) as Promise<string>
  }
}

export const promptSystem = new PromptSystem()