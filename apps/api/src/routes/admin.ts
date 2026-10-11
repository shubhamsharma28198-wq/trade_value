import { enqueueSync } from '../queue'
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth'
import { db } from '../database'
import { AppError } from '../middleware/error-handler'
import { z } from 'zod'

const router = Router()

router.use(authenticateToken)
router.use(requireRole('ADMIN'))

router.get('/dashboard', async (req: Request, res: Response, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      pendingWithdrawals,
      pendingDeposits,
      failedSyncJobs,
      successfulSyncJobs,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: 'ACTIVE' } }),
      db.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
      db.transaction.count({ where: { type: 'DEPOSIT', status: 'PENDING' } }),
      db.syncRun.count({ where: { status: 'FAILED' } }),
      db.syncRun.count({ where: { status: 'SUCCESS' } }),
    ])

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        pendingWithdrawals,
        pendingDeposits,
        failedSyncJobs,
        successfulSyncJobs,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/users', async (req: Request, res: Response, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const search = req.query.search as string
    const status = req.query.status as string

    const where: any = {}
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) where.status = status

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: true,
          _count: {
            select: { externalAccounts: true, syncRuns: true },
          },
        },
      }),
      db.user.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        users: users.map(({ passwordHash, ...user }) => user),
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/users/:id', async (req: Request, res: Response, next) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.params.id },
      include: {
        wallet: true,
        externalAccounts: { select: { id: true, provider: true, externalUsername: true, status: true, lastSuccessfulSync: true, lastFailedSync: true, createdAt: true, updatedAt: true } },
        syncRuns: { orderBy: { createdAt: 'desc' }, take: 10 },
        referralLinks: true,
      },
    })

    if (!user) {
      throw new AppError('User not found', 404)
    }

    res.json({
      success: true,
      data: (({ passwordHash, ...safe }) => safe)(user),
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/users/:id/status', async (req: Request, res: Response, next) => {
  try {
    if (req.params.id === (req as AuthRequest).user!.userId) throw new AppError('You cannot change your own account status', 400)
    const { status } = req.body
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      throw new AppError('Invalid status', 400)
    }

    const user = await db.user.update({
      where: { id: req.params.id },
      data: { status },
    })

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'STATUS_CHANGE',
        metadata: { newStatus: status },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    })

    res.json({ success: true, data: (({ passwordHash, ...safe }) => safe)(user) })
  } catch (error) {
    next(error)
  }
})

router.get('/transactions', async (req: Request, res: Response, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const status = req.query.status as string
    const type = req.query.type as string

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true, email: true } } },
      }),
      db.transaction.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        transactions,
        pagination: { page, limit, totalPages: Math.ceil(total / limit), totalItems: total },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/sync-jobs', async (req: Request, res: Response, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const status = req.query.status as string

    const where: any = {}
    if (status) where.status = status

    const [syncRuns, total] = await Promise.all([
      db.syncRun.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true, email: true } } },
      }),
      db.syncRun.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        syncRuns,
        pagination: { page, limit, totalPages: Math.ceil(total / limit), totalItems: total },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/sync-jobs/:id/retry', async (req: Request, res: Response, next) => {
  try {
    const syncRun = await db.syncRun.findUnique({
      where: { id: req.params.id },
    })

    if (!syncRun) {
      throw new AppError('Sync run not found', 404)
    }

    const run = await enqueueSync(syncRun.userId)
    res.status(202).json({ success: true, data: { syncRunId: run.id, message: 'Sync job queued for retry' } })
  } catch (error) {
    next(error)
  }
})

router.get('/audit-logs', async (req: Request, res: Response, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
    const userId = req.query.userId as string
    const action = req.query.action as string

    const where: any = {}
    if (userId) where.userId = userId
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true, email: true } } },
      }),
      db.auditLog.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        logs,
        pagination: { page, limit, totalPages: Math.ceil(total / limit), totalItems: total },
      },
    })
  } catch (error) {
    next(error)
  }
})

export { router as adminRouter }
