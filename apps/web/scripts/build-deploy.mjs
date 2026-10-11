import {readFile,readdir,mkdir,copyFile,writeFile,lstat}from'node:fs/promises';
import{resolve,dirname,relative,sep}from'node:path';
import{fileURLToPath}from'node:url';
import{createHash}from'node:crypto';
import{parseLocalCredentials}from'../local-account.mjs';
import{makeZip,verifyZip}from'./zip-archive.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const files=[];
const ignored=new Set(['node_modules','dist','coverage','generated']);
async function walk(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.name.startsWith('.')||ignored.has(entry.name)||entry.isSymbolicLink())continue;
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())await walk(path);
    else if(entry.isFile()&&!entry.name.endsWith('.log'))files.push(path);
  }
}
for(const name of ['apps','packages','infra','tests']){const directory=resolve(root,name);if(!(await lstat(directory)).isSymbolicLink())await walk(directory);}
for(const name of ['README.md','DEPLOYMENT.md','CODE_REVIEW.md','package.json','package-lock.json','pnpm-workspace.yaml','tsconfig.base.json','docker-compose.yml','render.yaml','.gitignore','.dockerignore','.env.example']){
  try{const path=resolve(root,name);if((await lstat(path)).isFile())files.push(path);}catch(error){if(error.code!=='ENOENT')throw error;}
}
let privatePassword='';
try{privatePassword=parseLocalCredentials(await readFile(resolve(root,'.env.fxunifi.local'),'utf8')).FXUNIFI_PASSWORD||'';}catch{}
const stage=resolve(root,'.artifacts','deploy-'+Date.now());
const manifest=[];
const entries=[];
for(const source of files.sort()){
  const name=relative(root,source).split(sep).join('/');
  if(!source.startsWith(root+sep)||name.includes('..')||name.split('/').some(part=>['.claude','.tradevault-local','.npm-cache'].includes(part)))throw Error('Unexpected deployment file.');
  const content=await readFile(source);
  if(privatePassword.length>=6&&content.toString('utf8').includes(privatePassword))throw Error('Credential check failed in '+name+'. No archive was created.');
  const target=resolve(stage,...name.split('/'));if(!target.startsWith(stage+sep))throw Error('Unexpected staging path.');
  await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
  manifest.push({path:name,sha256:createHash('sha256').update(content).digest('hex')});
  entries.push({path:name,content});
}
await mkdir(resolve(root,'.artifacts'),{recursive:true});
await writeFile(resolve(root,'.artifacts/deploy-manifest.json'),JSON.stringify({stage,files:manifest},null,2));
const zip=makeZip(entries);verifyZip(zip,manifest);await writeFile(resolve(root,'.artifacts/tradevault-deploy.zip'),zip);
console.log('Verified deployment archive with',manifest.length,'files. Credentials, imported records, and logs excluded.');
