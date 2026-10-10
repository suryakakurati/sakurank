import { listAnime } from '@/lib/db';
import { isOwner, HttpError } from '@/lib/auth';
import { readPoster } from '@/lib/storage';
import { failure } from '@/lib/http';
export async function GET(_request:Request,context:{params:Promise<{key:string}>}) {
 try { const {key}=await context.params; if(!/^[a-f0-9]{64}\.webp$/.test(key))throw new HttpError(404,'Poster not found');
  const published=(await listAnime()).some(entry=>entry.posterKey===key);
  if(!published&&!await isOwner())throw new HttpError(404,'Poster not found');
  return new Response(new Uint8Array(await readPoster(key)),{headers:{'Content-Type':'image/webp','Cache-Control':published?'public, max-age=3600':'private, no-store'}});
 }catch(e){return failure(e);}
}
