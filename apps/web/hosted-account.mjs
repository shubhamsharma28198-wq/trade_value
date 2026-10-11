import { createHash,randomBytes,timingSafeEqual } from 'node:crypto';
import { verifyPortalPassword } from './portal-password.mjs';
import { accountData,importedUser } from './account-data.mjs';

const digest=value=>createHash('sha256').update(value).digest();
export function createHostedAccount({config,store,syncService,now=()=>Date.now()}) {
  const authVersion=createHash('sha256').update(config.portalUsername+'\n'+config.passwordHash).digest('hex');
  const cookieName='__Secure-tradevaultPortal';
  const lifetime=7*24*3600000;
  let attempts={count:0,until:0};
  let lastSyncRequest=0;
  const cookie=(token,seconds)=>`${cookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/local/auth; Max-Age=${seconds}`;
  const send=(res,status,data,message)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(message?{success:false,error:{message}}:{success:true,data}));};
  return async(req,res,url)=>{
    if(!url.pathname.startsWith('/api/local/'))return false;
    const path=url.pathname.slice('/api/local'.length);
    if(req.headers.host!==new URL(config.origin).host){send(res,403,null,'Portal host is not permitted.');return true;}
    if(req.headers.origin&&req.headers.origin!==config.origin){send(res,403,null,'Origin is not permitted.');return true;}
    if(req.method!=='GET'&&req.headers.origin!==config.origin){send(res,403,null,'Open the portal to perform this action.');return true;}
    if(req.headers['sec-fetch-site']&& !['same-origin','none'].includes(req.headers['sec-fetch-site'])){send(res,403,null,'Cross-site requests are not permitted.');return true;}
    try {
      if(path==='/auth/login'&&req.method==='POST'){
        if(attempts.until<=now())attempts={count:0,until:now()+60000};
        if(++attempts.count>10){send(res,429,null,'Too many sign-in attempts. Try again in a minute.');return true;}
        if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,null,'Send credentials as JSON.');return true;}
        let body;
        try{let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>4096)throw Error();chunks.push(chunk);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(typeof body.username!=='string'||typeof body.password!=='string')throw Error();}
        catch{send(res,400,null,'Enter your portal username and password.');return true;}
        const usernameMatches=timingSafeEqual(digest(body.username),digest(config.portalUsername));
        // Always derive the password, including for unknown usernames.
        const passwordMatches=await verifyPortalPassword(body.password,config.passwordHash);
        if(!usernameMatches||!passwordMatches){send(res,401,null,'Invalid portal credentials.');return true;}
        const token=randomBytes(32).toString('hex');
        await store.saveSession(token,{account:config.sourceUsername,expires:now()+lifetime,authVersion});
        const user=importedUser(config.sourceUsername,await syncService.snapshot(config.sourceUsername));
        await syncService.start(config.sourceUsername);
        res.setHeader('Set-Cookie',cookie(token,lifetime/1000));send(res,200,{user,accessToken:token});return true;
      }
      const suppliedCookie=req.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      const bearer=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      const refresh=path==='/auth/refresh';
      const token=refresh?suppliedCookie:bearer;
      if(path==='/auth/logout'&&req.method==='POST'){
        if(bearer)await store.deleteSession(bearer);
        if(suppliedCookie&&suppliedCookie!==bearer)await store.deleteSession(suppliedCookie);
        res.setHeader('Set-Cookie',cookie('',0));send(res,200,null);return true;
      }
      const session=token&&/^[a-f0-9]{64}$/.test(token)?await store.getSession(token):null;
      if(!session||session.expires<=now()||session.account!==config.sourceUsername||session.authVersion!==authVersion){send(res,401,null,'Your portal session expired. Sign in again.');return true;}
      if(refresh&&req.method==='POST'){send(res,200,{accessToken:token});return true;}
      if(path==='/sync/fxunifi'&&req.method==='POST'){
        if(now()-lastSyncRequest<10000){send(res,429,null,'Sync was just requested. Wait a few seconds and refresh its status.');return true;}
        lastSyncRequest=now();send(res,202,await syncService.start(config.sourceUsername));return true;
      }
      if(path==='/sync/status'&&req.method==='GET'){send(res,200,await syncService.status(config.sourceUsername));return true;}
      if(req.method!=='GET'){send(res,405,null,'Imported FXUNIFI records are read-only.');return true;}
      const data=accountData(path,url,config.sourceUsername,await syncService.snapshot(config.sourceUsername));
      if(data===undefined)send(res,404,null,'Portal route not found.');else send(res,200,data);
    }catch{send(res,503,null,'The portal database is unavailable. Please retry in a moment.');}
    return true;
  };
}
