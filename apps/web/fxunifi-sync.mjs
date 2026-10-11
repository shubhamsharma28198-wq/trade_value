import { createFileSnapshotStore } from './snapshot-store.mjs';
import { FxunifiSession } from './fxunifi-http.mjs';
import { parseDashboard,parseProfile,parseMembers,buildTree,parseStatement,parsePayments,parseFunds } from './fxunifi-parser.mjs';

export function createFxunifiSync({ readCredentials, dataDirectory, storage = createFileSnapshotStore(dataDirectory), sessionFactory = () => new FxunifiSession() }) {
  const accounts=new Map();
  const account=username=>{if(!accounts.has(username))accounts.set(username,{ status:'NOT_CONNECTED',snapshot:null,loaded:false,task:null,client:null,errorMessage:null });return accounts.get(username);};
  async function load(username) {
    const state=account(username);
    if(!state.loaded){
      const saved=await storage.load(username);
      if(saved?.version===1 && saved.username===username && saved.wallet && saved.profile && Array.isArray(saved.members) && Array.isArray(saved.transactions)){state.snapshot=saved;if(!state.task)state.status='SUCCESS';}
      state.loaded=true;
    }
    return state;
  }
  async function perform(username,state) {
    try {
      const credentials=await readCredentials();
      if(credentials.FXUNIFI_USERNAME!==username || !credentials.FXUNIFI_PASSWORD)throw new Error('Saved FXUNIFI credentials changed. Sign out and sign in again.');
      state.client ||= sessionFactory();
      let dashboard;
      // Reuse only the connector's own authenticated session, never the user's browser cookies.
      if(state.snapshot){try{dashboard=await state.client.request('/members');parseDashboard(dashboard.text,username);}catch{dashboard=null;}}
      if(!dashboard)dashboard=await state.client.login({username,password:credentials.FXUNIFI_PASSWORD});
      const parsed=parseDashboard(dashboard.text,username);
      const profilePage=await state.client.request('/members/updateprofile');
      const profile={ ...parsed.profile,...parseProfile(profilePage.text),id:'local-fxunifi',role:'USER',status:'ACTIVE' };
      const treePage=await state.client.request('/members/tree');
      const ownerId=treePage.text.match(/data-url=["']members\/stats\/(\d+)/)?.[1];
      if(!ownerId)throw new Error('FXUNIFI account identity could not be mapped.');
      const readRows=async name=>{
        const {text}=await state.client.request('/members/json/'+name,{method:'POST',body:''});
        try{const rows=JSON.parse(text);if(!Array.isArray(rows))throw new Error();return rows;}catch{throw new Error(`FXUNIFI ${name} data could not be read. Sign in again or retry later.`);}
      };
      // Read endpoints are sequential to avoid overwhelming the original account site.
      const left=parseMembers(await readRows('lteam'),'left');
      const right=parseMembers(await readRows('rteam'),'right');
      const members=[...left,...right];
      if(new Set(members.map(member=>member.id)).size!==members.length)throw new Error('FXUNIFI returned duplicate team identities.');
      const tree=buildTree(members,profile,treePage.text);
      const levels=new Map();const visit=node=>{levels.set(node.id,node.level);for(const child of node.children)visit(child);};visit(tree.root);
      for(const member of members)member.level=levels.get(member.id)??null;
      const transactions=parseStatement(await readRows('statement'),ownerId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      const withdrawalHistory=parsePayments(await readRows('payments'));
      const funds=await state.client.request('/members/funds');
      const depositHistory=parseFunds(funds.text);
      const snapshot={ version:1,username,syncedAt:new Date().toISOString(),profile,wallet:parsed.wallet,referralLinks:parsed.referralLinks,stats:parsed.stats,providerMetrics:parsed.providerMetrics,members,tree,transactions,withdrawalHistory,depositHistory };
      // Commit the complete mapped snapshot only after every required source is read.
      await storage.save(username,snapshot);
      state.snapshot=snapshot;state.status='SUCCESS';state.errorMessage=null;
    }catch(error){state.status='FAILED';state.errorMessage=error instanceof Error?error.message:'FXUNIFI sync failed.';}
    finally{state.completedAt=new Date().toISOString();state.task=null;}
  }
  return {
    async start(username){const state=await load(username);if(!state.task){state.status='RUNNING';state.startedAt=new Date().toISOString();state.errorMessage=null;state.task=perform(username,state);}return {status:state.status,message:'FXUNIFI sync started. Your last imported data stays visible until it completes.'};},
    async snapshot(username){return (await load(username)).snapshot;},
    async status(username){const state=await load(username);return {status:state.status,provider:'FXUNIFI',mock:false,connected:Boolean(state.snapshot),canSync:true,lastAttempt:state.startedAt||state.snapshot?.syncedAt,lastSuccessfulSync:state.snapshot?.syncedAt,recordsProcessed:state.snapshot?state.snapshot.members.length+state.snapshot.transactions.length+state.snapshot.withdrawalHistory.length+state.snapshot.depositHistory.length+1:0,errorMessage:state.errorMessage,stale:state.status==='FAILED'&&Boolean(state.snapshot)};},
    async wait(username){await account(username).task;return (await load(username)).snapshot;},
  };
}
