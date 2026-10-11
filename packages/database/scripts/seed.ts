import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const db = new PrismaClient()
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is for development only')
  const passwordHash = await bcrypt.hash('password123', 12)
  const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'admin1234', 12)
  const users = [
    { username: 'admin', email: 'admin@tradevault.com', fullName: 'Admin User', role: 'ADMIN', rank: 'ADMIN', passwordHash: adminHash },
    { username: 'demo_user', email: 'demo@tradevault.com', fullName: 'Alex Morgan', role: 'USER', rank: 'GOLD', passwordHash },
    { username: 'trader_john', email: 'john@tradevault.com', fullName: 'John Trader', role: 'USER', rank: 'SILVER', passwordHash },
  ]
  for (const info of users) {
    const user = await db.user.upsert({ where: { username: info.username }, update: {}, create: { ...info, status: 'ACTIVE', memberSince: new Date('2024-03-15'), activeSince: new Date('2024-03-15') } })
    const demo = info.username === 'demo_user'
    await db.wallet.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, capital: demo ? 2500 : 0, totalInvested: demo ? 3000 : 0, totalProfit: demo ? 812.76 : 0, totalEarned: demo ? 1480 : 0, totalWithdrawn: demo ? 350 : 0, availableBalance: demo ? 1130 : 0 } })
    const base = process.env.APP_URL || 'http://localhost:3000'
    for (const side of ['left', 'right']) {
      const existing = await db.referralLink.findFirst({ where: { userId: user.id, side } })
      if (!existing) await db.referralLink.create({ data: { userId: user.id, side, url: base + '/?ref=' + encodeURIComponent(user.username) + '&side=' + side + '#register' } })
    }
    if (demo) {
      const names = ['Jamie Lee', 'Sam Patel', 'Taylor Brooks', 'Jordan Smith', 'Casey Rivera', 'Morgan Chen']
      for (let i = 0; i < names.length; i++) {
        const externalMemberId = 'seed-member-' + i
        await db.referralMember.upsert({ where: { ownerUserId_externalMemberId: { ownerUserId: user.id, externalMemberId } }, update: {}, create: { ownerUserId: user.id, externalMemberId, username: names[i].toLowerCase().replaceAll(' ', '_'), name: names[i], side: i < 3 ? 'left' : 'right', parentExternalMemberId: [1,2].includes(i) ? 'seed-member-0' : i > 3 ? 'seed-member-3' : null, status: i === 2 ? 'INACTIVE' : 'ACTIVE', level: [0,3].includes(i) ? 1 : 2, pv: [320,180,100,420,240,160][i] } })
      }
      for (let i = 0; i < 27; i++) {
        const id = 'seed-transaction-' + user.id + '-' + i
        await db.transaction.upsert({ where: { id }, update: {}, create: { id, userId: user.id, type: ['EARNINGS','COMMISSION','DEPOSIT','WITHDRAWAL','BONUS'][i%5], amount: [42.5,18.25,500,150,25][i%5], status: i === 3 ? 'PENDING' : 'COMPLETED', reference: 'DEMO-' + (1048-i), description: ['Demo earnings','Demo commission','Demo deposit','Demo withdrawal','Demo bonus'][i%5], createdAt: new Date(Date.UTC(2026,8,28-i)) } })
      }
    }
  }
  console.log('Development accounts ready: demo_user / password123; admin / configured SEED_ADMIN_PASSWORD (default admin1234). All financial records are sample data.')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
