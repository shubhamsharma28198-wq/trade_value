import { Request, Response, NextFunction } from 'express'
import winston from 'winston'
import { ZodError } from 'zod'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.json(),
  defaultMeta: { service: 'tradevault-api' },
  transports: [new winston.transports.Console()],
})

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error(err.message, { stack: err.stack, path: req.path })

  const databaseCode = (err as Error & { code?: string }).code
  const databaseError = databaseCode === 'P2002' ? { status: 409, code: 'CONFLICT', message: 'This username or email is already registered.' }
    : databaseCode === 'P2025' ? { status: 404, code: 'NOT_FOUND', message: 'The requested record was not found.' }
    : databaseCode === 'P2034' ? { status: 409, code: 'CONFLICT', message: 'Another request updated this record. Please try again.' } : null
  const status = err instanceof ZodError ? 400 : err instanceof AppError ? err.statusCode : databaseError?.status || 500
  res.status(status).json({
    success: false,
    error: {
      code: err instanceof ZodError ? 'VALIDATION_ERROR' : err instanceof AppError ? err.code : databaseError?.code || 'INTERNAL_ERROR',
      message: err instanceof ZodError ? err.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
        : databaseError?.message || (status === 500 ? 'An unexpected error occurred' : err.message),
    },
  })
}

export class AppError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class SyncError extends AppError {
  constructor(message: string = 'Sync failed') {
    super(message, 503, 'SYNC_ERROR')
  }
}
