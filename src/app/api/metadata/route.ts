import { isOwner, HttpError, rateLimit } from '@/lib/auth';
import { searchMetadata } from '@/lib/metadata';
import { failure } from '@/lib/http';
import { z } from 'zod';
export async function GET(request: Request) {
 try { // GET has no mutation but remains owner-only; origin sent by the client.
  if (!await isOwner()) throw new HttpError(401,'Authentication required'); await rateLimit('metadata',60,60);
  const q=z.string().trim().min(2).max(200).parse(new URL(request.url).searchParams.get('q'));
  return Response.json({candidates:await searchMetadata(q)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
