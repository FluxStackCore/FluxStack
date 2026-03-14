/**
 * API and HTTP-related types
 * Type definitions for API endpoints, requests, responses, and HTTP utilities
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'

export interface ApiEndpoint {
  method: HttpMethod
  path: string
  handler: Function
  schema?: ApiSchema
  middleware?: Function[]
  description?: string
  tags?: string[]
  deprecated?: boolean
  version?: string
}

export interface ApiSchema {
  params?: unknown
  query?: unknown
  body?: unknown
  response?: unknown
  headers?: unknown
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
  statusCode: number
  timestamp: string
}

export interface ApiMeta {
  pagination?: PaginationMeta
  timing?: TimingMeta
  version?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface TimingMeta {
  requestId: string
  duration: number
  timestamp: string
}

export interface RequestContext {
  id: string
  method: HttpMethod
  path: string
  url: string
  headers: Record<string, string>
  query: Record<string, string>
  params: Record<string, string>
  body?: unknown
  user?: unknown
  startTime: number
}

export interface ResponseContext extends RequestContext {
  statusCode: number
  headers: Record<string, string>
  body?: unknown
  duration: number
  size: number
}

export interface MiddlewareContext {
  request: RequestContext
  response?: ResponseContext
  next: () => Promise<void>
  state: Record<string, unknown>
}

export interface RouteHandler {
  (context: RequestContext): Promise<unknown> | unknown
}

export interface MiddlewareHandler {
  (context: MiddlewareContext): Promise<void> | void
}

export interface ApiDocumentation {
  title: string
  version: string
  description?: string
  servers: ApiServer[]
  paths: Record<string, ApiPath>
  components?: ApiComponents
}

export interface ApiServer {
  url: string
  description?: string
  variables?: Record<string, ApiServerVariable>
}

export interface ApiServerVariable {
  default: string
  description?: string
  enum?: string[]
}

export interface ApiPath {
  [method: string]: ApiOperation
}

export interface ApiOperation {
  summary?: string
  description?: string
  operationId?: string
  tags?: string[]
  parameters?: ApiParameter[]
  requestBody?: ApiRequestBody
  responses: Record<string, ApiResponse>
  deprecated?: boolean
}

export interface ApiParameter {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  description?: string
  required?: boolean
  schema: unknown
}

export interface ApiRequestBody {
  description?: string
  content: Record<string, ApiMediaType>
  required?: boolean
}

export interface ApiMediaType {
  schema: unknown
  example?: unknown
  examples?: Record<string, ApiExample>
}

export interface ApiExample {
  summary?: string
  description?: string
  value: unknown
}

export interface ApiComponents {
  schemas?: Record<string, Record<string, unknown>>
  responses?: Record<string, ApiResponse>
  parameters?: Record<string, ApiParameter>
  examples?: Record<string, ApiExample>
  requestBodies?: Record<string, ApiRequestBody>
  headers?: Record<string, Record<string, unknown>>
  securitySchemes?: Record<string, Record<string, unknown>>
}