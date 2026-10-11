export function importedUser(username,snapshot) {
  return snapshot?{...snapshot.profile,lastSyncAt:snapshot.syncedAt}:{id:'local-fxunifi',username,fullName:'',email:'',role:'USER',status:'LOCAL_ONLY'};
}
export function accountData(path,url,username,snapshot) {
  const user=importedUser(username,snapshot);
  const wallet=snapshot?.wallet||Object.fromEntries(['capital','totalInvested','totalProfit','totalEarned','totalWithdrawn','availableBalance'].map(key=>[key,null]));
  const team=side=>{const members=(snapshot?.members||[]).filter(member=>member.side===side);return {members,totalCount:members.length,activeCount:members.filter(member=>member.status==='ACTIVE').length,pv:members.reduce((sum,member)=>sum+(member.pv||0),0)};};
  const filtered=(snapshot?.transactions||[]).filter(row=>(!url.searchParams.get('type')||row.type===url.searchParams.get('type'))&&(!url.searchParams.get('status')||row.status===url.searchParams.get('status')));
  const page=Math.max(1,parseInt(url.searchParams.get('page'))||1),limit=Math.min(100,Math.max(1,parseInt(url.searchParams.get('limit'))||10));
  const links=snapshot?.referralLinks||{};
  const routes={
    '/auth/me':{user,wallet,referralLinks:links},
    '/dashboard':{user,wallet,referralLinks:links,stats:snapshot?.stats||{totalReferrals:0},providerMetrics:snapshot?.providerMetrics},
    '/wallet':{wallet,...(snapshot?{withdrawalHistory:snapshot.withdrawalHistory,depositHistory:snapshot.depositHistory}:{})},
    '/transactions':{transactions:filtered.slice((page-1)*limit,page*limit),pagination:{page,limit,totalPages:Math.ceil(filtered.length/limit),totalItems:filtered.length}},
    '/referrals':{leftTeam:team('left'),rightTeam:team('right'),referralLinks:links},
    '/tree':snapshot?.tree||{root:{...user,side:'root',name:'You',children:[]},stats:{totalMembers:0,activeMembers:0}},
    '/profile':{editable:user,synced:user,metadata:{role:'USER',status:user.status,lastSyncAt:snapshot?.syncedAt}},
  };
  return routes[path];
}
