'use client';
import { useEffect,useRef } from 'react';
export function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ const previous=document.activeElement as HTMLElement|null; const dialog=ref.current!; dialog.showModal(); return ()=>{dialog.close();previous?.focus();}; },[]);
 return <dialog ref={ref} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="dialog-body"><button className="close-button quiet" aria-label="Close" onClick={onClose}>×</button>{children}</div></dialog>;
}
