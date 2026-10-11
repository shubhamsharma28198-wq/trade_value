export function getHostedConfig(env=process.env) {
  if(env.PORTAL_MODE!=='hosted')return null;
  const required=['DATABASE_URL','PORTAL_USERNAME','PORTAL_PASSWORD_HASH','FXUNIFI_USERNAME','FXUNIFI_PASSWORD'];
  for(const key of required)if(!env[key])throw new Error(`Set ${key} before starting hosted mode.`);
  if(!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(env.PORTAL_PASSWORD_HASH))throw new Error('PORTAL_PASSWORD_HASH is invalid. Generate it with the hash-password script.');
  let origin,database;
  try{origin=new URL(env.APP_URL||env.RENDER_EXTERNAL_URL);database=new URL(env.DATABASE_URL);}catch{throw new Error('Set a valid HTTPS APP_URL and Neon DATABASE_URL.');}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('APP_URL must be the HTTPS origin of your deployed portal.');
  if(!['postgres:','postgresql:'].includes(database.protocol)||!database.hostname.endsWith('.neon.tech'))throw new Error('Hosted mode requires a Neon PostgreSQL DATABASE_URL.');
  return {origin:origin.origin,databaseUrl:env.DATABASE_URL,portalUsername:env.PORTAL_USERNAME,passwordHash:env.PORTAL_PASSWORD_HASH,sourceUsername:env.FXUNIFI_USERNAME,sourcePassword:env.FXUNIFI_PASSWORD};
}
