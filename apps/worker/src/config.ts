import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(__dirname, '../../../.env') })
export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  mockExternalProvider: process.env.MOCK_EXTERNAL_PROVIDER !== 'false',
  syncIntervalMinutes: Math.max(1, Number(process.env.FXUNIFI_SYNC_INTERVAL_MINUTES || 30)),
  logLevel: process.env.LOG_LEVEL || 'info',
}
