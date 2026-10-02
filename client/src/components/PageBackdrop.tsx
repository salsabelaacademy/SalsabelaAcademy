import backgrounds from '@/lib/page-backgrounds.json';
type Variant='courses'|'pricing'|'journal'|'journey'|'contact';
/** Local photography fades into the surrounding surface; no external requests. */
export function PageBackdrop({variant='courses'}:{variant?:Variant}) {
 const images=backgrounds as Record<string,{src:string;width:number;height:number}>;
 const image=images[variant] || {src:'/images/home-mosque.webp',width:1600,height:2000};
 return <div className="academy-page-backdrop" data-backdrop={variant} aria-hidden="true"><img src={image.src} alt="" width={image.width} height={image.height} decoding="async" fetchPriority="low" /></div>;
}
