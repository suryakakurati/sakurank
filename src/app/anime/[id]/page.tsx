import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findAnime, viewOne } from '@/lib/db';
import { uuid } from '@/lib/validation';
import { Poster } from '@/components/poster';
export const dynamic='force-dynamic';
export default async function Detail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.safeParse(id).success)notFound();const row=await findAnime(id);if(!row)notFound();const entry=viewOne(row);
 return <><Link className="back-link" href="/">← Collection</Link><article className="detail"><div className="detail-poster"><Poster src={entry.posterUrl} title={entry.title} eager/></div><div className="detail-content"><h1>{entry.title}</h1>{entry.releaseYear&&<p className="release-year">{entry.releaseYear}</p>}<div className="detail-rating" aria-label={`Rating ${entry.rating} out of 10`}>{entry.rating}<span>/10</span></div>{entry.thoughts&&<section className="thoughts"><h2>Thoughts</h2><div>{entry.thoughts}</div></section>}</div></article></>;
}
