import { Suspense } from 'react';
import { Collection } from '@/components/collection';
export default function Home(){return <Suspense fallback={<div className="empty">Loading…</div>}><Collection/></Suspense>;}
