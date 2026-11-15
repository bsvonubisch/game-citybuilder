export const LIVESTOCK={
 cattle:{animal:'cow',height:20,birth:720,base:9},
 chickens:{animal:'chicken',height:7,birth:270,base:4},
 pigs:{animal:'pig',height:12,birth:480,base:9},
} as const;
export type LivestockKind=keyof typeof LIVESTOCK;
export interface Herd {count:number;growth:number;fed:number}
export const isLivestock=(kind:string):kind is LivestockKind=>Object.hasOwn(LIVESTOCK,kind);
export const validPenPlot=(p:unknown):p is [number,number]=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isInteger(n)&&n>=2&&n<=10);
export const penArea=(kind:LivestockKind,plot?:readonly[number,number])=>plot?plot[0]*plot[1]:LIVESTOCK[kind].base;
const spotsCache=new Map<string,readonly (readonly [number,number])[]>();
/** One grazing patch per animal, excluding the shelter. Capacity never stacks sprites. */
export function livestockSpots(kind:LivestockKind,plot?:readonly[number,number]){
 const [w,h]=plot??(kind==='chickens'?[2,2]:[3,3]),key=`${kind}:${w}:${h}`;
 let spots=spotsCache.get(key);
 if(!spots){const result:[number,number][]=[],gap=kind==='chickens'?.42:kind==='pigs'?.65:.8;
  for(let y=.1;y<h-.6;y+=gap)for(let x=.1;x<w-.6;x+=gap)if(x>.7||y>.7)result.push([x,y]);
  spots=result;spotsCache.set(key,spots);
 }
 return spots;
}
export const livestockCapacity=(kind:LivestockKind,plot?:readonly[number,number])=>Math.min(livestockSpots(kind,plot).length,kind==='chickens'?192:kind==='pigs'?128:96,Math.max(3,Math.floor((penArea(kind,plot)-1)*(kind==='chickens'?4:kind==='pigs'?1.5:1))));
// A farmer tends up to 36 tiles; even the largest pasture needs only three.
export const livestockJobs=(kind:LivestockKind,plot?:readonly[number,number])=>Math.max(1,Math.ceil(penArea(kind,plot)/36));
export const penPrice=(kind:LivestockKind,plot?:readonly[number,number])=>{const area=penArea(kind,plot);return{cost:70+area*25,materials:{wood:6+Math.ceil(area*1.5),stone:4,planks:2+Math.ceil(area*.6)}};};
export function penRectangle(from:{x:number;y:number},to:{x:number;y:number}){
 const d=(n:number)=>n<0?Math.max(-9,Math.min(-1,n)):Math.min(9,Math.max(1,n)),x=from.x+d(to.x-from.x),y=from.y+d(to.y-from.y);
 return{x:Math.min(from.x,x),y:Math.min(from.y,y),plot:[Math.abs(x-from.x)+1,Math.abs(y-from.y)+1] as [number,number]};
}
export const BUTCHER_CUTS={
 sausages:{name:'Sausages',input:'meat',amount:2,output:'sausages',count:4,seconds:12},
 steaks:{name:'Steaks',input:'meat',amount:2,output:'steaks',count:3,seconds:14},
 roasts:{name:'Roasts',input:'meat',amount:3,output:'roasts',count:4,seconds:18},
} as const;
export type ButcherCut=keyof typeof BUTCHER_CUTS;
export const isButcherCut=(v:unknown):v is ButcherCut=>typeof v==='string'&&Object.hasOwn(BUTCHER_CUTS,v);
