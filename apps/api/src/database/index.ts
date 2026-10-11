import { PrismaClient } from '@prisma/client'
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.json(),
  defaultMeta: { service: 'tradevault-api' },
  transports: [new winston.transports.Console()],
})

let prisma: PrismaClient

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    })
  }
  return prisma
}

export async function connectDB(): Promise<PrismaClient> {
  const client = getPrismaClient()
  await client.$connect()
  logger.info('Database connected successfully')
  return client
}

export async function disconnectDB(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    logger.info('Database disconnected')
  }
}

export const db = getPrismaClient()