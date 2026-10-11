import test from 'node:test';
import assert from 'node:assert/strict';

test('imported FXUNIFI workspace renders every page through authenticated local routes', async () => {
  const elements=new Map(),handlers=new Map(),calls=[];
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(name,handler){handlers.set(selector+':'+name,handler);}});return elements.get(selector);};
  const keys=['document','window','location','sessionStorage','fetch'];
  const original=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const user={id:'local-fxunifi',username:'fixture_import',fullName:'Imported Member',email:'test@example.invalid',role:'USER',status:'ACTIVE',lastSyncAt:'2026-10-11T10:00:00Z'};
  const wallet={capital:100,totalInvested:100,totalProfit:20,totalEarned:30,totalWithdrawn:10,availableBalance:20};
  const member={id:'1',username:'fixture_child',name:'Fixture Child',side:'left',pv:1,level:1,status:'ACTIVE',children:[]};
  const team={members:[member],totalCount:1,activeCount:1,pv:1};
  const transaction={id:'1',description:'Profit Sharing',reference:'Profit Sharing',type:'EARNINGS',status:'COMPLETED',amount:10,createdAt:'2026-10-10'};
  const fixtures={
    '/auth/refresh':{accessToken:'fixture-token'},'/auth/me':{user,wallet},
    '/dashboard':{user,wallet,stats:{totalReferrals:1,totalTeam:1},providerMetrics:{matchingBonus:5},referralLinks:{}},
    '/referrals':{leftTeam:team,rightTeam:{members:[],totalCount:0,activeCount:0,pv:0},referralLinks:{}},
    '/wallet':{wallet,depositHistory:[{reference:'fixture-contract',createdAt:'2026-10-01',description:'Trading',amount:100,status:'Active'}],withdrawalHistory:[{reference:'fixture-txn',createdAt:'2026-10-02',amount:10,status:'COMPLETED'}]},
    '/transactions':{transactions:[transaction],pagination:{page:1,totalPages:1,totalItems:1}},
    '/tree':{root:{...user,side:'root',children:[member]},stats:{totalMembers:1,activeMembers:1}},
    '/profile':{editable:user,synced:user,metadata:{status:'ACTIVE'}},
    '/sync/status':{status:'SUCCESS',provider:'FXUNIFI',mock:false,canSync:true,connected:true,lastSuccessfulSync:user.lastSyncAt,recordsProcessed:4},
    '/sync/fxunifi':{status:'RUNNING',message:'Sync started'},
  };
  globalThis.document={querySelector(selector){if(['#content','#sidebar','.menu-button','#breadcrumb'].includes(selector)&&!element('#app').innerHTML.includes('id="content"'))return null;return element(selector);},querySelectorAll(){return[];},addEventListener(name,handler){handlers.set('document:'+name,handler);}};
  globalThis.window={addEventListener(name,handler){handlers.set('window:'+name,handler);}};
  globalThis.location={hash:'#dashboard'};
  globalThis.sessionStorage={getItem(key){return key==='tradevault-local'?'1':null;},setItem(){},removeItem(){}};
  globalThis.fetch=async(url)=>{calls.push(url);assert.ok(url.startsWith('/api/local/'),url);const path=url.replace('/api/local','').split('?')[0];assert.ok(path in fixtures,path);return Response.json({success:true,data:fixtures[path]});};
  const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
  try {
    await import('../apps/web/public/app.js?imported-render');await settle();
    assert.match(element('#app').innerHTML,/FXUNIFI · SYNCED/);
    assert.doesNotMatch(element('#app').innerHTML,/NOT SYNCED|DEMO MODE/);
    for(const[route,title]of Object.entries({dashboard:'Imported Member',wallet:'Trading deposit history',transactions:'Profit Sharing',referrals:'Fixture Child',tree:'fixture_child',profile:'test@example.invalid',sync:'Sync now'})){
      globalThis.location.hash='#'+route;handlers.get('window:hashchange')();await settle();
      assert.match(element('#content').innerHTML,new RegExp(title),route);
      assert.doesNotMatch(element('#content').innerHTML,/Unable to load this page|undefined|NaN/,route);
      if(route==='dashboard') {
        assert.match(element('#content').innerHTML,/Sync now/);
        assert.match(element('#content').innerHTML,/Last synced/);
      }
      if(route==='wallet') {
        assert.match(element('#content').innerHTML,/\$20\.00/);
        assert.match(element('#content').innerHTML,/\$100\.00/);
        assert.match(element('#content').innerHTML,/Refresh wallet/);
      }
    }
    assert.ok(calls.includes('/api/local/auth/refresh'));
    globalThis.location.hash='#dashboard';handlers.get('window:hashchange')();await settle();
    const button={disabled:false,dataset:{action:'sync'}};
    await handlers.get('#app:click')({target:{closest(){return button;}}});await settle();
    assert.ok(calls.includes('/api/local/sync/fxunifi'));
  } finally {for(const key of keys)if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];}
});
