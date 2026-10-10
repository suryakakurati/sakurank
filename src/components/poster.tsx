'use client';
import { useState,useEffect } from 'react';
export function Poster({src,title,eager=false}:{src:string|null;title:string;eager?:boolean}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 return <div className="poster">{src&&!failed?<img src={src} alt={`${title} poster`} loading={eager?'eager':'lazy'} decoding="async" onError={()=>setFailed(true)}/>:<div className="poster-fallback" role="img" aria-label={`${title}: poster unavailable`}><span aria-hidden="true">✿</span></div>}</div>;
}
