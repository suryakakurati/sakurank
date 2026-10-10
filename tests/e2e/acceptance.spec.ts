import {test,expect} from '@playwright/test';
import sharp from 'sharp';
import {createHmac} from 'node:crypto';
import {mkdir,rm,writeFile} from 'node:fs/promises';
const origin={Origin:'http://localhost:3100'};
const password='test-owner-password-only';
const dataDir=process.env.DATA_DIR!;
const emptyDoc=()=>({version:0,anime:[],imports:{},sessions:[],limits:{},cache:{}});
async function writeDoc(doc:unknown){await mkdir(dataDir,{recursive:true});await writeFile(`${dataDir}/collection.json`,JSON.stringify(doc));}
async function posterFile(key:string,colour='#9886D9'){const bytes=await sharp({create:{width:200,height:300,channels:3,background:colour}}).webp().toBuffer();await mkdir(`${dataDir}/posters`,{recursive:true});await writeFile(`${dataDir}/posters/${key}`,bytes);}
function sessionHash(token:string){return createHmac('sha256',process.env.SESSION_SECRET!).update(token).digest('hex');}
test.beforeEach(async()=>{await rm(dataDir,{recursive:true,force:true});await mkdir(`${dataDir}/posters`,{recursive:true});await writeDoc(emptyDoc());});
async function openLogin(page:import('@playwright/test').Page){for(let i=0;i<5;i++)await page.getByRole('button',{name:'Owner access'}).click();await expect(page.getByRole('dialog',{name:'Owner login'})).toBeVisible();}
async function login(request:import('@playwright/test').APIRequestContext){const response=await request.post('/api/auth',{headers:origin,data:{password}});expect(response.status()).toBe(200);return (await request.storageState()).cookies.find(c=>c.name==='sakurank_session')!;}
test('public empty collection and hidden keyboard login',async({page})=>{
 await page.goto('/');await expect(page.getByText('No anime',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Edit collection'})).toHaveCount(0);
 const access=page.getByRole('button',{name:'Owner access'});await access.focus();for(let i=0;i<5;i++)await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Owner login'});await expect(dialog).toBeVisible();await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(dialog.getByRole('alert')).toHaveText('Invalid password');
 await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL('/owner');await expect(page.getByRole('button',{name:'Add anime'})).toBeVisible();
 await page.getByRole('button',{name:'Log out'}).click();await expect(page).toHaveURL('/');await expect(page.getByRole('link',{name:'Edit collection'})).toHaveCount(0);
});
test('direct mutations require authentication and same-origin; logout and expiry revoke sessions',async({request})=>{
 const id='00000000-0000-4000-8000-000000000001';
 expect((await request.post('/api/anime',{headers:origin,data:{title:'Test',rating:5}})).status()).toBe(401);
 expect((await request.put(`/api/anime/${id}`,{headers:origin,data:{title:'Test',rating:5}})).status()).toBe(401);
 expect((await request.delete(`/api/anime/${id}`,{headers:origin,data:{confirm:true}})).status()).toBe(401);
 expect((await request.post('/api/posters',{headers:origin,data:'image'})).status()).toBe(401);
 expect((await request.get('/api/metadata?q=Frieren')).status()).toBe(401);
 const cookie=await login(request);
 expect((await request.post('/api/anime',{headers:{Origin:'https://evil.example'},data:{title:'Test',rating:5}})).status()).toBe(403);
 expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('Strict');
 await writeDoc({...emptyDoc(),sessions:[{hash:sessionHash(cookie.value),expiresAt:new Date(Date.now()-1000).toISOString()}]});
 expect((await request.post('/api/anime',{headers:origin,data:{title:'Test',rating:5}})).status()).toBe(401);
 await login(request);const revoked=cookie.value;
 expect((await request.delete('/api/auth',{headers:origin})).status()).toBe(200);
 expect((await request.post('/api/anime',{headers:{...origin,Cookie:`sakurank_session=${revoked}`},data:{title:'Test',rating:5}})).status()).toBe(401);
});
test('store validates ratings, duplicates, conflicts and confirmed deletion',async({request})=>{
 await login(request);
 for(const rating of [0,11,1.5,null,'8'])expect((await request.post('/api/anime',{headers:origin,data:{title:'Test',rating}})).status()).toBe(400);
 const create=await request.post('/api/anime',{headers:origin,data:{title:'Frieren: Beyond Journey’s End',rating:9,thoughts:'  First paragraph\n\nSecond paragraph.  ',externalAnimeId:'kitsu:46474'}});expect(create.status()).toBe(201);const entry=await create.json();
 expect((await request.post('/api/anime',{headers:origin,data:{title:entry.title,rating:8,externalAnimeId:entry.externalAnimeId}})).status()).toBe(409);
 const update={title:entry.title,rating:10,thoughts:entry.thoughts,externalAnimeId:entry.externalAnimeId,updatedAt:entry.updatedAt};
 expect((await request.put(`/api/anime/${entry.id}`,{headers:origin,data:update})).status()).toBe(200);
 expect((await request.put(`/api/anime/${entry.id}`,{headers:origin,data:update})).status()).toBe(409);
 const saved=await (await request.get(`/api/anime/${entry.id}`)).json();expect(saved.rating).toBe(10);expect(saved.thoughts).toBe(entry.thoughts);expect(JSON.stringify(saved)).not.toMatch(/password|sessions|SESSION_SECRET/);
 expect((await request.delete(`/api/anime/${entry.id}`,{headers:origin,data:{}})).status()).toBe(400);
 expect((await request.delete(`/api/anime/${entry.id}`,{headers:origin,data:{confirm:true}})).status()).toBe(200);expect((await request.get(`/api/anime/${entry.id}`)).status()).toBe(404);
});
test('browser add, cover, preview, edit, exact thoughts and delete',async({page})=>{
 await page.goto('/');await openLogin(page);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL('/owner');await page.getByRole('button',{name:'Add anime'}).click();
 await page.getByLabel('Title',{exact:true}).fill('Acceptance test entry');await page.getByLabel('Rating',{exact:true}).selectOption('8');const thoughts='  First paragraph.\n\nSecond paragraph.  ';await page.getByLabel('Thoughts',{exact:true}).fill(thoughts);
 const image=await sharp({create:{width:200,height:300,channels:3,background:'#C9A5F2'}}).png().toBuffer();await page.getByLabel('Upload poster').setInputFiles({name:'test.png',mimeType:'image/png',buffer:image});await expect(page.locator('.editor-grid img')).toBeVisible();
 await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('.preview-thoughts')).toHaveText(thoughts);await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();const card=page.locator('.anime-card');await expect(card).toHaveCount(1);const src=await card.locator('img').getAttribute('src');expect(src).toMatch(/^\/api\/posters\//);expect((await page.request.get(src!)).status()).toBe(200);
 await card.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Rating',{exact:true}).selectOption('10');await page.getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await expect(card.locator('.card-rating')).toHaveText('10/10');
 await card.getByRole('link').click();await expect(page.locator('.thoughts>div')).toHaveText(thoughts);await expect(page.locator('.detail-rating')).toHaveText('10/10');
 await page.getByRole('link',{name:'Edit collection'}).click();
 await page.getByRole('button',{name:'Delete',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Delete Acceptance test entry?'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.anime-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Delete',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();
 await expect(page.getByText('No anime',{exact:true})).toBeVisible();
});
test('search, sorting, mobile layout and broken-image fallback',async({page,request})=>{
 await login(request);for(const entry of [{title:'Zeta',rating:3},{title:'Alpha',rating:10},{title:'Alpha film',rating:6}])expect((await request.post('/api/anime',{headers:origin,data:entry})).status()).toBe(201);
 expect((await request.post('/api/anime',{headers:origin,data:{title:'Missing cover',rating:4,posterKey:'a'.repeat(64)+'.webp'}})).status()).toBe(201);
 await page.setViewportSize({width:375,height:812});await page.goto('/');await expect(page.locator('.anime-card')).toHaveCount(4);await expect(page.locator('.anime-card h2').first()).toHaveText('Alpha');
 expect(await page.getByLabel('Minimum rating').count()).toBe(0);expect(await page.getByLabel('Maximum rating').count()).toBe(0);
 await page.getByLabel('Search anime',{exact:true}).fill('Alpha');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.locator('.anime-card')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Clear search'}).click();await page.getByLabel('Sort',{exact:true}).selectOption('lowest');await expect(page.locator('.anime-card h2').first()).toHaveText('Zeta');await expect(page.locator('.anime-card').nth(1)).toHaveText(/Missing cover/);await page.getByLabel('Sort',{exact:true}).selectOption('title');await expect(page.locator('.anime-card h2').first()).toHaveText('Alpha');
 await expect(page.locator('.poster-fallback')).toHaveCount(4);await expect(page.locator('.anime-card img')).toHaveCount(0);
 await page.getByLabel('Sort',{exact:true}).selectOption('recent');await page.setViewportSize({width:1440,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('candidate selection automatically loads a stored cover and saves it',async({page,request})=>{
 const key='b'.repeat(64)+'.webp';await posterFile(key);
 const fixture={data:[{id:'46474',attributes:{titles:{en:'Frieren: Beyond Journey’s End',ja_jp:'葬送のフリーレン'},canonicalTitle:'Sousou no Frieren',startDate:'2023-09-29',posterImage:{large:'https://media.kitsu.app/anime/46474/poster_image/large.jpg'}}}]};
 await writeDoc({...emptyDoc(),imports:{'kitsu:46474':key},cache:{'kitsu:?filter[text]=Frieren&page[limit]=12':{expiresAt:new Date(Date.now()+3600000).toISOString(),data:fixture}}});
 await page.goto('/');await openLogin(page);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Add anime'}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Search anime',{exact:true}).fill('Frieren');await dialog.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Frieren: Beyond Journey’s End 2023'}).click();
 await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Frieren: Beyond Journey’s End');await expect(page.getByLabel('Release year')).toHaveValue('2023');
 await expect(page.locator('.editor-grid img')).toHaveAttribute('src',`/api/posters/${key}`);await page.waitForFunction(()=>{const image=document.querySelector('.editor-grid img') as HTMLImageElement|null;return !!image&&image.complete&&image.naturalWidth>0;});
 await page.getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await page.reload();await expect(page.locator('.anime-card img')).toHaveAttribute('src',`/api/posters/${key}`);
 expect((await request.post('/api/metadata/kitsu:46474/poster',{headers:origin})).status()).toBe(401);
});
test('global login rate limit rejects excessive attempts',async({request})=>{for(let i=0;i<20;i++)expect((await request.post('/api/auth',{headers:origin,data:{password:'wrong'}})).status()).toBe(401);expect((await request.post('/api/auth',{headers:origin,data:{password}})).status()).toBe(429);});
