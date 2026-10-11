import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import winston from 'winston'
import { config } from './config'
import { connectDB, disconnectDB } from './database'
import { connectRedis, disconnectRedis } from './redis'
import { rateLimiter } from './middleware/rate-limit'
import { authRouter } from './routes/auth'
import { dashboardRouter } from './routes/dashboard'
import { profileRouter } from './routes/profile'
import { walletRouter } from './routes/wallet'
import { referralsRouter } from './routes/referrals'
import { treeRouter } from './routes/tree'
import { transactionsRouter } from './routes/transactions'
import { syncRouter } from './routes/sync'
import { adminRouter } from './routes/admin'
import { errorHandler } from './middleware/error-handler'
import { syncQueue } from './queue'
import { requestLogger } from './middleware/request-logger'

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'tradevault-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
        })
      ),
    }),
  ],
})

const app = express()
const server = createServer(app)

// Middleware
app.use(helmet())
app.use(cors({
  origin: config.appUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}))
app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(rateLimiter)
app.use(requestLogger)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/profile', profileRouter)
app.use('/api/wallet', walletRouter)
app.use('/api/referrals', referralsRouter)
app.use('/api/tree', treeRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/sync', syncRouter)
app.use('/api/admin', adminRouter)

app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }))

// Error handler
app.use(errorHandler)

async function start() {
  try {
    await connectDB()
    await connectRedis()

    server.listen(config.apiPort, () => {
      logger.info(`TradeVault API running on http://localhost:${config.apiPort}`)
    })
  } catch (error) {
    logger.error('Failed to start server', { error })
    process.exit(1)
  }
}

async function shutdown() {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(async () => {
    await syncQueue.close()
    await disconnectDB()
    await disconnectRedis()
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

start()

export { app, logger }