import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createWebServer } from '../apps/web/server.mjs';

async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return 'http://127.0.0.1:' + server.address().port; }
function close(server) { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); }

test('web server serves all portal assets and applies security headers', async () => {
  const server = createWebServer(); const url = await listen(server);
  try {
    const page = await fetch(url);
    assert.equal(page.status, 200); assert.match(await page.text(), /TradeVault/);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    for (const asset of ['/app.js','/client.js','/demo.js','/styles.css','/reference.css','/reference-dashboard.js','/matrix.svg','/fonts.css','/favicon.svg']) assert.equal((await fetch(url + asset)).status, 200, asset);
    assert.equal((await fetch(url + '/missing')).status, 404);
    assert.equal((await fetch(url + '/', { method:'POST' })).status, 405);
    assert.equal((await fetch(url + '/', { method:'HEAD' })).status, 200);
    assert.equal((await fetch(url + '/%2e%2e%5cpackage.json')).status, 403);
  } finally { await close(server); }
});
test('same-origin proxy forwards auth, request bodies, query filters, and cookies', async () => {
  let captured;
  const backend = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    captured = { url:req.url, auth:req.headers.authorization, cookie:req.headers.cookie, body:Buffer.concat(chunks).toString() };
    res.writeHead(201, { 'Content-Type':'application/json', 'Set-Cookie':'refreshToken=test; HttpOnly; Path=/api/auth' });
    res.end(JSON.stringify({ success:true, data:{ ok:true } }));
  });
  const backendUrl = await listen(backend);
  const server = createWebServer({ apiUrl:backendUrl }); const url = await listen(server);
  try {
    const response = await fetch(url + '/api/profile?test=1', { method:'PUT', headers:{ Authorization:'Bearer test', Cookie:'refreshToken=test', 'Content-Type':'application/json' }, body:JSON.stringify({ fullName:'Member' }) });
    assert.equal(response.status, 201);
    assert.equal(captured.url, '/api/profile?test=1'); assert.equal(captured.auth, 'Bearer test');
    assert.equal(captured.cookie, 'refreshToken=test'); assert.deepEqual(JSON.parse(captured.body), { fullName:'Member' });
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  } finally { await close(server); await close(backend); }
});
test('offline backend returns a JSON error instead of crashing the preview', async () => {
  const backend = http.createServer(); const backendUrl = await listen(backend); await close(backend);
  const server = createWebServer({ apiUrl:backendUrl }); const url = await listen(server);
  try {
    const response = await fetch(url + '/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' });
    assert.equal(response.status, 502); assert.equal((await response.json()).error.code, 'API_UNAVAILABLE');
    assert.equal((await fetch(url)).status, 200);
  } finally { await close(server); }
});
