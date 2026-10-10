import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import {rm} from 'node:fs/promises';
import {emptyCollection,mutate,readCollection,readPosterFile,writePoster,posterKeyFor,posterExists} from '../src/lib/store';
const dir='.local/unit-data';
beforeEach(async()=>{process.env.DATA_DIR=dir;await rm(dir,{recursive:true,force:true});});
afterEach(async()=>{await rm(dir,{recursive:true,force:true});});
describe('collection document store',()=>{
 it('creates the document on first write and round-trips entries',async()=>{
  expect((await readCollection()).anime).toHaveLength(0);
  await mutate(doc=>{doc.anime.push({id:'one',title:'Alpha',originalTitle:null,rating:8,thoughts:'line1\nline2',posterKey:null,posterSource:null,externalAnimeId:null,releaseYear:2020,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'});});
  const doc=await readCollection();expect(doc.anime).toHaveLength(1);expect(doc.anime[0].thoughts).toBe('line1\nline2');expect(doc.version).toBe(1);
 });
 it('serializes concurrent updates without losing writes',async()=>{
  await Promise.all(Array.from({length:20},(_,i)=>mutate(doc=>{doc.anime.push({id:`n${i}`,title:`T${i}`,originalTitle:null,rating:5,thoughts:'',posterKey:null,posterSource:null,externalAnimeId:null,releaseYear:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});})));
  expect((await readCollection()).anime).toHaveLength(20);
 });
 it('writes and reads poster bytes and deduplicates by content hash',async()=>{
  const bytes=Buffer.from('poster bytes');const key=posterKeyFor(bytes);
  expect(await posterExists(key)).toBe(false);
  await writePoster(key,bytes);expect(await posterExists(key)).toBe(true);expect(await readPosterFile(key)).toEqual(bytes);
  expect(posterKeyFor(bytes)).toBe(key);
 });
 it('returns null for unknown or malformed posters',async()=>{expect(await readPosterFile('a'.repeat(64)+'.webp')).toBeNull();expect(await readPosterFile('../../etc/passwd')).toBeNull();expect(await posterExists('../escape')).toBe(false);});
});
