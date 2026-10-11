import{deflateRawSync,inflateRawSync}from'node:zlib';
import{createHash}from'node:crypto';
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
export function makeZip(entries){
  const local=[],central=[];let offset=0;
  for(const{path,content}of entries){
    const name=Buffer.from(path,'utf8'),compressed=deflateRawSync(content),crc=crc32(content);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(content.length,22);header.writeUInt16LE(name.length,26);
    const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50,0);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(content.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(offset,42);
    local.push(header,name,compressed);central.push(record,name);offset+=header.length+name.length+compressed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
export function verifyZip(archive,manifest){
  let offset=0;const found=[];
  while(archive.readUInt32LE(offset)===0x04034b50){
    const length=archive.readUInt32LE(offset+18),nameLength=archive.readUInt16LE(offset+26),extra=archive.readUInt16LE(offset+28);
    const name=archive.subarray(offset+30,offset+30+nameLength).toString('utf8');
    const start=offset+30+nameLength+extra,bytes=inflateRawSync(archive.subarray(start,start+length));
    const expected=manifest.find(file=>file.path===name);
    if(!expected||createHash('sha256').update(bytes).digest('hex')!==expected.sha256||crc32(bytes)!==archive.readUInt32LE(offset+14))throw Error('Archive integrity check failed.');
    found.push(name);offset=start+length;
  }
  if(found.length!==manifest.length||new Set(found).size!==found.length||archive.readUInt32LE(archive.length-22)!==0x06054b50)throw Error('Archive file list is incomplete.');
}
