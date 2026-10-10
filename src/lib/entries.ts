import { entrySchema } from './validation';
import { HttpError } from './auth';
import { importPoster, importedPosterKey } from './import-poster';
export async function entryInput(body: unknown) {
 const data = entrySchema.parse(body);
 let posterKey = data.posterKey ?? null;
 let posterSource: string | null = null;
 if (data.importPoster) {
  if (!data.externalAnimeId) throw new HttpError(400,'Select an anime');
  posterKey = await importPoster(data.externalAnimeId);
  posterSource = `https://kitsu.app/anime/${data.externalAnimeId.split(':')[1]}`;
 }
 if (!posterSource && posterKey && data.externalAnimeId) {
  const stored = await importedPosterKey(data.externalAnimeId);
  if (stored === posterKey) posterSource = `https://kitsu.app/anime/${data.externalAnimeId.split(':')[1]}`;
 }
 return {...data,posterKey,posterSource};
}
