const user = { id: 'demo', username: 'demo_user', fullName: 'Alex Morgan', email: 'demo@tradevault.com', phone: '+1 555 010 2040', location: 'New York, USA', rank: 'GOLD', level: 2, sponsorUsername: 'admin', role: 'USER', status: 'ACTIVE', memberSince: '2024-03-15', activeSince: '2024-03-15' };
const wallet = { capital: 2500, totalInvested: 3000, totalProfit: 812.76, totalEarned: 1480, totalWithdrawn: 350, availableBalance: 1130 };
const names = ['Jamie Lee', 'Sam Patel', 'Taylor Brooks', 'Jordan Smith', 'Casey Rivera', 'Morgan Chen'];
const members = names.map((name, i) => ({ id: 'member-' + i, externalMemberId: 'external-' + i, username: name.toLowerCase().replaceAll(' ', '_'), name, side: i < 3 ? 'left' : 'right', status: i === 2 ? 'INACTIVE' : 'ACTIVE', level: i % 3 + 1, pv: [320, 180, 100, 420, 240, 160][i] }));
const transactions = Array.from({ length: 27 }, (_, i) => ({ id: 'demo-tx-' + i, type: ['EARNINGS', 'COMMISSION', 'DEPOSIT', 'WITHDRAWAL', 'BONUS'][i % 5], amount: [42.50, 18.25, 500, 150, 25][i % 5], currency: 'USD', status: i === 3 ? 'PENDING' : 'COMPLETED', reference: 'TV-' + (1048 - i), description: ['Daily earnings', 'Referral commission', 'Capital deposit', 'Withdrawal request', 'Member bonus'][i % 5], createdAt: new Date(Date.UTC(2026, 8, 28 - i)).toISOString() }));
const referralLinks = { left: 'https://example.com/register?ref=demo_user&side=left', right: 'https://example.com/register?ref=demo_user&side=right' };

export function createDemo() {
  const profile = { ...user };
  let synced = false;
  return async (path, { body } = {}) => {
    const [route, query] = path.split('?');
    const params = new URLSearchParams(query);
    if (route === '/auth/me') return { user: profile, wallet, referralLinks };
    if (route === '/dashboard') return { user: profile, wallet, referralLinks, stats: { totalReferrals: members.length }, marketData: null };
    if (route === '/wallet') return { wallet };
    if (route === '/profile') {
      if (body) { Object.assign(profile, body); return profile; }
      return { editable: profile, synced: profile, metadata: { role: profile.role, status: profile.status } };
    }
    if (route === '/transactions') {
      const filtered = transactions.filter(t => (!params.get('type') || t.type === params.get('type')) && (!params.get('status') || t.status === params.get('status')));
      const page = Number(params.get('page') || 1), limit = Number(params.get('limit') || 10);
      return { transactions: filtered.slice((page - 1) * limit, page * limit), pagination: { page, totalPages: Math.ceil(filtered.length / limit), totalItems: filtered.length } };
    }
    if (route === '/referrals') {
      const team = side => { const list = members.filter(m => m.side === side); return { members: list, totalCount: list.length, activeCount: list.filter(m => m.status === 'ACTIVE').length, pv: list.reduce((sum, m) => sum + m.pv, 0) }; };
      return { leftTeam: team('left'), rightTeam: team('right'), referralLinks };
    }
    if (route === '/tree') return { root: { id: 'demo', username: profile.username, name: 'You', status: 'ACTIVE', side: 'root', children: [0, 3].map(i => ({ ...members[i], children: members.slice(i + 1, i + 3).map(m => ({ ...m, children: [] })) })) }, stats: { totalMembers: 6, activeMembers: 5, inactiveMembers: 1 } };
    if (route === '/sync/status') return { status: synced ? 'SUCCESS' : 'NO_SYNC', provider: 'MOCK', mock: true, recordsProcessed: 0, lastAttempt: synced ? new Date().toISOString() : null };
    if (route === '/sync/fxunifi') { synced = true; return { status: 'SUCCESS', message: 'Demo sync completed' }; }
    if (route === '/auth/logout') return null;
    throw new Error('This feature needs a connected account.');
  };
}
