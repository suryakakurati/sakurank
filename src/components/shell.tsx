'use client';
import Link from 'next/link';
import { createContext,useContext,useState,useEffect,useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from './dialog';
const OwnerContext=createContext({owner:false,refresh:()=>{}});
export const useOwner=()=>useContext(OwnerContext);
export async function api<T>(url:string,options?:RequestInit):Promise<T> {
 const response=await fetch(url,{...options,headers:{...(options?.body instanceof File?{}:{'Content-Type':'application/json'}),...options?.headers},cache:'no-store'});
 const data=await response.json(); if(!response.ok)throw new Error(data.error||'Request failed');return data;
}
export function Shell({children}:{children:React.ReactNode}) {
 const [owner,setOwner]=useState(false),[login,setLogin]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const clicks=useRef<number[]>([]);const router=useRouter();
 async function refresh(){try{const result=await api<{authenticated:boolean}>('/api/auth');setOwner(result.authenticated);}catch{setOwner(false);}}
 useEffect(()=>{void refresh();},[]);
 function enter(){const now=Date.now();clicks.current=[...clicks.current.filter(t=>now-t<3000),now];if(clicks.current.length>=5){clicks.current=[];setError('');if(owner)router.push('/owner');else setLogin(true);}}
 async function logout(){setBusy(true);try{await api('/api/auth',{method:'DELETE'});setOwner(false);router.push('/');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <OwnerContext.Provider value={{owner,refresh}}><div className="night-backdrop" aria-hidden="true"/><header className="site-header"><Link className="wordmark" href="/" prefetch={false}>sakurank<span className="wordmark-petal" aria-hidden="true">✿</span></Link>{owner&&<nav aria-label="Owner"><Link href="/owner">Edit collection</Link><button className="quiet" disabled={busy} onClick={logout}>Log out</button></nav>}</header><main>{children}</main><footer><button className="secret-flower" aria-label="Owner access" onClick={enter}>✿</button></footer>{error&&!login&&<p className="global-error" role="alert">{error}</p>}{login&&<Dialog title="Owner login" onClose={()=>setLogin(false)}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const password=String(new FormData(e.currentTarget).get('password'));try{await api('/api/auth',{method:'POST',body:JSON.stringify({password})});setOwner(true);setLogin(false);router.push('/owner');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Password<input autoFocus name="password" type="password" autoComplete="current-password" required maxLength={1024}/></label>{error&&<p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy} type="submit">{busy?'Signing in…':'Sign in'}</button></form></Dialog>}</OwnerContext.Provider>;
}
