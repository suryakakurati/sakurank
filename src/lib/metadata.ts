import { z } from 'zod';
import { HttpError } from './auth';
import { mutate, readCollection } from './store';
export type Candidate = { id: string; title: string; originalTitle: string | null; releaseYear: number | null; posterAvailable: boolean };
const itemSchema = z.object({ id: z.string().regex(/^\d{1,12}$/), attributes: z.object({ titles: z.record(z.string(), z.string().nullable()), canonicalTitle: z.string(), startDate: z.string().nullable(), posterImage: z.object({ medium: z.string().optional(), large: z.string().optional() }).nullable() }) });
export function posterHost(url: URL) { return url.protocol === 'https:' && ['media.kitsu.app','media.kitsu.io'].includes(url.hostname) && !url.port && !url.username && !url.password; }
async function fetchData(path: string) {
 try {
  const response = await fetch(`https://kitsu.io/api/edge/anime${path}`, { headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(12000), cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error('Provider error');
  const text = await response.text(); if (text.length > 2000000) throw new Error('Provider response too large'); return JSON.parse(text);
 } catch { throw new HttpError(502, 'Anime search unavailable. Try again.'); }
}
const CACHE_HOURS = 6;
export async function metadata(path: string) {
 const key = `kitsu:${path}`;
 const cached = await (async () => {
  const entry = (await readCollection()).cache[key];
  return entry && Date.parse(entry.expiresAt) > Date.now() ? entry.data : undefined;
 })();
 if (cached !== undefined) return cached;
 const data = await fetchData(path);
 await mutate(doc => {
  doc.cache[key] = { expiresAt: new Date(Date.now() + CACHE_HOURS * 3600000).toISOString(), data };
  for (const [name, entry] of Object.entries(doc.cache)) if (Date.parse(entry.expiresAt) < Date.now() - 86400000) delete doc.cache[name];
 });
 return data;
}
export function candidate(item: unknown): Candidate {
 const parsed = itemSchema.parse(item); const a = parsed.attributes;
 const year = a.startDate ? Number(a.startDate.slice(0,4)) : null;
 return { id: `kitsu:${parsed.id}`, title: a.titles.en || a.titles.en_us || a.titles.en_jp || a.canonicalTitle, originalTitle: a.titles.ja_jp || null, releaseYear: year && year >= 1900 && year <= 2200 ? year : null, posterAvailable: !!(a.posterImage?.large || a.posterImage?.medium) };
}
export async function searchMetadata(q: string) {
 const response = await metadata(`?filter[text]=${encodeURIComponent(q)}&page[limit]=12`);
 return z.array(itemSchema).parse(response.data).map(candidate);
}
export async function providerPoster(id: string) {
 if (!/^kitsu:\d{1,12}$/.test(id)) throw new HttpError(400, 'Invalid anime');
 const response = await metadata(`/${id.split(':')[1]}`);
 const item = itemSchema.parse(response.data); const image = item.attributes.posterImage;
 const value = image?.large || image?.medium;
 if (!value) throw new HttpError(404, 'Poster unavailable');
 const url = new URL(value); if (!posterHost(url)) throw new HttpError(502, 'Poster unavailable');
 try {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error();
  const reader = response.body!.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > 3000000) { await reader.cancel(); throw new Error(); } chunks.push(value); }
  return Buffer.concat(chunks);
 } catch { throw new HttpError(502, 'Poster unavailable. Upload an image.'); }
}
