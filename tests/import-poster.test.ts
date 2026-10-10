import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({imports:{} as Record<string,string>,exists:true,download:vi.fn(),save:vi.fn()}));
vi.mock('../src/lib/store',()=>({
 mutate:(change:(doc:{imports:Record<string,string>})=>unknown)=>Promise.resolve(change(mocks)),
 readCollection:()=>Promise.resolve({imports:mocks.imports}),
 posterExists:()=>Promise.resolve(mocks.exists),
}));
vi.mock('../src/lib/metadata',()=>({providerPoster:mocks.download}));
vi.mock('../src/lib/storage',()=>({savePoster:mocks.save}));
import {importPoster,importedPosterKey} from '../src/lib/import-poster';
beforeEach(()=>{vi.resetAllMocks();mocks.imports={};mocks.exists=true;});
describe('automatic cover storage',()=>{
 it('reuses a stored cover without calling provider or storage',async()=>{mocks.imports['kitsu:46474']='cached.webp';expect(await importPoster('kitsu:46474')).toBe('cached.webp');expect(mocks.download).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();});
 it('downloads the selected cover, persists it and records the mapping',async()=>{const data=Buffer.from('image bytes');mocks.download.mockResolvedValue(data);mocks.save.mockResolvedValue('saved.webp');expect(await importPoster('kitsu:46474')).toBe('saved.webp');expect(mocks.download).toHaveBeenCalledWith('kitsu:46474');expect(mocks.save).toHaveBeenCalledWith(data);expect(mocks.imports['kitsu:46474']).toBe('saved.webp');});
 it('rejects arbitrary URLs before any request',async()=>{await expect(importPoster('https://127.0.0.1/private')).rejects.toThrow('Invalid anime');expect(mocks.download).not.toHaveBeenCalled();});
 it('reports failed downloads rather than caching an error',async()=>{mocks.download.mockRejectedValue(new Error('Poster unavailable'));await expect(importPoster('kitsu:46474')).rejects.toThrow('Poster unavailable');expect(mocks.save).not.toHaveBeenCalled();expect(mocks.imports['kitsu:46474']).toBeUndefined();});
 it('does not cache a failed storage operation',async()=>{mocks.download.mockResolvedValue(Buffer.from('bytes'));mocks.save.mockRejectedValue(new Error('Storage unavailable'));await expect(importPoster('kitsu:46474')).rejects.toThrow('Storage unavailable');expect(mocks.imports['kitsu:46474']).toBeUndefined();});
 it('reports no import for unknown entries',async()=>{expect(await importedPosterKey('kitsu:1')).toBeNull();});
 it('re-downloads when a cached mapping points at a missing file',async()=>{mocks.imports['kitsu:46474']='cached.webp';mocks.exists=false;mocks.download.mockResolvedValue(Buffer.from('fresh'));mocks.save.mockResolvedValue('fresh.webp');expect(await importPoster('kitsu:46474')).toBe('fresh.webp');expect(mocks.download).toHaveBeenCalledTimes(1);});
});
