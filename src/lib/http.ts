import { ZodError } from 'zod';
import { HttpError } from './auth';
export async function jsonBody(request: Request, max = 210000) {
 const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, 'Invalid input');
 const chunks: Uint8Array[] = []; let size = 0;
 while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new HttpError(413, 'Input too large'); } chunks.push(value); }
 try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid input'); }
}
export function failure(error: unknown) {
 if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
 if (error instanceof ZodError) return Response.json({ error: 'Invalid input' }, { status: 400 });
 if ((error as {code?: string})?.code === '23505') return Response.json({ error: 'Anime already exists' }, { status: 409 });
 console.error('Request failed:', error instanceof Error ? error.name : 'Unknown error');
 return Response.json({ error: 'Service unavailable. Try again.' }, { status: 503 });
}
