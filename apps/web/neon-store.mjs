import { createHash } from 'node:crypto';
const tokenHash=token=>createHash('sha256').update(token).digest('hex');

export function createNeonStore({connectionString,query:injectedQuery}={}) {
  let query=injectedQuery,ready;
  async function initialize(){
    ready ||= (async()=>{
      if(!query){const {neon}=await import('@neondatabase/serverless');const sql=neon(connectionString);query=(statement,parameters)=>sql.query(statement,parameters);}
      await query('CREATE TABLE IF NOT EXISTS tradevault_portal_snapshots (account text PRIMARY KEY, snapshot jsonb NOT NULL, synced_at timestamptz NOT NULL)',[]);
      await query('CREATE TABLE IF NOT EXISTS tradevault_portal_sessions (token_hash text PRIMARY KEY, account text NOT NULL, expires_at timestamptz NOT NULL, auth_version text NOT NULL)',[]);
    })().catch(()=>{ready=null;throw new Error('Hosted database is unavailable. Check Neon DATABASE_URL and retry.');});
    return ready;
  }
  async function execute(statement,parameters){await initialize();try{return await query(statement,parameters);}catch{throw new Error('Hosted database request failed. Please retry.');}}
  return {
    initialize,
    async load(account){const rows=await execute('SELECT snapshot FROM tradevault_portal_snapshots WHERE account = $1',[account]);const value=rows[0]?.snapshot;return typeof value==='string'?JSON.parse(value):value||null;},
    async save(account,snapshot){await execute('INSERT INTO tradevault_portal_snapshots (account, snapshot, synced_at) VALUES ($1, $2::jsonb, $3::timestamptz) ON CONFLICT (account) DO UPDATE SET snapshot = EXCLUDED.snapshot, synced_at = EXCLUDED.synced_at',[account,JSON.stringify(snapshot),snapshot.syncedAt]);},
    async saveSession(token,session){await execute('DELETE FROM tradevault_portal_sessions WHERE expires_at <= now()',[]);await execute('INSERT INTO tradevault_portal_sessions (token_hash, account, expires_at, auth_version) VALUES ($1, $2, $3::timestamptz, $4)',[tokenHash(token),session.account,new Date(session.expires).toISOString(),session.authVersion]);},
    async getSession(token){const rows=await execute('SELECT account, expires_at, auth_version FROM tradevault_portal_sessions WHERE token_hash = $1 AND expires_at > now()',[tokenHash(token)]);return rows[0]?{account:rows[0].account,expires:new Date(rows[0].expires_at).getTime(),authVersion:rows[0].auth_version}:null;},
    async deleteSession(token){await execute('DELETE FROM tradevault_portal_sessions WHERE token_hash = $1',[tokenHash(token)]);},
  };
}
