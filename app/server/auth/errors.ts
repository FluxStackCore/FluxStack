/**
 * FluxStack Auth - Custom Error Classes
 *
 * Typed errors for better error handling in auth routes.
 * Replaces generic catch blocks with classified errors.
 */

/**
 * Validation error (422) - invalid input, duplicate email, etc.
 */
export class AuthValidationError extends Error {
  readonly name = 'AuthValidationError' as const
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.field = field
  }
}

/**
 * Server error (500) - provider failure, unexpected internal error.
 */
export class AuthServerError extends Error {
  readonly name = 'AuthServerError' as const

  constructor(message: string) {
    super(message)
  }
}

/**
 * Authentication failed (401) - invalid credentials.
 */
export class AuthenticationError extends Error {
  readonly name = 'AuthenticationError' as const

  constructor(message: string = 'Invalid credentials') {
    super(message)
  }
}

/**
 * Classify an unknown error into a typed auth error.
 */
export function classifyAuthError(error: unknown): {
  status: number
  error: string
  message: string
} {
  if (error instanceof AuthValidationError) {
    return {
      status: 422,
      error: 'ValidationError',
      message: error.message,
    }
  }

  if (error instanceof AuthenticationError) {
    return {
      status: 401,
      error: 'AuthenticationFailed',
      message: error.message,
    }
  }

  if (error instanceof AuthServerError) {
    return {
      status: 500,
      error: 'ServerError',
      message: error.message,
    }
  }

  // Generic/unknown errors - don't leak internals in production
  const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
  return {
    status: 500,
    error: 'InternalError',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : msg,
  }
}
