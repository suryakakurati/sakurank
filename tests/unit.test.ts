import {describe,it,expect} from 'vitest';
import {scryptSync} from 'node:crypto';
import {entrySchema,collectionQuery} from '../src/lib/validation';
import {assertOrigin,verifyPassword} from '../src/lib/auth';
import {posterHost} from '../src/lib/metadata';
import {optimizePoster} from '../src/lib/storage';
import sharp from 'sharp';
describe('validation',()=>{
 for(const rating of [0,-1,11,1.5,null,'8',NaN])it(`rejects rating ${rating}`,()=>expect(entrySchema.safeParse({title:'Test',rating}).success).toBe(false));
 for(const rating of [1,10])it(`accepts rating ${rating}`,()=>expect(entrySchema.parse({title:'Test',rating}).rating).toBe(rating));
 it('preserves thoughts exactly',()=>{const thoughts='  line one\n\nline two  ';expect(entrySchema.parse({title:'Test',rating:5,thoughts}).thoughts).toBe(thoughts);});
 it('rejects remote paths and unknown fields',()=>{expect(entrySchema.safeParse({title:'Test',rating:5,posterKey:'../../secret'}).success).toBe(false);expect(entrySchema.safeParse({title:'Test',rating:5,admin:true}).success).toBe(false);});
 it('accepts search, sort, and page while rejecting invalid sort parameters',()=>{expect(collectionQuery(new URLSearchParams('q=Moon&sort=title&page=2'))).toEqual({q:'Moon',sort:'title',page:2});expect(()=>collectionQuery(new URLSearchParams('sort=DROP TABLE anime'))).toThrow();});
});
describe('security',()=>{
 it('verifies scrypt passwords',async()=>{const salt='0123456789abcdef0123456789abcdef';const hash=scryptSync('correct password',salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex');expect(await verifyPassword('correct password',`scrypt:${salt}:${hash}`)).toBe(true);expect(await verifyPassword('wrong',`scrypt:${salt}:${hash}`)).toBe(false);});
 it('fails closed for missing credentials',async()=>{await expect(verifyPassword('anything','')).rejects.toThrow();});
 it('requires the exact configured origin',()=>{process.env.APP_ORIGIN='https://sakurank.example';expect(()=>assertOrigin(new Request('https://sakurank.example',{headers:{origin:'https://evil.example'}}))).toThrow();expect(()=>assertOrigin(new Request('https://sakurank.example'))).toThrow();expect(()=>assertOrigin(new Request('https://sakurank.example',{headers:{origin:'https://sakurank.example'}}))).not.toThrow();});
 it('restricts poster hosts',()=>{for(const value of ['http://media.kitsu.app/a','https://127.0.0.1/a','https://media.kitsu.app.evil/a','https://u:p@media.kitsu.app/a'])expect(posterHost(new URL(value))).toBe(false);expect(posterHost(new URL('https://media.kitsu.app/a'))).toBe(true);});
 it('rejects SVG and malformed images',async()=>{await expect(optimizePoster(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).rejects.toThrow();await expect(optimizePoster(Buffer.from('invalid'))).rejects.toThrow();});
 it('optimizes raster images without distorting them',async()=>{const input=await sharp({create:{width:1000,height:1500,channels:3,background:'#282038'}}).png().toBuffer();const result=await optimizePoster(input);const meta=await sharp(result).metadata();expect(meta.format).toBe('webp');expect(meta.width).toBe(600);expect(meta.height).toBe(900);});
});
