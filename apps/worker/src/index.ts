import { config } from './config'
import { Queue, Worker } from 'bullmq'
import { PrismaClient } from 'database'
import { redisConnection } from 'shared/utils/redis'
const db = new PrismaClient()
const connection = redisConnection(config.redisUrl, config.redisPassword)
const queue = new Queue('fxunifi-sync', { connection })
queue.on('error', error => console.error('Queue error:', error.message))
const worker = new Worker('fxunifi-sync', async job => {
  const { userId, syncRunId } = job.data
  try {
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || user.status !== 'ACTIVE') throw new Error('Account is not active')
    await db.syncRun.update({ where: { id: syncRunId }, data: { status: 'RUNNING', startedAt: new Date(), completedAt: null, errorMessage: null } })
    if (!config.mockExternalProvider) throw new Error('Live FXUNIFI adapter requires an authorized provider API')
    // Demo connectivity check only. Never replace real identity or financial balances with mock data.
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { lastSyncAt: new Date() } }),
      db.syncRun.update({ where: { id: syncRunId }, data: { status: 'SUCCESS', completedAt: new Date(), recordsProcessed: 0 } }),
    ])
    return { mock: true, recordsProcessed: 0 }
  } catch (error) {
    await db.syncRun.update({ where: { id: syncRunId }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: error instanceof Error ? error.message : 'Sync failed' } })
    throw error
  }
}, { connection, concurrency: 2 })
worker.on('error', error => console.error('Worker error:', error.message))
worker.on('failed', (job, error) => console.error('Sync failed:', job?.id, error.message))
worker.on('completed', job => console.log('Demo sync completed:', job.id))
async function schedule() {
  if (!config.mockExternalProvider) return
  const users = await db.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
  for (const user of users) {
    const pending = await db.syncRun.findFirst({ where: { userId: user.id, status: { in: ['PENDING', 'RUNNING'] } } })
    if (pending) continue
    const run = await db.syncRun.create({ data: { userId: user.id, provider: 'MOCK' } })
    try {
      await queue.add('sync-user', { userId: user.id, syncRunId: run.id }, { jobId: run.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 100 })
    } catch (error) {
      await db.syncRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Queue unavailable' } })
      throw error
    }
  }
}
let scheduling = false
async function tick() { if (scheduling) return; scheduling = true; try { await schedule() } catch (error) { console.error('Scheduling failed:', error) } finally { scheduling = false } }
const timer = setInterval(tick, config.syncIntervalMinutes * 60000)
async function shutdown() { clearInterval(timer); await worker.close(); await queue.close(); await db.$disconnect(); process.exit(0) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
db.$connect().then(() => { console.log('TradeVault sync worker running (mock:', config.mockExternalProvider, ')'); void tick() }).catch(error => { console.error(error); process.exit(1) })
