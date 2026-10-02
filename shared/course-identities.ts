/** Stable aliases for the owner's original course titles. No synthetic public records. */
export const courseIdentities = [
 {slug:'quran-reading',title:'Quran Reading for Beginners',aliases:['Qur’an Reading & Recitation','Quran Reading & Recitation','quran-reading-recitation']},
 {slug:'tajweed',title:'Advanced Tajweed Rules',aliases:['Tajweed & Correction','tajweed-correction']},
 {slug:'hifz',title:'Quran Memorization (Hifz)',aliases:['quran-memorization']},
 {slug:'arabic',title:'Arabic Language Mastery',aliases:['Arabic Language','arabic-language']},
 {slug:'basics-of-islam',title:'Basics of Islam',aliases:[]},
 {slug:'fiqh',title:'Islamic Jurisprudence (Fiqh)',aliases:['islamic-jurisprudence']},
 {slug:'on-demand',title:'On-demand Course',aliases:['on-demand-course']},
 {slug:'tafsir',title:'Tafsir & Tadabbur',aliases:['tafsir-tadabbur']},
 {slug:'hadith',title:'Prophetic Hadith',aliases:['prophetic-hadith']},
] as const;
export function courseIdentity(value:string){return courseIdentities.find(c=>c.title===value||c.slug===value||(c.aliases as readonly string[]).includes(value));}
