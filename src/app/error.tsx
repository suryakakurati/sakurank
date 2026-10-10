'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="empty"><p role="alert">Unable to load</p><button onClick={reset}>Retry</button></div>;}
