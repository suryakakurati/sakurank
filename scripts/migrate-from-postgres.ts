import nextEnv from '@next/env';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { mutate, type StoredAnime } from '../src/lib/store';
nextEnv.loadEnvConfig(process.cwd());

const database = process.env.DATABASE_URL;
if (!database) throw new Error('DATABASE_URL from the previous PostgreSQL setup is required');
const source = process.env.LOCAL_POSTER_DIR || '.local/posters';
const psql = (sql: string) => execFileSync('psql', [database, '-At', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const rows = psql('SELECT row_to_json(a)::text FROM anime a ORDER BY created_at');
const existing: StoredAnime[] = rows ? rows.split('\n').map(line => {
 const row = JSON.parse(line) as Record<string, unknown>;
 return {
  id: String(row.id), title: String(row.title), originalTitle: (row.original_title as string) ?? null,
  rating: Number(row.rating), thoughts: String(row.thoughts ?? ''), posterKey: (row.poster_key as string) ?? null,
  posterSource: (row.poster_source as string) ?? null, externalAnimeId: (row.external_anime_id as string) ?? null,
  releaseYear: (row.release_year as number) ?? null,
  createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString(),
 };
}) : [];

const imports: Record<string, string> = {};
let importRows = '';
try { importRows = psql('SELECT external_anime_id || E\'\\t\' || poster_key FROM poster_imports'); } catch { /* table may not exist */ }
for (const line of importRows ? importRows.split('\n') : []) {
 const [id, key] = line.split('\t');
 if (id && key) imports[id] = key;
}

const keys = new Set<string>();
for (const entry of existing) if (entry.posterKey) keys.add(entry.posterKey);
for (const key of Object.values(imports)) keys.add(key);
for (const key of keys) {
 const from = path.join(source, key);
 try { await access(from); } catch { console.warn(`Poster file missing: ${from}`); continue; }
 await mkdir(path.join('data', 'posters'), { recursive: true });
 await copyFile(from, path.join('data', 'posters', key));
}

await mutate(doc => {
 for (const entry of existing) if (!doc.anime.some(item => item.id === entry.id)) doc.anime.push(entry);
 for (const [id, key] of Object.entries(imports)) doc.imports[id] ??= key;
});
console.log(`Migrated ${existing.length} entry/entries and ${Object.keys(imports).length} cover mapping(s) into data/collection.json. The old database was left untouched.`);
