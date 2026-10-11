import { Queue } from 'bullmq'
import { redisConnection } from 'shared/utils/redis'
import { config } from './config'
import { db } from './database'

export const syncQueue = new Queue('fxunifi-sync', {
  connection: redisConnection(config.redisUrl, config.redisPassword),
})
syncQueue.on('error', error => console.error('Sync queue error:', error.message))

export async function enqueueSync(userId: string) {
  const pending = await db.syncRun.findFirst({ where: { userId, status: { in: ['PENDING', 'RUNNING'] } } })
  if (pending) return pending
  const run = await db.syncRun.create({ data: { userId, provider: config.mockExternalProvider ? 'MOCK' : 'FXUNIFI' } })
  try {
    await syncQueue.add('sync-user', { userId, syncRunId: run.id }, {
      jobId: run.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100, removeOnFail: 100,
    })
    return run
  } catch (error) {
    await db.syncRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Unable to queue sync' } })
    throw error
  }
}
