import { requireOwner, HttpError, rateLimit } from '@/lib/auth';
import { savePoster } from '@/lib/storage';
import { failure } from '@/lib/http';
export async function POST(request: Request) {
 try { await requireOwner(request); await rateLimit('upload',30,60);
  const reader=request.body?.getReader(); if(!reader) throw new HttpError(400,'Select an image');
  let size=0; const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw new HttpError(413,'Image must be under 3 MB');}chunks.push(value);}
  const key=await savePoster(Buffer.concat(chunks)); return Response.json({posterKey:key,posterUrl:`/api/posters/${key}`});
 }catch(e){return failure(e);}
}
