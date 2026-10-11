import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, escapeHtml, csv, safeLink, money } from '../apps/web/public/client.js';
import { createDemo } from '../apps/web/public/demo.js';

test('member content is escaped and unsafe link schemes are rejected', () => {
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(safeLink('javascript:alert(1)'), '');
  assert.equal(safeLink('https://example.com/?ref=test'), 'https://example.com/?ref=test');
});
test('CSV export handles quotes, commas and spreadsheet formula injection', () => {
  const output = csv([{ name: '=HYPERLINK("evil")', note: 'one,two' }], [{ key:'name', label:'Name' },{ key:'note', label:'Note' }]);
  assert.equal(output, '"Name","Note"\r\n"\'=HYPERLINK(""evil"")","one,two"');
});
test('currency display accepts backend formatted currency and raw balances', () => {
  assert.equal(money('USD 1,234.56'), '$1,234.56');
  assert.equal(money(42.5), '$42.50');
});
test('API refreshes expired access tokens using the HttpOnly cookie and retries', async () => {
  const calls = [];
  const client = createApi({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/refresh') return Response.json({ success:true, data:{ accessToken:'new-token' } });
    if (options.headers.Authorization === 'Bearer new-token') return Response.json({ success:true, data:{ balance:10 } });
    return Response.json({ success:false }, { status:401 });
  } });
  client.setToken('old-token');
  assert.deepEqual(await client.request('/wallet'), { balance:10 });
  assert.deepEqual(calls.map(c => c.url), ['/api/wallet','/api/auth/refresh','/api/wallet']);
  assert.equal(calls[1].options.credentials, 'same-origin');
});
test('concurrent requests share one refresh request', async () => {
  let refreshes = 0;
  const client = createApi({ fetchImpl: async (url, options) => {
    if (url === '/api/auth/refresh') { refreshes++; await new Promise(resolve => setImmediate(resolve)); return Response.json({ success:true, data:{ accessToken:'new' } }); }
    return options.headers.Authorization === 'Bearer new' ? Response.json({ success:true, data:{} }) : Response.json({}, { status:401 });
  } });
  await Promise.all([client.request('/wallet'),client.request('/profile')]);
  assert.equal(refreshes, 1);
});
test('failed session refresh triggers sign-in and terminates retries', async () => {
  let expired = 0, calls = 0;
  const client = createApi({ onExpired: () => expired++, fetchImpl: async () => { calls++; return Response.json({}, { status:401 }); } });
  await assert.rejects(client.request('/wallet'), /session expired/i);
  assert.equal(expired, 1); assert.equal(calls, 2);
});
test('offline API returns actionable feedback', async () => {
  const client = createApi({ fetchImpl: async () => { throw new Error('network'); } });
  await assert.rejects(client.request('/wallet'), /Could not connect/);
});

test('a business error after successful token refresh preserves the session', async () => {
  let expired = 0;
  const client = createApi({ onExpired: () => expired++, fetchImpl: async (url, options) => {
    if (url === '/api/auth/refresh') return Response.json({ success:true, data:{ accessToken:'renewed' } });
    if (!options.headers.Authorization) return Response.json({}, { status:401 });
    return Response.json({ success:false, error:{ message:'Service temporarily unavailable' } }, { status:503 });
  } });
  await assert.rejects(client.request('/wallet'), /Service temporarily unavailable/);
  assert.equal(expired, 0);
});
test('demo filters and pagination reflect the actual filtered result count', async () => {
  const demo = createDemo();
  const page = await demo('/transactions?page=2&limit=10');
  assert.equal(page.transactions.length, 10); assert.equal(page.pagination.totalPages, 3);
  const filtered = await demo('/transactions?type=WITHDRAWAL&status=PENDING');
  assert.equal(filtered.transactions.length, 1); assert.equal(filtered.pagination.totalItems, 1);
});
test('demo profile and sync update only the isolated demo session', async () => {
  const first = createDemo(), second = createDemo();
  await first('/profile', { body:{ fullName:'Updated Name' } });
  assert.equal((await first('/auth/me')).user.fullName, 'Updated Name');
  assert.equal((await second('/auth/me')).user.fullName, 'Alex Morgan');
  await first('/sync/fxunifi', { body:{} });
  assert.equal((await first('/sync/status')).status, 'SUCCESS');
  assert.equal((await second('/sync/status')).status, 'NO_SYNC');
  assert.equal((await first('/wallet')).wallet.availableBalance, 1130);
});
