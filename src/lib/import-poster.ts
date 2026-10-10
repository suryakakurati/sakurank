import { HttpError } from './auth';
import { providerPoster } from './metadata';
import { savePoster } from './storage';
import { mutate, posterExists, readCollection } from './store';
export async function importedPosterKey(id: string): Promise<string | null> {
 return (await readCollection()).imports[id] ?? null;
}
export async function importPoster(id: string) {
 if (!/^kitsu:\d{1,12}$/.test(id)) throw new HttpError(400, 'Invalid anime');
 const existing = await importedPosterKey(id);
 if (existing && await posterExists(existing)) return existing;
 const key = await savePoster(await providerPoster(id));
 await mutate(doc => { doc.imports[id] = key; });
 return key;
}
