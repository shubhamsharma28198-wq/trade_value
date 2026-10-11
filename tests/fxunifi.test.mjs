import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,sep } from 'node:path';
import { FxunifiSession } from '../apps/web/fxunifi-http.mjs';
import { parseDashboard,parseStatement,parseMembers,buildTree } from '../apps/web/fxunifi-parser.mjs';
import { createFxunifiSync } from '../apps/web/fxunifi-sync.mjs';

// Synthetic source fixtures; no personal data or real credentials are committed.
const dashboard = `<div class="card-title"><h6>Welcome back!</h6><p>Test Member</p></div>
<div class="info-content"><span>remote_test</span></div><div><span>Rank</span><h7>GOLD</h7></div>
<p><span><i class="ri-mail-line"></i></span>test@example.invalid</p>
<div><span>Member Since</span><h6>2026-01-01</h6></div><div><span>Active Since</span><h6>2026-01-02</h6></div>
<div><span>Sponsor</span><h6>sponsor_test</h6></div><div><span>Level Opened</span><h6>2</h6></div>
<div class="card"><div><h3>$100</h3><p>My Capital</p></div><div><span>Total Invested</span><h6>$150</h6></div></div>
<div class="card"><div><h3>$25</h3><p>Total Profit</p></div><div><span>Total Earned</span><h6>$80</h6></div><div><span>Withdrawn</span><h6>$20</h6></div></div>
<div><h5>$25</h5><span>Earning Balance</span></div><div><p>Total Referrals</p><h4>1 <span>(out of 2)</span></h4></div>
<div><p>Total Team</p><h4>1 <span>(out of 1)</span></h4></div>
<input name="leftlink" value="https://fxunifi.com/members/signup/remote_test/1"><input name="rightlink" value="https://fxunifi.com/members/signup/remote_test/2">`;

test('FXUNIFI dashboard maps source balances and rejects wrong identity or changed layout', () => {
  const result=parseDashboard(dashboard,'remote_test');
  assert.equal(result.profile.fullName,'Test Member');
  assert.equal(result.profile.email,'test@example.invalid');
  assert.deepEqual(result.wallet,{capital:100,totalInvested:150,totalProfit:25,totalEarned:80,availableBalance:25,totalWithdrawn:20});
  assert.equal(result.stats.totalReferrals,2);
  assert.throws(()=>parseDashboard(dashboard,'different_account'),/does not match/);
  assert.throws(()=>parseDashboard(dashboard.replace('Total Earned','Changed Label'),'remote_test'),/layout changed/);
});

test('account statements preserve gross debits and net credits without mislabeling all debits as withdrawals', () => {
  const rows=[{ p_from:'77',m_id:'0',p_amount:'10',p_amt:'9.5',p_status:'1',p_date:'2026-10-01',reference:'Wallet transfer' },
    { p_from:'0',m_id:'77',p_amount:'10',p_amt:'9.5',p_status:'1',p_date:'2026-10-02',reference:'Profit Sharing' }];
  const result=parseStatement(rows,'77');
  assert.deepEqual(result.map(row=>[row.type,row.amount]),[['DEBIT',10],['EARNINGS',9.5]]);
  assert.throws(()=>parseStatement([{...rows[0],p_amount:'unknown'}],'77'),/Invalid/);
});

test('imported team hierarchy uses source upline identities and contains no cycles', () => {
  const members=parseMembers([{ id:'1',user_id:'left_test',user_name:'Left Test',uplineid:'remote_test',user_plan:'2',user_bv:'1' }],'left');
  const tree=buildTree(members,{username:'remote_test'});
  assert.equal(tree.root.children[0].username,'left_test');
  assert.equal(tree.root.children[0].level,1);
  assert.equal(tree.truncated,false);
  members[0].parentUsername='left_test';
  assert.equal(buildTree(members,{username:'remote_test'}).detached,1);
});

