import {defineConfig} from '@playwright/test';
import {scryptSync} from 'node:crypto';
import {resolve} from 'node:path';
const salt='abcdef0123456789abcdef0123456789';
const hash=scryptSync('test-owner-password-only',salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
process.env.SESSION_SECRET='test-only-session-secret-not-for-production';
process.env.OWNER_PASSWORD_HASH=`scrypt:${salt}:${hash}`;
process.env.DATA_DIR=resolve('.local/e2e-data');
export default defineConfig({testDir:'tests/e2e',workers:1,fullyParallel:false,use:{baseURL:'http://localhost:3100',trace:'retain-on-failure'},webServer:{command:'npm run dev -- --port 3100',cwd:process.env.E2E_APP_DIR||'.',url:'http://localhost:3100',reuseExistingServer:false,timeout:120000,env:{DATA_DIR:process.env.DATA_DIR,APP_ORIGIN:'http://localhost:3100',SESSION_SECRET:process.env.SESSION_SECRET,OWNER_PASSWORD_HASH:process.env.OWNER_PASSWORD_HASH}}});
