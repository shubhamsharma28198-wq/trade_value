import { Router, Request, Response } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { db } from '../database'
import { AppError } from '../middleware/error-handler'
import { z } from 'zod'

const router = Router()

router.use(authenticateToken)

const updateProfileSchema = z.object({
  fullName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  location: z.string().trim().max(100).optional(),
}).strict().refine(data => Object.keys(data).length > 0, 'Provide at least one profile field')

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const decoded = (req as AuthRequest).user!

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        location: true,
        rank: true,
        level: true,
        sponsorUsername: true,
        memberSince: true,
        activeSince: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastSyncAt: true,
      },
    })

    if (!user) {
      throw new AppError('User not found', 404)
    }

    res.json({
      success: true,
      data: {
        synced: {
          username: user.username,
          email: user.email,
          rank: user.rank,
          sponsorUsername: user.sponsorUsername,
          memberSince: user.memberSince,
          activeSince: user.activeSince,
        },
        editable: {
          fullName: user.fullName,
          phone: user.phone,
          location: user.location,
        },
        metadata: {
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastSyncAt: user.lastSyncAt,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.put('/', async (req: Request, res: Response, next) => {
  try {
    const decoded = (req as AuthRequest).user!

    const data = updateProfileSchema.parse(req.body)

    const user = await db.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id: decoded.userId },
      data: data,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        location: true,
        updatedAt: true,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: updated.id,
        action: 'PROFILE_UPDATE',
        ipAddress: req.ip || undefined,
        userAgent: req.get('user-agent') || undefined,
        metadata: {
          updatedFields: Object.keys(data),
        },
      },
    })
    return updated
    })

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    next(error)
  }
})

export { router as profileRouter }
