import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { db } from '../database'
import { AppError } from '../middleware/error-handler'
import { formatCurrency } from 'shared/utils/currency'

const router = Router()

router.use(authenticateToken)

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const decoded = (req as AuthRequest).user!

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: { wallet: true },
    })

    if (!user || !user.wallet) {
      throw new AppError('Wallet not found', 404)
    }

    res.json({
      success: true,
      data: {
        wallet: {
          availableBalance: formatCurrency(user.wallet.availableBalance),
          capital: formatCurrency(user.wallet.capital),
          totalInvested: formatCurrency(user.wallet.totalInvested),
          totalProfit: formatCurrency(user.wallet.totalProfit),
          totalEarned: formatCurrency(user.wallet.totalEarned),
          totalWithdrawn: formatCurrency(user.wallet.totalWithdrawn),
          updatedAt: user.wallet.updatedAt,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/summary', async (req: Request, res: Response, next) => {
  try {
    const decoded = (req as AuthRequest).user!

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: { wallet: true },
    })

    if (!user || !user.wallet) {
      throw new AppError('Wallet not found', 404)
    }

    const stats = [
      { label: 'Available Balance', value: formatCurrency(user.wallet.availableBalance) },
      { label: 'My Capital', value: formatCurrency(user.wallet.capital) },
      { label: 'Total Profit', value: formatCurrency(user.wallet.totalProfit) },
      { label: 'Total Earned', value: formatCurrency(user.wallet.totalEarned) },
      { label: 'Total Withdrawn', value: formatCurrency(user.wallet.totalWithdrawn) },
    ]

    res.json({
      success: true,
      data: { stats },
    })
  } catch (error) {
    next(error)
  }
})

export { router as walletRouter }