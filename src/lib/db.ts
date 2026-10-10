import { randomUUID } from 'node:crypto';
import { HttpError } from './auth';
import { emptyCollection, mutate, readCollection, toView, type Anime, type StoredAnime } from './store';
export type { Anime, StoredAnime };

export function viewAll(entries: StoredAnime[]): Anime[] { return entries.map(toView); }
export function viewOne(entry: StoredAnime): Anime { return toView(entry); }

export async function listAnime(): Promise<StoredAnime[]> { return (await readCollection()).anime; }
export async function findAnime(id: string): Promise<StoredAnime | undefined> {
 return (await readCollection()).anime.find(entry => entry.id === id);
}
export type EntryInput = {
 title: string; originalTitle?: string | null; rating: number; thoughts: string;
 posterKey: string | null; posterSource: string | null; externalAnimeId?: string | null; releaseYear?: number | null;
};
function fields(input: EntryInput) {
 return {
  title: input.title, originalTitle: input.originalTitle ?? null, rating: input.rating, thoughts: input.thoughts,
  posterKey: input.posterKey, posterSource: input.posterSource,
  externalAnimeId: input.externalAnimeId ?? null, releaseYear: input.releaseYear ?? null,
 };
}
export async function createAnime(input: EntryInput): Promise<StoredAnime> {
 return mutate(doc => {
  const values = fields(input);
  if (values.externalAnimeId && doc.anime.some(entry => entry.externalAnimeId === values.externalAnimeId)) throw new HttpError(409, 'Anime already exists');
  const now = new Date().toISOString();
  const entry: StoredAnime = { id: randomUUID(), ...values, createdAt: now, updatedAt: now };
  doc.anime.push(entry);
  return entry;
 });
}
export async function updateAnime(id: string, input: EntryInput, expectedUpdatedAt: string): Promise<StoredAnime> {
 return mutate(doc => {
  const values = fields(input);
  const entry = doc.anime.find(item => item.id === id);
  if (!entry) throw new HttpError(404, 'Anime not found');
  if (entry.updatedAt !== expectedUpdatedAt) throw new HttpError(409, 'Entry changed. Reload before saving.');
  if (values.externalAnimeId && doc.anime.some(item => item.id !== id && item.externalAnimeId === values.externalAnimeId)) throw new HttpError(409, 'Anime already exists');
  Object.assign(entry, values, { updatedAt: new Date().toISOString() });
  return entry;
 });
}
export async function removeAnime(id: string): Promise<boolean> {
 return mutate(doc => {
  const index = doc.anime.findIndex(item => item.id === id);
  if (index < 0) return false;
  doc.anime.splice(index, 1);
  return true;
 });
}
export async function resetForTests(): Promise<void> { await mutate(doc => Object.assign(doc, emptyCollection())); }
