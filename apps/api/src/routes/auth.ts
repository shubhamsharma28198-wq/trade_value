import { issueSession, revokeSession } from '../sessions'
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../database'
import { config } from '../config'
import { verifyPassword, authenticateToken, AuthRequest } from '../middleware/auth'
import { UnauthorizedError, ValidationError, AppError } from '../middleware/error-handler'

const router = Router()

const registerSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Use letters, numbers, underscores or hyphens'),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes'),
  fullName: z.string().trim().max(100).optional(),
  referralUsername: z.string().max(50).optional(),
  side: z.enum(['left', 'right']).optional(),
})

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: registerSchema.shape.password,
}).strict().refine(data => data.currentPassword !== data.newPassword, 'Choose a different new password')

router.post('/password', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const data = changePasswordSchema.parse(req.body)
    const auth = (req as AuthRequest).user!
    const user = await db.user.findUnique({ where: { id: auth.userId } })
    if (!user || !await verifyPassword(data.currentPassword, user.passwordHash)) {
      throw new ValidationError('Current password is incorrect')
    }
    const passwordHash = await bcrypt.hash(data.newPassword, 12)
    await db.$transaction(async tx => {
      // Reject concurrent password changes after verification of an older hash.
      const changed = await tx.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash, status: 'ACTIVE' },
        data: { passwordHash },
      })
      if (changed.count !== 1) throw new ValidationError('Your account changed. Sign in again and retry.')
      await tx.session.deleteMany({ where: { userId: user.id } })
      await tx.auditLog.create({ data: {
        userId: user.id, action: 'PASSWORD_CHANGE',
        ipAddress: req.ip || undefined, userAgent: req.get('user-agent') || undefined,
      } })
    })
    await revokeSession(undefined, res)
    res.json({ success: true, data: { message: 'Password changed. Sign in again with your new password.' } })
  } catch (error) { next(error) }
})

router.post('/register', async (req: Request, res: Response, next) => {
  try {
    const data = registerSchema.parse(req.body)

    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    })

    if (existingUser) {
      throw new ValidationError('Username or email already exists')
    }

    const hashedPassword = await bcrypt.hash(data.password, 12)

    const user = await db.$transaction(async tx => {
    const sponsor = data.referralUsername ? await tx.user.findUnique({ where: { username: data.referralUsername } }) : null
    if (data.referralUsername && (!sponsor || sponsor.status !== 'ACTIVE' || !data.side)) throw new ValidationError('This referral link is not valid')
    const created = await tx.user.create({
      data: {
        username: data.username,
        email: data.email,
        wallet: { create: {} },
        passwordHash: hashedPassword,
        fullName: data.fullName,
        sponsorUsername: sponsor?.username,
        referralLinks: { create: ['left', 'right'].map(side => ({ side, url: `${config.appUrl}/?ref=${encodeURIComponent(data.username)}&side=${side}#register` })) },
        status: 'ACTIVE',
        role: 'USER',
        level: 0,
        memberSince: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })
    if (sponsor) {
      const team = await tx.referralMember.findMany({ where: { ownerUserId: sponsor.id, side: data.side }, orderBy: [{ level: 'asc' }, { syncedAt: 'asc' }] })
      const parent = team.length ? team.find(member => team.filter(child => child.parentExternalMemberId === member.externalMemberId).length < 2) : null
      await tx.referralMember.create({ data: { ownerUserId: sponsor.id, externalMemberId: created.id, username: created.username, name: created.fullName, side: data.side!, parentExternalMemberId: parent?.externalMemberId, level: parent ? parent.level + 1 : 1, status: 'ACTIVE' } })
    }
    return created
    }, { isolationLevel: 'Serializable' })


    const accessToken = await issueSession(user, res)
    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const data = loginSchema.parse(req.body)

    const user = await db.user.findUnique({
      where: { username: data.username },
    })

    if (!user) {
      throw new UnauthorizedError('Invalid credentials')
    }

    const isPasswordValid = await verifyPassword(data.password, user.passwordHash)

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials')
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active')
    }

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        ipAddress: req.ip || undefined,
        userAgent: req.get('user-agent') || undefined,
      },
    })

    const accessToken = await issueSession(user, res)

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
        },
        accessToken,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', async (req: Request, res: Response, next) => {
  try {
    await revokeSession(req.cookies.refreshToken, res)

    res.json({ success: true, data: null })
  } catch (error) {
    next(error)
  }
})

router.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const data = refreshTokenSchema.parse({ refreshToken: req.cookies.refreshToken || req.body.refreshToken })

    const decoded = jwt.verify(data.refreshToken, config.jwtRefreshSecret) as jwt.JwtPayload

    if (typeof decoded.userId !== 'string') throw new UnauthorizedError('Invalid token')
    const user = await db.user.findUnique({ where: { id: decoded.userId } })
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError('Account is not active')
    const accessToken = await issueSession(user, res, data.refreshToken)

    res.json({
      success: true,
      data: { accessToken },
    })
  } catch (error) {
    next(new UnauthorizedError('Invalid refresh token'))
  }
})

router.get('/me', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const decoded = (req as AuthRequest).user!

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: {
        wallet: true,
        referralLinks: true,
      },
    })

    if (!user) {
      throw new UnauthorizedError('User not found')
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          location: user.location,
          rank: user.rank,
          level: user.level,
          sponsorUsername: user.sponsorUsername,
          memberSince: user.memberSince,
          activeSince: user.activeSince,
          role: user.role,
          status: user.status,
          lastSyncAt: user.lastSyncAt,
        },
        wallet: user.wallet,
        referralLinks: user.referralLinks,
      },
    })
  } catch (error) {
    next(error)
  }
})

export { router as authRouter }
