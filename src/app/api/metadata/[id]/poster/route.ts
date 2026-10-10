import { requireOwner, rateLimit } from '@/lib/auth';
import { importPoster } from '@/lib/import-poster';
import { failure } from '@/lib/http';
export async function POST(request: Request, context:{params:Promise<{id:string}>}) {
 try {
  await requireOwner(request);
  await rateLimit('poster-import',30,60);
  const {id} = await context.params;
  const posterKey = await importPoster(id);
  return Response.json({posterKey,posterUrl:`/api/posters/${posterKey}`},{headers:{'Cache-Control':'no-store'}});
 } catch(e) { return failure(e); }
}
