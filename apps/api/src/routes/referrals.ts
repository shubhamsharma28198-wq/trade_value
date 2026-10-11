import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { db } from '../database'
const router = Router()
router.use(authenticateToken)
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId
    const [members, links] = await Promise.all([db.referralMember.findMany({ where: { ownerUserId: userId }, orderBy: { level: 'asc' } }), db.referralLink.findMany({ where: { userId } })])
    const team = (side: string) => { const list = members.filter(m => m.side === side); return { members: list, totalCount: list.length, activeCount: list.filter(m => m.status === 'ACTIVE').length, pv: list.reduce((sum, m) => sum + Number(m.pv), 0) } }
    res.json({ success: true, data: { leftTeam: team('left'), rightTeam: team('right'), referralLinks: { left: links.find(l => l.side === 'left')?.url, right: links.find(l => l.side === 'right')?.url } } })
  } catch (error) { next(error) }
})
router.get('/team', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const all = await db.referralMember.findMany({ where: { ownerUserId: userId }, orderBy: { level: 'asc' } })
    const pv = (side: string) => all.filter(m => m.side === side).reduce((sum, m) => sum + Number(m.pv), 0)
    res.json({ success: true, data: { members: all.slice((page-1)*limit, page*limit), stats: { totalMembers: all.length, activeMembers: all.filter(m => m.status === 'ACTIVE').length, leftTeamCount: all.filter(m => m.side === 'left').length, rightTeamCount: all.filter(m => m.side === 'right').length, leftPv: pv('left'), rightPv: pv('right'), totalPv: pv('left')+pv('right') }, pagination: { page, limit, totalPages: Math.ceil(all.length/limit), totalItems: all.length } } })
  } catch (error) { next(error) }
})
export { router as referralsRouter }
