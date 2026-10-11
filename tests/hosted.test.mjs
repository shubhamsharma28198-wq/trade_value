import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { hashPortalPassword,verifyPortalPassword } from '../apps/web/portal-password.mjs';
import { getHostedConfig } from '../apps/web/hosted-config.mjs';
import { createHostedAccount } from '../apps/web/hosted-account.mjs';
import { createNeonStore } from '../apps/web/neon-store.mjs';
import { createWebServer } from '../apps/web/server.mjs';

const password='a-test-only-portal-password';
const hash=await hashPortalPassword(password);
const config={origin:'https://portal.example.invalid',portalUsername:'portal_test',passwordHash:hash,sourceUsername:'source_fixture',sourcePassword:'source-password-not-for-login'};
// A real HTTP client preserves Host so these tests can simulate Render's HTTPS proxy.
// Node's built-in fetch overrides Host with the local test server address.
function fetch(url,{method='GET',headers={},body}={}) {
  return new Promise((resolve,reject)=>{
    const req=http.request(url,{method,headers},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
        const responseHeaders=new Headers();for(const[key,value]of Object.entries(res.headers)){for(const item of Array.isArray(value)?value:[value])if(item!==undefined)responseHeaders.append(key,item);}
        resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:responseHeaders}));
      });
    });req.on('error',reject);req.end(body);
  });
}
function memoryStore(){const records=new Map();return {async initialize(){},async saveSession(token,value){records.set(token,value);},async getSession(token){return records.get(token);},async deleteSession(token){records.delete(token);},async load(){return null;},async save(){},records};}
const fakeSync=()=>{let starts=0;return {async snapshot(){return null;},async start(){starts++;return {status:'RUNNING',message:'Sync started'};},async status(){return {status:'RUNNING',canSync:true};},get starts(){return starts;}};};
async function fixture(handler){const server=http.createServer(async(req,res)=>{if(!await handler(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');return {base:'http://127.0.0.1:'+server.address().port,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};}

test('hosted configuration requires HTTPS, private login, and Neon credentials',()=>{
  assert.equal(getHostedConfig({}),null);
  const env={PORTAL_MODE:'hosted',APP_URL:config.origin,DATABASE_URL:'postgresql://fixture:fixture@ep-test.neon.tech/db?sslmode=require',PORTAL_USERNAME:config.portalUsername,PORTAL_PASSWORD_HASH:hash,FXUNIFI_USERNAME:config.sourceUsername,FXUNIFI_PASSWORD:config.sourcePassword};
  assert.equal(getHostedConfig(env).sourceUsername,'source_fixture');
  assert.throws(()=>getHostedConfig({...env,APP_URL:'http://portal.example.invalid'}),/HTTPS/);
  assert.throws(()=>getHostedConfig({...env,DATABASE_URL:'postgresql://fixture:fixture@untrusted.invalid/db'}),/Neon/);
  assert.throws(()=>getHostedConfig({...env,PORTAL_PASSWORD_HASH:'plaintext'}),/invalid/);
  assert.throws(()=>getHostedConfig({...env,FXUNIFI_PASSWORD:''}),/FXUNIFI_PASSWORD/);
});

test('portal passwords use salted scrypt and reject invalid or oversized inputs',async()=>{
  assert.equal(await verifyPortalPassword(password,hash),true);
  assert.equal(await verifyPortalPassword('wrong-password',hash),false);
  assert.equal(await verifyPortalPassword('a'.repeat(300),hash),false);
  assert.notEqual(await hashPortalPassword(password),hash);
  await assert.rejects(hashPortalPassword('short'),/12/);
});

test('hosted login is separate from source credentials, persists sessions, and validates origins',async()=>{
  const store=memoryStore(),sync=fakeSync();
  const first=await fixture(createHostedAccount({config,store,syncService:sync}));
  const headers={Host:'portal.example.invalid',Origin:config.origin,'Content-Type':'application/json'};
  const post=(base,path,body,more={})=>fetch(base+'/api/local'+path,{method:'POST',headers:{...headers,...more},body:JSON.stringify(body)});
  let token,cookie;
  try{
    assert.equal((await post(first.base,'/auth/login',{username:config.sourceUsername,password:config.sourcePassword})).status,401);
    assert.equal((await post(first.base,'/auth/login',{username:'portal_test',password},{Origin:'https://untrusted.invalid'})).status,403);
    const response=await post(first.base,'/auth/login',{username:'portal_test',password});
    assert.equal(response.status,200);cookie=response.headers.get('set-cookie');
    assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
    const payload=await response.json();token=payload.data.accessToken;
    assert.equal(payload.data.user.username,'source_fixture');
    assert.equal(JSON.stringify(payload).includes(config.sourcePassword),false);
    assert.equal(sync.starts,1);
    const protectedHeaders={Host:'portal.example.invalid',Authorization:'Bearer '+token};
    assert.equal((await fetch(first.base+'/api/local/wallet',{headers:protectedHeaders})).status,200);
    assert.equal((await post(first.base,'/sync/fxunifi',{},protectedHeaders)).status,202);
    assert.equal((await post(first.base,'/sync/fxunifi',{},protectedHeaders)).status,429);
  }finally{await first.close();}
  const restarted=await fixture(createHostedAccount({config,store,syncService:sync}));
  try{
    assert.equal((await post(restarted.base,'/auth/refresh',{}, {Cookie:cookie.split(';')[0]})).status,200);
    assert.equal((await fetch(restarted.base+'/api/local/wallet',{headers:{Host:'portal.example.invalid',Authorization:'Bearer '+token}})).status,200);
    assert.equal((await post(restarted.base,'/auth/logout',{}, {Cookie:cookie.split(';')[0],Authorization:'Bearer '+token})).status,200);
    assert.equal((await post(restarted.base,'/auth/refresh',{}, {Cookie:cookie.split(';')[0]})).status,401);
  }finally{await restarted.close();}
});

test('hosted sessions expire and are invalidated after portal password changes',async()=>{
  let now=100000;const store=memoryStore(),sync=fakeSync();
  const first=await fixture(createHostedAccount({config,store,syncService:sync,now:()=>now}));
  const headers={Host:'portal.example.invalid',Origin:config.origin,'Content-Type':'application/json'};
  let token;
  try{const response=await fetch(first.base+'/api/local/auth/login',{method:'POST',headers,body:JSON.stringify({username:'portal_test',password})});token=(await response.json()).data.accessToken;now+=8*24*3600000;assert.equal((await fetch(first.base+'/api/local/wallet',{headers:{...headers,Authorization:'Bearer '+token}})).status,401);}
  finally{await first.close();}
  now=100000;
  const changed=await fixture(createHostedAccount({config:{...config,passwordHash:await hashPortalPassword('a-different-password')},store,syncService:sync,now:()=>now}));
  try{assert.equal((await fetch(changed.base+'/api/local/wallet',{headers:{...headers,Authorization:'Bearer '+token}})).status,401);}
  finally{await changed.close();}
});

test('Neon storage parameterizes records, hashes tokens, and hides database connection errors',async()=>{
  const calls=[];
  const snapshot={version:1,username:'fixture',syncedAt:'2026-10-11T00:00:00Z'};
  const store=createNeonStore({query:async(statement,params)=>{calls.push({statement,params});if(statement.startsWith('SELECT snapshot'))return[{snapshot}];if(statement.startsWith('SELECT account'))return[{account:'fixture',expires_at:'2026-10-12T00:00:00Z',auth_version:'version'}];return[];}});
  await store.save('fixture',snapshot);assert.deepEqual(await store.load('fixture'),snapshot);
  const token='a'.repeat(64);await store.saveSession(token,{account:'fixture',expires:Date.parse('2026-10-12T00:00:00Z'),authVersion:'version'});
  assert.equal((await store.getSession(token)).account,'fixture');await store.deleteSession(token);
  const sessionCalls=calls.filter(call=>call.statement.includes('token_hash')&&call.params.length);
  assert.ok(sessionCalls.every(call=>call.params[0]!==token));
  assert.equal(calls.filter(call=>call.statement.startsWith('CREATE TABLE')).length,2);
  assert.ok(calls.find(call=>call.statement.startsWith('INSERT INTO tradevault_portal_snapshots')).statement.includes('$2::jsonb'));
  const broken=createNeonStore({query:async()=>{throw Error('secret-database-connection-string');}});
  await assert.rejects(broken.initialize(),error=>!error.message.includes('secret-database'));
});

test('hosted server serves the correct login mode, exposes health, and never proxies ordinary account routes',async()=>{
  const server=createWebServer({hostedConfig:config,hostedStore:memoryStore()});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
  try{
    const page=await fetch(base);assert.match(await page.text(),/data-portal-mode="hosted"/);
    assert.ok(page.headers.get('strict-transport-security'));
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await fetch(base+'/api/auth/login',{method:'POST'})).status,404);
    assert.equal((await fetch(base+'/api/local/wallet',{headers:{Host:'portal.example.invalid'}})).status,401);
    assert.equal((await fetch(base+'/.env.fxunifi.local')).status,404);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
