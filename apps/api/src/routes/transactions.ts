import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { db } from '../database'
import { AppError } from '../middleware/error-handler'
import { z } from 'zod'
import { formatCurrency } from 'shared/utils/currency'

const router = Router()

router.use(authenticateToken)

const transactionTypeSchema = z.enum(['DEPOSIT', 'WITHDRAWAL', 'COMMISSION', 'EARNINGS', 'BONUS'])
const transactionStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'])

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const decoded = (req as AuthRequest).user!

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const type = req.query.type as string
    const status = req.query.status as string

    const where: any = { userId: decoded.userId }
    if (type) where.type = transactionTypeSchema.parse(type)
    if (status) where.status = transactionStatusSchema.parse(status)

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.transaction.count({ where }),
    ])

    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: formatCurrency(tx.amount),
      currency: tx.currency,
      status: tx.status,
      reference: tx.reference || '-',
      description: tx.description || '-',
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    }))

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
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

router.get('/summary', async (req: Request, res: Response, next) => {
  try {
    const decoded = (req as AuthRequest).user!

    const transactions = await db.transaction.findMany({
      where: { userId: decoded.userId },
    })

    const summary = {
      totalDeposits: transactions
        .filter(t => t.type === 'DEPOSIT' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.amount), 0),
      totalWithdrawals: transactions
        .filter(t => t.type === 'WITHDRAWAL' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.amount), 0),
      totalCommissions: transactions
        .filter(t => t.type === 'COMMISSION' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.amount), 0),
      totalEarnings: transactions
        .filter(t => t.type === 'EARNINGS' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.amount), 0),
      totalBonuses: transactions
        .filter(t => t.type === 'BONUS' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.amount), 0),
      pendingTransactions: transactions.filter(t => t.status === 'PENDING').length,
    }

    res.json({
      success: true,
      data: {
        deposits: formatCurrency(summary.totalDeposits),
        withdrawals: formatCurrency(summary.totalWithdrawals),
        commissions: formatCurrency(summary.totalCommissions),
        earnings: formatCurrency(summary.totalEarnings),
        bonuses: formatCurrency(summary.totalBonuses),
        pending: summary.pendingTransactions,
      },
    })
  } catch (error) {
    next(error)
  }
})

export { router as transactionsRouter }