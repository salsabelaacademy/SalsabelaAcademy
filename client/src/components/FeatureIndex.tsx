import { useLanguage } from '@/hooks/use-language';
/** Editorial numbering replaces decorative stock-icon tiles. */
export function FeatureIndex({number,compact=false}:{number:number;compact?:boolean}){
 const {language}=useLanguage();
 return <span className={`academy-feature-index${compact?' academy-feature-index--compact':''}`} aria-hidden="true"><span>{new Intl.NumberFormat(language,{minimumIntegerDigits:2}).format(number)}</span><span className="academy-feature-rule"/></span>;
}
