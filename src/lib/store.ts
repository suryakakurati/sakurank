import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { del, get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';

export type StoredAnime = {
 id: string;
 title: string;
 originalTitle: string | null;
 rating: number;
 thoughts: string;
 posterKey: string | null;
 posterSource: string | null;
 externalAnimeId: string | null;
 releaseYear: number | null;
 createdAt: string;
 updatedAt: string;
};
export type Anime = StoredAnime & { posterUrl: string | null };
export type Session = { hash: string; expiresAt: string };
export type Collection = {
 version: number;
 anime: StoredAnime[];
 imports: Record<string, string>;
 sessions: Session[];
 limits: Record<string, { attempts: number; resetsAt: string }>;
 cache: Record<string, { expiresAt: string; data: unknown }>;
};

export const DOC_PATHNAME = 'collection.json';
const POSTER_DIR = 'posters';

export function emptyCollection(): Collection {
 return { version: 0, anime: [], imports: {}, sessions: [], limits: {}, cache: {} };
}
export function toView(entry: StoredAnime): Anime {
 return { ...entry, posterUrl: entry.posterKey ? `/api/posters/${entry.posterKey}` : null };
}

function localDir(): string | null {
 if (process.env.NODE_ENV === 'production') return null; // Never trust an ephemeral deployment filesystem.
 const dir = process.env.DATA_DIR || 'data';
 return path.resolve(dir);
}
// Vercel Blob authenticates with either a read-write token or, on newer stores, BLOB_STORE_ID plus the runtime OIDC token.
function blobConfigured() { return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID); }
function blobDocPathname() { return DOC_PATHNAME; }
function blobPosterPathname(key: string) { return `${POSTER_DIR}/${key}`; }

type Snapshot = { doc: Collection | null; etag: string | null };

// A write must be conditioned on the object's true ETag. The ETag on a CDN response can differ in form
// from the one the Blob API checks (weak or encoding-suffixed once the document grows), which made every
// later write fail with "ETag mismatch". So when we intend to write, the ETag comes from head() (the API),
// and we only accept the read if the content provably belongs to that version.
async function readBlobForWrite(): Promise<Snapshot> {
 for (let attempt = 0; attempt < 3; attempt++) {
  let before;
  try { before = await head(blobDocPathname()); }
  catch (error) { if (error instanceof BlobNotFoundError) return { doc: null, etag: null }; throw error; }
  const found = await get(blobDocPathname(), { access: 'private', useCache: false });
  if (!found) continue;
  const text = await new Response(found.stream).text();
  let after;
  try { after = await head(blobDocPathname()); }
  catch (error) { if (error instanceof BlobNotFoundError) continue; throw error; }
  // Same version before and after the read, and the bytes we read are the bytes of that version.
  if (after.etag === before.etag && Buffer.byteLength(text, 'utf8') === before.size) return { doc: parseCollection(text), etag: before.etag };
 }
 throw new Error('Stored collection kept changing while reading');
}

async function readSnapshot(forWrite = false): Promise<Snapshot> {
 const dir = localDir();
 if (dir) {
  try {
   const text = await readFile(path.join(dir, DOC_PATHNAME), 'utf8');
   return { doc: parseCollection(text), etag: null };
  } catch (error) {
   if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { doc: null, etag: null };
   throw error;
  }
 }
 if (!blobConfigured()) throw new Error('Storage not configured');
 if (forWrite) return readBlobForWrite();
 const found = await get(blobDocPathname(), { access: 'private', useCache: false });
 if (!found) return { doc: null, etag: null };
 const text = await new Response(found.stream).text();
 return { doc: parseCollection(text), etag: null };
}

function parseCollection(text: string): Collection {
 let value: unknown;
 try { value = JSON.parse(text); } catch { throw new Error('Stored collection is unreadable'); }
 const doc = value as Partial<Collection>;
 const base = emptyCollection();
 return {
  version: Number(doc.version) || 0,
  anime: Array.isArray(doc.anime) ? doc.anime as StoredAnime[] : base.anime,
  imports: doc.imports && typeof doc.imports === 'object' ? doc.imports as Record<string, string> : {},
  sessions: Array.isArray(doc.sessions) ? doc.sessions as Session[] : [],
  limits: doc.limits && typeof doc.limits === 'object' ? doc.limits as Collection['limits'] : {},
  cache: doc.cache && typeof doc.cache === 'object' ? doc.cache as Collection['cache'] : {},
 };
}

