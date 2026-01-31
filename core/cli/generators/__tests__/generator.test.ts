import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { ControllerGenerator } from '../controller'
import { ServiceGenerator } from '../service'
import { ComponentGenerator } from '../component'
import { RouteGenerator } from '../route'
import type { GeneratorContext, GeneratorOptions } from '../types'
import { fluxStackConfig } from '@/config'
import { logger } from '@/core/utils/logger'
import { createTimer, formatBytes, isProduction, isDevelopment } from '@/core/utils/helpers'

describe('Code Generators', () => {
    let tempDir: string
    let context: GeneratorContext

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'fluxstack-generator-test-'))

        context = {
            workingDir: tempDir,
            config: fluxStackConfig,
            logger: logger as any,
            utils: {
                createTimer,
                formatBytes,
                isProduction,
                isDevelopment,
                getEnvironment: () => process.env.NODE_ENV || 'development',
                createHash: (data: string) => {
                    const crypto = require('crypto')
                    return crypto.createHash('sha256').update(data).digest('hex')
                },
                deepMerge: (target: any, source: any) => {
                    const result = { ...target }
                    for (const key in source) {
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                            result[key] = context.utils.deepMerge(result[key] || {}, source[key])
                        } else {
                            result[key] = source[key]
                        }
                    }
                    return result
                },
                validateSchema: (_data: any, _schema: any) => {
                    try {
                        return { valid: true, errors: [] }
                    } catch (error) {
                        return { valid: false, errors: [error instanceof Error ? error.message : 'Validation failed'] }
                    }
                }
            }
        }
    })

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true })
    })

    describe('ControllerGenerator', () => {
        it('should generate CRUD controller files', async () => {
            const generator = new ControllerGenerator()
            const options: GeneratorOptions = {
                name: 'user',
                template: 'crud',
                force: false,
                dryRun: false
            }

            await generator.generate(context, options)

            // Check if controller file was created
            const controllerPath = join(tempDir, 'app/server/controllers/user.controller.ts')
            const controllerContent = await readFile(controllerPath, 'utf-8')

            expect(controllerContent).toContain('export class UserController')
            expect(controllerContent).toContain('async getAll()')
            expect(controllerContent).toContain('async getById(')
            expect(controllerContent).toContain('async create(')
            expect(controllerContent).toContain('async update(')
            expect(controllerContent).toContain('async delete(')

            // Check if schema file was created
            const schemaPath = join(tempDir, 'app/server/schemas/user.schema.ts')
            const schemaContent = await readFile(schemaPath, 'utf-8')

            expect(schemaContent).toContain('export const UserSchema')
            expect(schemaContent).toContain('export const CreateUserSchema')
            expect(schemaContent).toContain('export const UpdateUserSchema')
        })

        it('should generate minimal controller', async () => {
            const generator = new ControllerGenerator()
            const options: GeneratorOptions = {
                name: 'product',
                template: 'minimal',
                force: false,
                dryRun: false
            }

            await generator.generate(context, options)

            const controllerPath = join(tempDir, 'app/server/controllers/product.controller.ts')
            const controllerContent = await readFile(controllerPath, 'utf-8')

            expect(controllerContent).toContain('export class ProductController')
            expect(controllerContent).toContain('// TODO: Implement')
        })
    })

    describe('ServiceGenerator', () => {
        it('should generate CRUD service with repository', async () => {
            const generator = new ServiceGenerator()
            const options: GeneratorOptions = {
                name: 'user',
                template: 'crud',
                force: false,
                dryRun: false
            }

            await generator.generate(context, options)

            // Check service file
            const servicePath = join(tempDir, 'app/server/services/user.service.ts')
            const serviceContent = await readFile(servicePath, 'utf-8')

            expect(serviceContent).toContain('export class UserService')
            expect(serviceContent).toContain('async findAll()')
            expect(serviceContent).toContain('async findById(')
            expect(serviceContent).toContain('async create(')
            expect(serviceContent).toContain('async update(')
            expect(serviceContent).toContain('async delete(')

            // Check repository file
            const repositoryPath = join(tempDir, 'app/server/repositories/user.repository.ts')
            const repositoryContent = await readFile(repositoryPath, 'utf-8')

            expect(repositoryContent).toContain('export class UserRepository')
        })
    })

    describe('ComponentGenerator', () => {
        it('should generate basic React component', async () => {
            const generator = new ComponentGenerator()
            const options: GeneratorOptions = {
                name: 'UserCard',
                template: 'basic',
                force: false,
                dryRun: false
            }

            await generator.generate(context, options)

            // Check component file
            const componentPath = join(tempDir, 'app/client/src/components/UserCard/UserCard.tsx')
            const componentContent = await readFile(componentPath, 'utf-8')

            expect(componentContent).toContain('export const UserCard: React.FC')
            expect(componentContent).toContain('export interface UserCardProps')
            expect(componentContent).toContain('import React from \'react\'')

            // Check CSS file
            const cssPath = join(tempDir, 'app/client/src/components/UserCard/UserCard.css')
            const cssContent = await readFile(cssPath, 'utf-8')

            expect(cssContent).toContain('.user-card')

            // Check index file
            const indexPath = join(tempDir, 'app/client/src/components/UserCard/index.ts')
            const indexContent = await readFile(indexPath, 'utf-8')

            expect(indexContent).toContain('export { UserCard')
        })

        it('should generate form component with validation', async () => {
            const generator = new ComponentGenerator()
            const options: GeneratorOptions = {
                name: 'ContactForm',
                template: 'form',
                force: false,
                dryRun: false
            }

            await generator.generate(context, options)

            const componentPath = join(tempDir, 'app/client/src/components/ContactFormForm/ContactFormForm.tsx')
            const componentContent = await readFile(componentPath, 'utf-8')

            expect(componentContent).toContain('useState')
            expect(componentContent).toContain('validateForm')
            expect(componentContent).toContain('handleSubmit')
            expect(componentContent).toContain('onChange')
        })
    })

    describe('RouteGenerator', () => {
        it('should generate CRUD routes', async () => {
            const generator = new RouteGenerator()
            const options: GeneratorOptions = {
                name: 'user',
                template: 'crud',
                force: false,
                dryRun: false
            }

            await generator.generate(context, options)

            const routePath = join(tempDir, 'app/server/routes/user.routes.ts')
            const routeContent = await readFile(routePath, 'utf-8')

            expect(routeContent).toContain('export const userRoutes')
            expect(routeContent).toContain('.get(\'/\'')
            expect(routeContent).toContain('.get(\'/:id\'')
            expect(routeContent).toContain('.post(\'/\'')
            expect(routeContent).toContain('.put(\'/:id\'')
            expect(routeContent).toContain('.delete(\'/:id\'')
            expect(routeContent).toContain('UserController')
        })

        it('should generate auth routes', async () => {
            const generator = new RouteGenerator()
            const options: GeneratorOptions = {
                name: 'auth',
                template: 'auth',
                force: false,
                dryRun: false
            }

            await generator.generate(context, options)

            const routePath = join(tempDir, 'app/server/routes/auth.routes.ts')
            const routeContent = await readFile(routePath, 'utf-8')

            expect(routeContent).toContain('export const authRoutes')
            expect(routeContent).toContain('/register')
            expect(routeContent).toContain('/login')
            expect(routeContent).toContain('/logout')
            expect(routeContent).toContain('/me')
            expect(routeContent).toContain('authMiddleware')
        })
    })

    describe('Dry Run Mode', () => {
        it('should not create files in dry run mode', async () => {
            const generator = new ControllerGenerator()
            const options: GeneratorOptions = {
                name: 'test',
                template: 'crud',
                force: false,
                dryRun: true
            }

            await generator.generate(context, options)

            // Files should not exist
            const controllerPath = join(tempDir, 'app/server/controllers/test.controller.ts')

            try {
                await readFile(controllerPath, 'utf-8')
                expect.fail('File should not exist in dry run mode')
            } catch (error) {
                expect((error as any).code).toBe('ENOENT')
            }
        })
    })

    describe('Force Overwrite', () => {
        it('should overwrite existing files when force is true', async () => {
            const generator = new ControllerGenerator()

            // First generation
            await generator.generate(context, {
                name: 'test',
                template: 'minimal',
                force: false,
                dryRun: false
            })

            // Second generation with force
            await generator.generate(context, {
                name: 'test',
                template: 'crud',
                force: true,
                dryRun: false
            })

            const controllerPath = join(tempDir, 'app/server/controllers/test.controller.ts')
            const controllerContent = await readFile(controllerPath, 'utf-8')

            // Should contain CRUD content, not minimal
            expect(controllerContent).toContain('async getAll()')
            expect(controllerContent).not.toContain('// TODO: Implement')
        })
    })
})