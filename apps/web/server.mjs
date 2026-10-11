import http from 'node:http';
import https from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalAccount, parseLocalCredentials } from './local-account.mjs';
import { createFxunifiSync } from './fxunifi-sync.mjs';
import { getHostedConfig } from './hosted-config.mjs';
import { createNeonStore } from './neon-store.mjs';
import { createHostedAccount } from './hosted-account.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

export function createWebServer({ apiUrl = process.env.API_URL || 'http://localhost:4000',hostedConfig = getHostedConfig(),hostedStore } = {}) {
  const credentialsFile = resolve(directory, '../../.env.fxunifi.local');
  const store = hostedConfig ? hostedStore || createNeonStore({connectionString:hostedConfig.databaseUrl}) : null;
  const readCredentials = hostedConfig ? async()=>({FXUNIFI_USERNAME:hostedConfig.sourceUsername,FXUNIFI_PASSWORD:hostedConfig.sourcePassword}) : async()=>parseLocalCredentials(await readFile(credentialsFile,'utf8'));
  const syncService = createFxunifiSync({ readCredentials,dataDirectory:resolve(directory,'../../.tradevault-local/accounts'),...(store?{storage:store}:{}) });
  const account = hostedConfig ? createHostedAccount({config:hostedConfig,store,syncService}) : createLocalAccount({credentialsFile,syncService});
  const target = new URL(apiUrl);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('API_URL must use HTTP or HTTPS');
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if(hostedConfig)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const url = new URL(req.url, 'http://localhost');
      if(url.pathname==='/health'&&req.method==='GET'){
        try{if(store)await store.initialize();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:'ok'}));}
        catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'unavailable'}));}
        return;
      }
      if (await account(req, res, url)) return;
      if (url.pathname.startsWith('/api/')) {
        if(hostedConfig){res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,error:{message:'Portal route not found.'}}));return;}
        const headers = { ...req.headers, host: target.host };
        delete headers.connection;
        const proxy = (target.protocol === 'https:' ? https : http).request(new URL(url.pathname + url.search, target), { method: req.method, headers, timeout: 15000 }, upstream => {
          res.writeHead(upstream.statusCode || 502, upstream.headers);
          upstream.pipe(res);
        });
        proxy.on('timeout', () => proxy.destroy(new Error('API request timed out')));
        proxy.on('error', () => {
          if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: { code: 'API_UNAVAILABLE', message: 'The API is offline. Start the backend or use the demo preview.' } })); }
          else res.destroy();
        });
        req.on('aborted', () => proxy.destroy());
        req.pipe(proxy);
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
      const path = decodeURIComponent(url.pathname);
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
      const info = await stat(file);
      if (!info.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      let content = await readFile(file);
      if(hostedConfig&&extname(file)==='.html')content=content.toString('utf8').replace('<body>','<body data-portal-mode="hosted">');
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { if (!res.headersSent) { res.writeHead(404); res.end('Not found'); } }
  });
  server.initialize = async()=>{if(store)await store.initialize();};
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Load only the local web settings; no dependencies are needed for the preview.
  try {
    const env = await readFile(resolve(directory, '../../.env'), 'utf8');
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^(WEB_PORT|API_URL)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '').trim();
    }
  } catch {}
  const port = Number(process.env.PORT || process.env.WEB_PORT || 3000);
  const host = process.env.WEB_HOST || (process.env.PORTAL_MODE==='hosted'?'0.0.0.0':'127.0.0.1');
  try {const server=createWebServer();await server.initialize();server.listen(port,host,()=>console.log(`TradeVault listening on ${host}:${port}`));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