async function writeSnapshot(doc: Collection, etag: string | null): Promise<void> {
 doc.version += 1;
 const body = JSON.stringify(doc);
 const dir = localDir();
 if (dir) {
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, DOC_PATHNAME);
  const temporary = `${target}.${createHash('sha1').update(body).digest('hex')}.tmp`;
  await writeFile(temporary, body, 'utf8');
  await rename(temporary, target); // Atomic replace within the same directory.
  return;
 }
 if (!blobConfigured()) throw new Error('Storage not configured');
 const options = etag === null
  ? { access: 'private' as const, contentType: 'application/json', allowOverwrite: false }
  : { access: 'private' as const, contentType: 'application/json', allowOverwrite: true, ifMatch: etag };
 await put(blobDocPathname(), body, options);
}

// Serialize read-modify-write inside this process; Blob's ETag guards across processes.
let queue: Promise<unknown> = Promise.resolve();
export async function mutate<T>(change: (doc: Collection) => Promise<T> | T): Promise<T> {
 const task = queue.then(async () => {
  for (let attempt = 1; ; attempt++) {
   const before = await readSnapshot(true);
   const doc = before.doc ?? emptyCollection();
   const result = await change(doc);
   try { await writeSnapshot(doc, before.etag); return result; }
   catch (error) {
    const conflicting = error instanceof BlobPreconditionFailedError || (error as NodeJS.ErrnoException)?.code === 'EPERM';
    if (!conflicting || attempt >= 4) throw error;
   }
  }
 });
 queue = task.catch(() => undefined);
 return task;
}
export async function readCollection(): Promise<Collection> {
 return (await readSnapshot()).doc ?? emptyCollection();
}
export async function resetCollection(doc: Collection = emptyCollection()): Promise<void> {
 const dir = localDir();
 if (dir) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, DOC_PATHNAME), JSON.stringify({ ...doc, version: 0 }), 'utf8');
  await mkdir(path.join(dir, POSTER_DIR), { recursive: true });
  return;
 }
 if (!blobConfigured()) throw new Error('Storage not configured');
 await put(blobDocPathname(), JSON.stringify({ ...doc, version: 0 }), { access: 'private', contentType: 'application/json', allowOverwrite: true });
}

export function posterKeyFor(bytes: Buffer) { return `${createHash('sha256').update(bytes).digest('hex')}.webp`; }
export async function posterExists(key: string): Promise<boolean> {
 if (!/^[a-f0-9]{64}\.webp$/.test(key)) return false;
 const dir = localDir();
 if (dir) { try { await access(path.join(dir, POSTER_DIR, key)); return true; } catch { return false; } }
 if (!blobConfigured()) throw new Error('Storage not configured');
 try { return !!(await head(blobPosterPathname(key))); }
 catch (error) { if (error instanceof BlobNotFoundError) return false; throw error; } // head() throws, not returns null, for a missing blob.
}
export async function writePoster(key: string, bytes: Buffer): Promise<void> {
 const dir = localDir();
 if (dir) {
  await mkdir(path.join(dir, POSTER_DIR), { recursive: true });
  await writeFile(path.join(dir, POSTER_DIR, key), bytes);
  return;
 }
 if (!blobConfigured()) throw new Error('Storage not configured');
 await put(blobPosterPathname(key), bytes, { access: 'private', contentType: 'image/webp', allowOverwrite: true, cacheControlMaxAge: 31536000 });
}
export async function readPosterFile(key: string): Promise<Buffer | null> {
 if (!/^[a-f0-9]{64}\.webp$/.test(key)) return null;
 const dir = localDir();
 if (dir) {
  try { return await readFile(path.join(dir, POSTER_DIR, key)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
 }
 if (!blobConfigured()) throw new Error('Storage not configured');
 const found = await get(blobPosterPathname(key), { access: 'private' });
 if (!found) return null;
 return Buffer.from(await new Response(found.stream).arrayBuffer());
}
export async function deletePoster(key: string): Promise<void> {
 if (!/^[a-f0-9]{64}\.webp$/.test(key)) return;
 const dir = localDir();
 if (dir) return;
 if (!blobConfigured()) return;
 await del(blobPosterPathname(key));
}