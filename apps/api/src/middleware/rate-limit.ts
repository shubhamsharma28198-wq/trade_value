import rateLimit from 'express-rate-limit'
import { config } from '../config'
export const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs, limit: config.rateLimitMaxRequests,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' } },
})
