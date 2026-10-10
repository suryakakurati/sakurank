import { scryptSync, randomBytes } from 'node:crypto';
import { stdin, stdout } from 'node:process';
if (!stdin.isTTY) throw new Error('Run in an interactive terminal. Passwords must not be passed as command arguments.');
stdout.write('Owner password (16+ characters): ');
stdin.setRawMode(true); stdin.resume();
let password = '';
stdin.on('data', (chunk: Buffer) => {
 for (const char of chunk.toString()) {
  if (char === '\u0003') process.exit(1);
  if (char === '\r' || char === '\n') {
   stdin.setRawMode(false); stdin.pause(); stdout.write('\n');
   if (password.length < 16) { console.error('Use at least 16 characters.'); process.exit(1); }
   const salt = randomBytes(16).toString('hex');
   const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
   console.log(`OWNER_PASSWORD_HASH=scrypt:${salt}:${hash}`); return;
  }
  if (char === '\u007f') password = password.slice(0, -1); else password += char;
 }
});
