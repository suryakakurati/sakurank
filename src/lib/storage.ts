import sharp from 'sharp';
import { HttpError } from './auth';
import { posterExists, posterKeyFor, readPosterFile, writePoster } from './store';
export async function optimizePoster(input: Buffer) {
 if (input.length > 3000000) throw new HttpError(413, 'Image must be under 3 MB');
 try {
  const image = sharp(input, { limitInputPixels: 25000000, animated: false });
  const meta = await image.metadata();
  if (!['jpeg','png','webp','avif'].includes(meta.format || '') || (meta.pages ?? 1) > 1) throw new Error();
  return await image.rotate().resize({ width: 600, height: 900, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
 } catch { throw new HttpError(400, 'Use a valid JPEG, PNG, WebP, or AVIF image'); }
}
export async function savePoster(input: Buffer) {
 const buffer = await optimizePoster(input);
 const key = posterKeyFor(buffer);
 if (!await posterExists(key)) await writePoster(key, buffer);
 return key;
}
export async function readPoster(key: string) {
 const bytes = await readPosterFile(key);
 if (!bytes) throw new HttpError(404, 'Poster not found');
 return bytes;
}