test('FXUNIFI form authentication carries cookies but refuses external redirects', async () => {
  const calls=[];
  const session=new FxunifiSession({ fetchImpl:async (url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/members/signin'))return new Response('<form id="loginform"></form>',{headers:{'Set-Cookie':'PHPSESSID=fixture; Path=/; HttpOnly'}});
    if(url.endsWith('/api'))return Response.json({status:1,redirect:'members'});
    return new Response(dashboard);
  }});
  await session.login({username:'remote_test',password:'fixture-only'});
  assert.equal(calls[1].options.headers.Cookie,'PHPSESSID=fixture');
  assert.equal(new URLSearchParams(calls[1].options.body).get('module'),'signin');
  assert.equal(calls.every(call=>new URL(call.url).origin==='https://fxunifi.com'),true);
  await assert.rejects(session.request('https://untrusted.example/'),/outside/);
  const malicious=new FxunifiSession({fetchImpl:async url=>url.endsWith('/api')?Response.json({status:1,redirect:'https://untrusted.example/'}):new Response('signin')});
  await assert.rejects(malicious.login({username:'fixture',password:'fixture-only'}),/unexpected destination/);
});

test('sync commits complete snapshots, coalesces concurrent runs, and keeps previous data after failure', async () => {
  const directory=await mkdtemp(resolve(tmpdir(),'tradevault-sync-'));
  let fail=false,logins=0;
  const rows={lteam:[{id:'1',user_id:'left_test',user_name:'Left Test',uplineid:'remote_test',user_plan:'2',user_bv:'1'}],rteam:[],statement:[{p_from:'0',m_id:'77',p_amount:'10',p_amt:'10',p_status:'1',p_date:'2026-10-01',reference:'Profit Sharing'}],payments:[{p_id:'1',p_amount:'4',p_date:'2026-10-02',p_status:'1',p_txnid:'test-txn',p_bank:'DO_NOT_IMPORT',p_acno:'DO_NOT_IMPORT'}]};
  const client={
    async login(){logins++;if(fail)throw Error('Fixture unavailable');return {text:dashboard};},
    async request(path){
      if(fail)throw Error('Fixture unavailable');
      if(path==='/members')return {text:dashboard};
      if(path==='/members/updateprofile')return {text:'<input name="name" value="Test Member"><input name="email" value="test@example.invalid">'};
      if(path==='/members/tree')return {text:'<a data-url="members/stats/77"><img alt="remote_test"></a>'};
      if(path==='/members/funds')return {text:'<table><tr><th>Contract No.</th></tr><tr><td>1</td><td>contract-test</td><td>2026-01-01</td><td>Trading</td><td>$100</td><td>Active</td></tr></table>'};
      return {text:JSON.stringify(rows[path.split('/').at(-1)])};
    },
  };
  try {
    const sync=createFxunifiSync({dataDirectory:directory,readCredentials:async()=>({FXUNIFI_USERNAME:'remote_test',FXUNIFI_PASSWORD:'fixture-only'}),sessionFactory:()=>client});
    await Promise.all([sync.start('remote_test'),sync.start('remote_test')]);
    const first=await sync.wait('remote_test');
    assert.equal(logins,1);assert.equal(first.members.length,1);assert.equal(first.transactions.length,1);
    assert.equal(JSON.stringify(first).includes('DO_NOT_IMPORT'),false);
    assert.equal(JSON.stringify(first).includes('fixture-only'),false);
    assert.equal((await sync.status('remote_test')).status,'SUCCESS');
    fail=true;await sync.start('remote_test');await sync.wait('remote_test');
    const status=await sync.status('remote_test');
    assert.equal(status.status,'FAILED');assert.equal(status.stale,true);
    assert.equal((await sync.snapshot('remote_test')).syncedAt,first.syncedAt);
  } finally {
    assert.ok(directory.startsWith(resolve(tmpdir())+sep));
    await rm(directory,{recursive:true,force:true});
  }
});
