import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { db } from '../database'
import { enqueueSync } from '../queue'
import { config } from '../config'
import { SyncError } from '../middleware/error-handler'
const router = Router()
router.use(authenticateToken)
router.get('/status', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId
    const last = await db.syncRun.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
    const account = await db.externalAccount.findFirst({ where: { userId, provider: 'FXUNIFI' } })
    res.json({ success: true, data: { status: last?.status || 'NO_SYNC', lastSuccessfulSync: account?.lastSuccessfulSync,
      lastAttempt: last?.startedAt, recordsProcessed: last?.recordsProcessed || 0, errorMessage: last?.errorMessage,
      provider: config.mockExternalProvider ? 'MOCK' : 'FXUNIFI', connected: account?.status === 'ACTIVE', mock: config.mockExternalProvider } })
  } catch (error) { next(error) }
})
router.post('/fxunifi', async (req, res, next) => {
  try {
    if (!config.mockExternalProvider) throw new SyncError('Live FXUNIFI integration is not configured')
    const run = await enqueueSync((req as AuthRequest).user!.userId)
    res.status(202).json({ success: true, data: { syncRunId: run.id, status: run.status, message: 'Demo sync queued' } })
  } catch (error) { next(error) }
})
export { router as syncRouter }
