import { hashPortalPassword } from '../portal-password.mjs';

if(!process.stdin.isTTY){console.error('Run this command in an interactive terminal. Your password will not be echoed.');process.exitCode=1;}
else {
  process.stdout.write('Choose a separate portal password (at least 12 characters): ');
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  let password='';
  const finish=async()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');try{console.log(await hashPortalPassword(password));}catch(error){console.error(error.message);process.exitCode=1;}password='';};
  process.stdin.on('data',chunk=>{
    for(const character of chunk){
      if(character==='\u0003'){process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\nCancelled.\n');process.exit(1);}
      if(character==='\r'||character==='\n'){process.stdin.removeAllListeners('data');void finish();return;}
      if(character==='\u007f'||character==='\b'){password=password.slice(0,-1);continue;}
      if(character>=' ')password+=character;
    }
  });
}
