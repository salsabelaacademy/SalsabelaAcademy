/** Original, locally hosted Bootstrap Icons (MIT); no generated icon artwork. */
type IconName = 'person-video3'|'globe2'|'journal-bookmark-fill'|'book-half'|'calendar2-week'|'heart-fill'|'patch-check-fill'|'question-circle-fill';
export function FeatureIcon({number=1,name,compact=false}:{number?:number;name?:IconName;compact?:boolean}){
 const icon=name||(['person-video3','globe2','journal-bookmark-fill'] as const)[(number-1)%3];
 return <span className={`academy-feature-symbol${compact?' academy-feature-symbol--compact':''}`} aria-hidden="true"><span style={{maskImage:`url(/icons/bootstrap/${icon}.svg)`,WebkitMaskImage:`url(/icons/bootstrap/${icon}.svg)`}} /></span>;
}
