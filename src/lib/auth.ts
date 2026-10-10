import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { mutate, readCollection } from './store';
export const COOKIE = 'sakurank_session';
const SESSION_DAYS = 7;
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function secret() { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error('Session configuration unavailable'); return s; }
export function tokenHash(token: string) { return createHmac('sha256', secret()).update(token).digest('hex'); }
export async function verifyPassword(password: string, encoded = process.env.OWNER_PASSWORD_HASH ?? '') {
 const parts = encoded.split(':');
 if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) throw new Error('Owner credential unavailable');
 const derived = await (promisify(scrypt) as (password: string, salt: string, length: number, options: object) => Promise<Buffer>)(password, parts[1], 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
 return timingSafeEqual(derived, Buffer.from(parts[2], 'hex'));
}
export function assertOrigin(request: Request) {
 const origin = process.env.APP_ORIGIN;
 if (!origin || request.headers.get('origin') !== new URL(origin).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Request denied');
}
export async function isOwner() {
 const token = (await cookies()).get(COOKIE)?.value;
 if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
 const hash = tokenHash(token);
 return (await readCollection()).sessions.some(session => session.hash === hash && Date.parse(session.expiresAt) > Date.now());
}
export async function requireOwner(request: Request) { assertOrigin(request); if (!await isOwner()) throw new HttpError(401, 'Authentication required'); }
export async function loginSession() {
 const token = randomBytes(32).toString('hex');
 const hash = tokenHash(token);
 const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
 await mutate(doc => {
  doc.sessions = [...doc.sessions.filter(session => Date.parse(session.expiresAt) > Date.now()), { hash, expiresAt }].slice(-20);
 });
 (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: SESSION_DAYS * 86400 });
}
export async function logoutSession() {
 const jar = await cookies(); const token = jar.get(COOKIE)?.value;
 if (token) await mutate(doc => { doc.sessions = doc.sessions.filter(session => session.hash !== tokenHash(token)); });
 jar.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
}
export async function rateLimit(key: string, limit: number, seconds: number) {
 await mutate(doc => {
  const state = doc.limits[key];
  const now = Date.now();
  const active = state && Date.parse(state.resetsAt) > now;
  const attempts = active ? state.attempts + 1 : 1;
  doc.limits[key] = { attempts, resetsAt: active ? state.resetsAt : new Date(now + seconds * 1000).toISOString() };
  if (attempts > limit) throw new HttpError(429, 'Too many attempts. Try again later.');
  for (const [name, entry] of Object.entries(doc.limits)) if (Date.parse(entry.resetsAt) < now - 86400000) delete doc.limits[name];
 });
}
