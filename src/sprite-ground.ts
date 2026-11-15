import {buildingArt,type BuildingArt,type GroundPoint} from './building-art.js';
import {dimensions,type BuildingKind,type HouseTier} from './catalog.js';
import {fitGround} from './rendering.js';
const cache=new WeakMap<object,Map<string,BuildingArt>>();
const families=new WeakMap<object,Map<string,BuildingArt[]>>();
/** Measure actual ground contact, including steps, crates and barrels. Roofs
 * and upper foliage never define a building's ground footprint. No image warp. */
export function groundedArt(art:BuildingArt,source:HTMLImageElement):BuildingArt{
 if(art.livestock||art.texture==='farm-crops'||art.texture==='park-parts'||art.texture==='market-stalls'||art.land)return art;
 let entries=cache.get(source);if(!entries){entries=new Map();cache.set(source,entries);}
 const key=`${art.frame}:${art.columns}:${art.rows}:${art.sourceRect?.join(',')??''}`;const old=entries.get(key);if(old)return old;
 const [sx,sy,sw,sh]=art.sourceRect??[Math.floor(art.frame%art.columns*source.width/art.columns),Math.floor(Math.floor(art.frame/art.columns)*source.height/art.rows),Math.floor(source.width/art.columns),Math.floor(source.height/art.rows)];
 const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,sx,sy,sw,sh,0,0,sw,sh);
 const pixels=ctx.getImageData(0,0,sw,sh).data,lower:GroundPoint[]=[];let bottom=0,left=sw,right=0;
 for(let x=0;x<sw;x++)for(let y=sh-1;y>=0;y--)if(pixels[(y*sw+x)*4+3]>160){lower.push([x,y]);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);break;}
 const cutoff=bottom-Math.min(sh*.3,(right-left)*.32);
 const contacts=lower.filter(p=>p[1]>=cutoff);
 if(!contacts.length){canvas.width=canvas.height=1;return art;}
 const result:BuildingArt={...art,size:[sw,sh],contacts,chimney:art.chimney?[art.chimney[0]*sw/art.size[0],art.chimney[1]*sh/art.size[1]]:undefined,mechanism:art.mechanism?[art.mechanism[0]*sw/art.size[0],art.mechanism[1]*sh/art.size[1]]:undefined};
 entries.set(key,result);canvas.width=canvas.height=1;return result;
}

/** Resolve all views together. A smaller rear silhouette must not be enlarged
 * to fill the lot: that used to make doors/windows grow when rotated. */
export function resolvedBuildingArt(kind:BuildingKind,rotation:number,tier:HouseTier,source:HTMLImageElement):BuildingArt{
 let entries=families.get(source);if(!entries){entries=new Map();families.set(source,entries);}
 const key=`${kind}:${tier}`;let family=entries.get(key);
 if(!family){
  family=[0,1,2,3].map(r=>groundedArt(buildingArt(kind,r,tier),source));
  const scaleLimit=Math.min(...family.map((art,r)=>art.contacts?fitGround(art.contacts,...dimensions(kind,r),.06).scale:Infinity));
  family=family.map(art=>art.contacts?{...art,scaleLimit}:art);
  entries.set(key,family);
 }
 return family[rotation];
}
