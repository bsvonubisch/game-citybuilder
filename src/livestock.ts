import {BUILDINGS,STEP,dimensions,buildingJobs} from './catalog.js';
import {daylight} from './daylight.js';
import {outputCapacity,productionRate} from './upgrades.js';
import type {Building,Simulation} from './simulation.js';

import {LIVESTOCK,isLivestock,livestockCapacity} from './livestock-layout.js';
import {LivestockRoaming} from './livestock-roaming.js';
import {sourceObject} from './view-space.js';
export * from './livestock-layout.js';
export const ensureHerd=(b:Building)=>b.herd??={count:2,growth:0,fed:0};
export function livestockCrew(sim:Simulation,b:Building){return sim.state.agents.filter(a=>a.onsite===b.id&&sim.state.residents.some(r=>r.id===a.resident&&r.job===b.id));}
export function stepLivestock(sim:Simulation,b:Building){
 if(!isLivestock(b.kind))return;
 const herd=ensureHerd(b),recipe=BUILDINGS[b.kind].recipe!,capacity=livestockCapacity(b.kind,b.plot);
 if(b.construction||!b.enabled||!b.connected||daylight(sim.state.tick).night||livestockCrew(sim,b).length<buildingJobs(b))return;
 if(herd.fed<=0){const feed=Math.max(1,Math.ceil(herd.count/4));if((b.inventory.grain??0)<feed)return;b.inventory.grain!-=feed;herd.fed=40;}
 const dt=STEP*productionRate(b);herd.fed=Math.max(0,herd.fed-STEP);
 // Breeding advances steadily per pen, not exponentially with the number of pairs.
 herd.growth=Math.min(LIVESTOCK[b.kind].birth,herd.growth+STEP);
 if(herd.growth>=LIVESTOCK[b.kind].birth){
   if(herd.count<capacity){herd.count++;herd.growth=0;}
   // At capacity the new animal replaces one sent for meat. The visible herd
   // stays full; no animal is removed early on a milk/egg production cycle.
   else if((b.inventory.meat??0)<=outputCapacity(b)-4){
     b.inventory.meat=(b.inventory.meat??0)+4;b.produced+=4;herd.growth=0;
   }
 }
 b.progress+=dt;
 if(b.progress>=recipe.seconds){
   b.progress=0;
   if(b.kind!=='pigs'){const count=Math.min(Math.max(1,Math.ceil(herd.count/2)),outputCapacity(b)-(b.inventory[recipe.output]??0));if(count>0){b.inventory[recipe.output]=(b.inventory[recipe.output]??0)+count;b.produced+=count;}}
 }
}
/** Pen layout stays relative to the entrance when the building is moved/turned. */
export function penPoint(b:Pick<Building,'kind'|'rotation'|'plot'|'x'|'y'>,x:number,y:number){
 const [w,h]=dimensions(b.kind,b.rotation,b.plot),r=b.rotation;
 const p=r===0?{x,y}:r===1?{x:y,y:h-1-x}:r===2?{x:w-1-x,y:h-1-y}:{x:w-1-y,y:x};
 return{x:b.x+p.x,y:b.y+p.y};
}
type Pen=Pick<Building,'id'|'kind'|'rotation'|'plot'|'x'|'y'>&Partial<Pick<Building,'herd'>>;
const roaming=new WeakMap<object,{key:string;herd:LivestockRoaming}>();
export function livestockPose(b:Pen,index:number,time:number){
 const [worldW,worldH]=dimensions(b.kind,b.rotation,b.plot),[w,h]=b.rotation%2?[worldH,worldW]:[worldW,worldH],original=sourceObject(b),key=`${b.kind}:${w}:${h}`;
 let cache=roaming.get(original);
 if(!cache||cache.key!==key){cache={key,herd:new LivestockRoaming(b.kind as keyof typeof LIVESTOCK,w,h,b.id)};roaming.set(original,cache);}
 cache.herd.update(time,b.herd?.count??livestockCapacity(b.kind as keyof typeof LIVESTOCK,[w,h]));
 const local=cache.herd.pose(index);
 if(!local)return null;
 const p=penPoint(b,local.x,local.y),ahead=penPoint(b,local.x+local.dx,local.y+local.dy);
 return{...local,...p,dx:ahead.x-p.x,dy:ahead.y-p.y};
}
