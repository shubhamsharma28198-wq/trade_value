import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
import type { SignOptions } from 'jsonwebtoken'

loadEnv({ path: resolve(__dirname, '../../../../.env') })
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET.startsWith('change-') || process.env.JWT_REFRESH_SECRET.startsWith('change-'))) {
  throw new Error('Set strong JWT_SECRET and JWT_REFRESH_SECRET values before starting in production')
}
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPort: parseInt(process.env.API_PORT || '4000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:4000',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
  jwtRefreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],

  // FXUNIFI
  fxunifiBaseUrl: process.env.FXUNIFI_BASE_URL || 'https://fxunifi.com',
  fxunifiUsername: process.env.FXUNIFI_USERNAME || '',
  fxunifiPassword: process.env.FXUNIFI_PASSWORD || '',
  fxunifiSyncIntervalMinutes: parseInt(process.env.FXUNIFI_SYNC_INTERVAL_MINUTES || '30', 10),

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Mock provider
  mockExternalProvider: process.env.MOCK_EXTERNAL_PROVIDER !== 'false',

  // Sync
  syncIntervalMinutes: parseInt(process.env.FXUNIFI_SYNC_INTERVAL_MINUTES || '30', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
} as const
