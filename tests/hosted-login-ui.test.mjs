import test from 'node:test';
import assert from 'node:assert/strict';

test('hosted login uses portal credentials and offers dashboard manual sync',async()=>{
  const elements=new Map(),handlers=new Map(),calls=[];
  const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(name,handler){handlers.set(key+':'+name,handler);}});return elements.get(key);};
  const keys=['document','window','location','sessionStorage','fetch','FormData'];const old=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const user={id:'local-fxunifi',username:'source_fixture',fullName:'Source Member',role:'USER',status:'ACTIVE',lastSyncAt:'2026-10-11T00:00:00Z'};
  const wallet={capital:100,totalInvested:100,totalProfit:10,totalEarned:10,totalWithdrawn:0,availableBalance:10};
  globalThis.document={body:{dataset:{portalMode:'hosted'}},querySelector(selector){if(['#content','#sidebar','.menu-button','#breadcrumb'].includes(selector)&&!element('#app').innerHTML.includes('id="content"'))return null;return element(selector);},querySelectorAll(){return[];},addEventListener(name,handler){handlers.set('document:'+name,handler);}};
  globalThis.window={addEventListener(name,handler){handlers.set('window:'+name,handler);}};globalThis.location={hash:'#login'};
  globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.FormData=class { *[Symbol.iterator](){yield['username','portal_fixture'];yield['password','test-only-portal-password'];} };
  globalThis.fetch=async(url,options)=>{
    calls.push({url,body:options.body});
    const path=url.replace('/api/local','').split('?')[0];
    if(path==='/auth/refresh')return Response.json({success:false},{status:401});
    const fixtures={
      '/auth/login':{user,accessToken:'fixture-token'},'/auth/me':{user,wallet},
      '/dashboard':{user,wallet,stats:{totalReferrals:0},referralLinks:{}},
      '/transactions':{transactions:[],pagination:{page:1,totalPages:0,totalItems:0}},
      '/referrals':{leftTeam:{members:[],pv:0},rightTeam:{members:[],pv:0},referralLinks:{}},
      '/sync/status':{status:'SUCCESS',recordsProcessed:1},
    };
    assert.ok(path in fixtures,path);return Response.json({success:true,data:fixtures[path]});
  };
  const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
  try{
    await import('../apps/web/public/app.js?hosted-login-ui');await settle();
    assert.match(element('#app').innerHTML,/private portal credentials/);
    assert.doesNotMatch(element('#app').innerHTML,/Use saved FXUNIFI credentials|Create an account/);
    const button={disabled:false};const error={textContent:''};
    const form={id:'auth-form',dataset:{register:'false'},querySelector(selector){return selector==='.form-error'?error:button;}};
    await handlers.get('#app:submit')({preventDefault(){},target:form,submitter:{dataset:{}}});await settle();
    const login=calls.find(call=>call.url==='/api/local/auth/login');
    assert.deepEqual(JSON.parse(login.body),{username:'portal_fixture',password:'test-only-portal-password'});
    assert.match(element('#content').innerHTML,/Sync now/);
    assert.match(element('#app').innerHTML,/FXUNIFI · SYNCED/);
    assert.equal(error.textContent,'');
  }finally{for(const key of keys)if(old[key]===undefined)delete globalThis[key];else globalThis[key]=old[key];}
});
