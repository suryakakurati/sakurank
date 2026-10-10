import { createAnime, listAnime, viewAll, viewOne } from '@/lib/db';
import { collectionQuery } from '@/lib/validation';
import { requireOwner } from '@/lib/auth';
import { entryInput } from '@/lib/entries';
import { failure, jsonBody } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 try {
  const {q,sort,page} = collectionQuery(new URL(request.url).searchParams);
  const query = q.toLowerCase();
  const matches = (await listAnime()).filter(entry =>
   !query || entry.title.toLowerCase().includes(query) || (entry.originalTitle ?? '').toLowerCase().includes(query));
  const by = {
   highest: (a: typeof matches[number], b: typeof matches[number]) => b.rating - a.rating || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
   lowest: (a: typeof matches[number], b: typeof matches[number]) => a.rating - b.rating || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
   title: (a: typeof matches[number], b: typeof matches[number]) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
   recent: (a: typeof matches[number], b: typeof matches[number]) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  }[sort];
  matches.sort(by);
  const start = (page - 1) * 36;
  return Response.json({ items: viewAll(matches.slice(start, start + 36)), hasMore: matches.length > start + 36 });
 } catch(e) { return failure(e); }
}
export async function POST(request: Request) {
 try {
  await requireOwner(request);
  const entry = await createAnime(await entryInput(await jsonBody(request)));
  return Response.json(viewOne(entry),{status:201});
 } catch(e) { return failure(e); }
}
