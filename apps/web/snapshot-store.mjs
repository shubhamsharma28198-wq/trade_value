import { readFile,mkdir,writeFile,rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash,randomUUID } from 'node:crypto';

export function createFileSnapshotStore(directory) {
  const filename=username=>resolve(directory,createHash('sha256').update(username).digest('hex')+'.json');
  return {
    async load(username){try{return JSON.parse(await readFile(filename(username),'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return null;throw error;}},
    async save(username,snapshot){await mkdir(directory,{recursive:true});const file=filename(username),temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(snapshot),{mode:0o600});await rename(temporary,file);},
  };
}
