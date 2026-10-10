import { z } from 'zod';
import { assertOrigin } from '@/lib/auth';
import { isOwner, loginSession, logoutSession, rateLimit, verifyPassword, HttpError } from '@/lib/auth';
import { failure, jsonBody } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET() { try { return Response.json({ authenticated: await isOwner() }, { headers: {'Cache-Control':'no-store'} }); } catch(e) { return failure(e); } }
export async function POST(request: Request) {
 try {
  assertOrigin(request);
  // Global limit cannot be bypassed by spoofing forwarding headers.
  await rateLimit('login-global',20,900);
  const {password} = z.object({password:z.string().min(1).max(1024)}).strict().parse(await jsonBody(request,5000));
  if (!await verifyPassword(password)) throw new HttpError(401,'Invalid password');
  await logoutSession(); await loginSession();
  return Response.json({ authenticated:true }, {headers:{'Cache-Control':'no-store'}});
 } catch(e) { return failure(e); }
}
export async function DELETE(request: Request) { try { assertOrigin(request); await logoutSession(); return Response.json({authenticated:false}); } catch(e) { return failure(e); } }
