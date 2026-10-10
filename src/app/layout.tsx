import type { Metadata } from 'next';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = { title: {default:'sakurank',template:'%s · sakurank'}, robots:{index:true,follow:true} };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body><Shell>{children}</Shell></body></html>; }
