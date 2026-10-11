import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { db } from '../database'
const router = Router()
router.use(authenticateToken)
router.get('/', async (req, res, next) => {
  try {
    const auth = (req as AuthRequest).user!
    const members = await db.referralMember.findMany({ where: { ownerUserId: auth.userId }, orderBy: [{ level: 'asc' }, { syncedAt: 'asc' }, { id: 'asc' }], take: 500 })
    type Node = { id: string, username: string, name: string, status: string, side: string, pv: number, children: Node[] }
    const root: Node = { id: auth.userId, username: auth.username, name: 'You', status: 'ACTIVE', side: 'root', pv: 0, children: [] }
    const nodes = new Map<string, Node>(members.map(m => [m.externalMemberId, { id: m.id, username: m.username, name: m.name || m.username, status: m.status, side: m.side, pv: Number(m.pv), children: [] }]))
    for (const member of members) {
      const node = nodes.get(member.externalMemberId)!
      const parent = members.find(m => m.externalMemberId === member.parentExternalMemberId)
      // Only attach to a lower level to prevent malformed provider data forming cycles.
      if (parent && parent.level < member.level) nodes.get(parent.externalMemberId)!.children.push(node)
      else root.children.push(node)
    }
    res.json({ success: true, data: { root, stats: { totalMembers: members.length, activeMembers: members.filter(m => m.status === 'ACTIVE').length, inactiveMembers: members.filter(m => m.status !== 'ACTIVE').length }, truncated: members.length === 500 } })
  } catch (error) { next(error) }
})
router.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim()
    const results = query ? await db.referralMember.findMany({ where: { ownerUserId: (req as AuthRequest).user!.userId, OR: [{ username: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }] }, take: 50 }) : []
    res.json({ success: true, data: { results, total: results.length } })
  } catch (error) { next(error) }
})
export { router as treeRouter }
