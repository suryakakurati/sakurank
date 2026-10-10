import { findAnime, removeAnime, updateAnime, viewOne } from '@/lib/db';
import { uuid } from '@/lib/validation';
import { HttpError, requireOwner } from '@/lib/auth';
import { entryInput } from '@/lib/entries';
import { failure, jsonBody } from '@/lib/http';
type Context = {params:Promise<{id:string}>};
export async function GET(_request: Request, context: Context) { try { const id=uuid.parse((await context.params).id); const entry=await findAnime(id); if(!entry) throw new HttpError(404,'Anime not found'); return Response.json(viewOne(entry)); } catch(e){return failure(e);} }
export async function PUT(request: Request, context: Context) {
 try {
  await requireOwner(request); const id=uuid.parse((await context.params).id); const body=await jsonBody(request);
  if(!body?.updatedAt) throw new HttpError(400,'Reload the entry');
  const entry=await updateAnime(id, await entryInput(body), String(body.updatedAt));
  return Response.json(viewOne(entry));
 }catch(e){return failure(e);}
}
export async function DELETE(request: Request, context: Context) {
 try { await requireOwner(request); const id=uuid.parse((await context.params).id); const body=await jsonBody(request,2000);
  if(body?.confirm!==true) throw new HttpError(400,'Confirm deletion');
  if(!await removeAnime(id)) throw new HttpError(404,'Anime not found'); return Response.json({deleted:true});
 }catch(e){return failure(e);}
}
