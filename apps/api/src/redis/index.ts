import { createClient, RedisClientType } from 'redis'
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.json(),
  defaultMeta: { service: 'tradevault-api' },
  transports: [new winston.transports.Console()],
})

let redisClient: RedisClientType

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
    }) as RedisClientType

    redisClient.on('error', (err: Error) => {
      logger.error('Redis error', { error: err.message })
    })

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully')
    })
  }
  return redisClient
}

export async function connectRedis(): Promise<RedisClientType> {
  const client = getRedisClient()
  await client.connect()
  return client
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    logger.info('Redis disconnected')
  }
}

export const redis = getRedisClient()