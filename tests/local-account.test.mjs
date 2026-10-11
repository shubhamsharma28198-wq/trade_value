import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createLocalAccount, parseLocalCredentials } from '../apps/web/local-account.mjs';

test('local credential parsing preserves quoted punctuation and Windows encoding', () => {
  assert.deepEqual(parseLocalCredentials('\uFEFFFXUNIFI_USERNAME=test\r\nFXUNIFI_PASSWORD="some=#secret"\r\n'), { FXUNIFI_USERNAME:'test', FXUNIFI_PASSWORD:'some=#secret' });
});

test('local sign-in verifies credentials, protects records, and revokes sessions on logout', async () => {
  const handler = createLocalAccount({ enabled:true, readCredentials:async () => 'FXUNIFI_USERNAME=local_test\nFXUNIFI_PASSWORD=test-only-password' });
  const server = http.createServer(async (req, res) => {
    if (!await handler(req,res,new URL(req.url,'http://localhost'))) { res.writeHead(404); res.end(); }
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  const post = (path, body, headers = {}) => fetch(url + '/api/local' + path, { method:'POST', headers:{ 'Content-Type':'application/json', ...headers }, body:JSON.stringify(body) });
  try {
    assert.equal((await fetch(url + '/api/local/dashboard')).status,401);
    assert.equal((await post('/auth/login',{ username:'local_test', password:'wrong' })).status,401);
    const login = await post('/auth/login',{ username:'local_test', password:'test-only-password' });
    assert.equal(login.status,200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Strict/);
    const data = (await login.json()).data;
    assert.equal(data.user.status,'LOCAL_ONLY');
    assert.equal(JSON.stringify(data).includes('test-only-password'),false);
    const headers = { Authorization:'Bearer ' + data.accessToken };
    const dashboard = (await (await fetch(url + '/api/local/dashboard',{ headers })).json()).data;
    assert.equal(dashboard.wallet.capital,null);
    assert.equal(dashboard.user.username,'local_test');
    assert.equal((await post('/auth/refresh',{}, { Cookie:cookie.split(';')[0] })).status,200);
    assert.equal((await post('/auth/logout',{}, { ...headers, Origin:'https://untrusted.example' })).status,403);
    assert.equal((await post('/auth/logout',{}, { ...headers, Cookie:cookie.split(';')[0] })).status,200);
    assert.equal((await fetch(url + '/api/local/dashboard',{ headers })).status,401);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('local sign-in is unavailable when disabled', async () => {
  const handler = createLocalAccount({ enabled:false });
  let status;
  const res = { writeHead(value){ status=value; }, end(){} };
  await handler({ socket:{ remoteAddress:'127.0.0.1' } },res,new URL('http://localhost/api/local/auth/login'));
  assert.equal(status,403);
});
