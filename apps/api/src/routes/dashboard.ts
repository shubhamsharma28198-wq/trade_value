import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { db } from '../database'
import { AppError, ValidationError } from '../middleware/error-handler'
import { formatCurrency } from 'shared/utils/currency'

const router = Router()

// Apply auth middleware to all dashboard routes
router.use(authenticateToken)

router.get('/', async (req: Request, res: Response, next) => {
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
      throw new AppError('User not found', 404)
    }

    const referrals = await db.referralMember.count({
      where: { ownerUserId: user.id }
    })

    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          fullName: user.fullName,
          rank: user.rank,
          level: user.level,
          sponsorUsername: user.sponsorUsername,
          memberSince: user.memberSince,
          activeSince: user.activeSince,
          email: user.email,
          phone: user.phone,
          location: user.location,
        },
        wallet: {
          capital: formatCurrency(user.wallet?.capital || 0),
          totalInvested: formatCurrency(user.wallet?.totalInvested || 0),
          totalProfit: formatCurrency(user.wallet?.totalProfit || 0),
          totalEarned: formatCurrency(user.wallet?.totalEarned || 0),
          totalWithdrawn: formatCurrency(user.wallet?.totalWithdrawn || 0),
          availableBalance: formatCurrency(user.wallet?.availableBalance || 0),
        },
        referralLinks: {
          left: user.referralLinks.find(link => link.side === 'left')?.url,
          right: user.referralLinks.find(link => link.side === 'right')?.url,
        },
        stats: {
          totalReferrals: referrals,
          level: user.level,
          rank: user.rank,
          memberSince: user.memberSince,
        },
        marketData: null,
      },
    })
  } catch (error) {
    next(error)
  }
})

export { router as dashboardRouter }