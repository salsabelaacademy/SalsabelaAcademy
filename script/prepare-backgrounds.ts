import { access, mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { resolve } from 'node:path';

// Optional local photos only: never request an external URL at runtime/build.
const variants=['courses','pricing','journal','journey','contact'] as const;
const directory=resolve('client/public/images');
const manifest: Record<string,{src:string;width:number;height:number}>={};
await mkdir(directory,{recursive:true});
for(const variant of variants){
 const stem='page-'+variant;
 let input:string|undefined;
 for(const ext of ['jpg','jpeg','png','webp']){
  const path=resolve(directory,stem+'.'+ext);
  try{await access(path);input=path;break;}catch{/* An absent optional asset is expected. */}
 }
 if(!input)continue;
 const output=resolve(directory,stem+'-optimized.webp');
 await sharp(input,{limitInputPixels:40_000_000}).rotate().resize({width:1600,withoutEnlargement:true}).webp({quality:78}).toFile(output);
 const metadata=await sharp(output).metadata();
 manifest[variant]={src:'/images/'+stem+'-optimized.webp',width:metadata.width!,height:metadata.height!};
}
await writeFile('client/src/lib/page-backgrounds.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Local page backgrounds prepared: ${Object.keys(manifest).length}/5. Other pages retain the local mosque photo.`);
