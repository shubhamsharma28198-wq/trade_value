import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { accountData } from './account-data.mjs';

const digest = value => createHash('sha256').update(value).digest();
export function parseLocalCredentials(text) {
  const values = {};
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^\s*(FXUNIFI_USERNAME|FXUNIFI_PASSWORD)\s*=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

export function createLocalAccount({ credentialsFile, readCredentials = () => readFile(credentialsFile, 'utf8'), syncService, enabled = process.env.NODE_ENV !== 'production' } = {}) {
  const sessions = new Map();
  const attempts = new Map();
  const cookie = 'tradevaultLocal';
  const cookieHeader = (value, age) => `${cookie}=${value}; HttpOnly; SameSite=Strict; Path=/api/local/auth; Max-Age=${age}`;
  const send = (res, status, data, message) => {
    res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store' });
    res.end(JSON.stringify(message ? { success:false, error:{ message } } : { success:true, data }));
  };
  return async (req, res, url) => {
    if (!url.pathname.startsWith('/api/local/')) return false;
    const ip = req.socket.remoteAddress;
    if (!enabled || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)) { send(res, 403, null, 'Local account access is only available on this computer.'); return true; }
    if (req.headers.origin && !['http://localhost:','http://127.0.0.1:'].some(prefix => req.headers.origin.startsWith(prefix)) && !['http://localhost','http://127.0.0.1'].includes(req.headers.origin)) {
      send(res, 403, null, 'Origin not permitted.'); return true;
    }
    // Compare the exact origin host to prevent other localhost ports making authenticated writes.
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) { send(res, 403, null, 'Origin not permitted.'); return true; }
    const path = url.pathname.slice('/api/local'.length);
    for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
    const suppliedCookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(cookie + '='))?.slice(cookie.length + 1);
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    const session = token ? sessions.get(token) : null;
    if (path === '/auth/login' && req.method === 'POST') {
      const attempt = attempts.get(ip);
      if (attempt && attempt.until > Date.now() && attempt.count >= 10) { send(res, 429, null, 'Too many attempts. Try again in a minute.'); return true; }
      attempts.set(ip, { count:attempt?.until > Date.now() ? attempt.count + 1 : 1, until:attempt?.until > Date.now() ? attempt.until : Date.now() + 60000 });
      let body;
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new Error(); chunks.push(chunk); }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof body.username !== 'string' || typeof body.password !== 'string') throw new Error();
      } catch { send(res, 400, null, 'Enter a username and password.'); return true; }
      let credentials;
      try { credentials = parseLocalCredentials(await readCredentials()); } catch { send(res, 503, null, 'Local credentials file is unavailable.'); return true; }
      if (!credentials.FXUNIFI_USERNAME || !credentials.FXUNIFI_PASSWORD) { send(res, 503, null, 'Fill in .env.fxunifi.local first.'); return true; }
      const userMatches = timingSafeEqual(digest(body.username), digest(credentials.FXUNIFI_USERNAME));
      const passwordMatches = timingSafeEqual(digest(body.password), digest(credentials.FXUNIFI_PASSWORD));
      if (!userMatches || !passwordMatches) { send(res, 401, null, 'Credentials do not match the local file.'); return true; }
      const accessToken = randomBytes(32).toString('hex');
      const previous = syncService ? await syncService.snapshot(credentials.FXUNIFI_USERNAME) : null;
      const user = previous ? { ...previous.profile,lastSyncAt:previous.syncedAt } : { id:'local-fxunifi', username:credentials.FXUNIFI_USERNAME, fullName:'', email:'', role:'USER', status:'LOCAL_ONLY' };
      sessions.set(accessToken, { user, expires:Date.now() + 3600000 });
      attempts.delete(ip);
      res.setHeader('Set-Cookie', cookieHeader(accessToken, 3600));
      if (syncService) await syncService.start(user.username);
      send(res, 200, { user, accessToken }); return true;
    }
    if (path === '/auth/logout' && req.method === 'POST') {
      if (suppliedCookie) sessions.delete(suppliedCookie);
      if (token) sessions.delete(token);
      res.setHeader('Set-Cookie', cookieHeader('', 0)); send(res, 200, null); return true;
    }
    if (path === '/auth/refresh' && req.method === 'POST') {
      const saved = suppliedCookie ? sessions.get(suppliedCookie) : null;
      if (!saved) { send(res, 401, null, 'Local session expired. Sign in again.'); return true; }
      send(res, 200, { accessToken:suppliedCookie }); return true;
    }
    if (!session) { send(res, 401, null, 'Sign in to the local workspace first.'); return true; }
    if (path === '/sync/fxunifi' && req.method === 'POST' && syncService) { send(res, 202, await syncService.start(session.user.username)); return true; }
    if (path === '/sync/status' && req.method === 'GET' && syncService) { send(res, 200, await syncService.status(session.user.username)); return true; }
    if (req.method !== 'GET') { send(res, 409, null, 'This workspace is read-only until FXUNIFI sync is connected.'); return true; }
    if(path === '/sync/status' && !syncService) { send(res,200,{status:'NOT_CONNECTED',provider:'FXUNIFI',mock:false,connected:false,recordsProcessed:0});return true; }
    const snapshot = syncService ? await syncService.snapshot(session.user.username) : null;
    const data = accountData(path,url,session.user.username,snapshot);
    if(data === undefined)send(res,404,null,'Local route not found.');else send(res,200,data);
    return true;
  };
}
