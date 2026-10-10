import { z } from 'zod';
export const entrySchema = z.object({
 title: z.string().trim().min(1).max(200),
 originalTitle: z.string().max(200).nullable().optional(),
 rating: z.number().int().min(1).max(10),
 thoughts: z.string().max(50000).default(''),
 posterKey: z.string().regex(/^[a-f0-9]{64}\.webp$/).nullable().optional(),
 externalAnimeId: z.string().regex(/^kitsu:\d{1,12}$/).nullable().optional(),
 releaseYear: z.number().int().min(1900).max(2200).nullable().optional(),
 importPoster: z.boolean().default(false),
 updatedAt: z.iso.datetime().optional()
}).strict();
export const uuid = z.uuid();
export function collectionQuery(params: URLSearchParams) {
 return z.object({ q: z.string().max(200), sort: z.enum(['highest','lowest','title','recent']), page: z.coerce.number().int().min(1).max(100000) }).parse({ q: params.get('q') ?? '', sort: params.get('sort') ?? 'highest', page: params.get('page') ?? 1 });
}
