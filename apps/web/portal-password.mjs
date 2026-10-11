import { scrypt,randomBytes,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export async function hashPortalPassword(password) {
  if(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>256)throw new Error('Use a portal password between 12 characters and 256 UTF-8 bytes.');
  const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPortalPassword(password,hash) {
  if(typeof password!=='string'||Buffer.byteLength(password)>256||!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash))return false;
  const [,salt,expected]=hash.split('$');return timingSafeEqual(await derive(password,salt,64),Buffer.from(expected,'hex'));
}
