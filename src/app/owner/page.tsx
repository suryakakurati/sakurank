import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { isOwner } from '@/lib/auth';
import { Collection } from '@/components/collection';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Owner(){if(!await isOwner())redirect('/');return <Suspense fallback={<div className="empty">Loading…</div>}><Collection manage/></Suspense>;}
