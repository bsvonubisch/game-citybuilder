import {BUILDINGS,STEP,dimensions,buildingJobs} from './catalog.js';
import {daylight} from './daylight.js';
import {outputCapacity,productionRate} from './upgrades.js';
import type {Building,Simulation} from './simulation.js';

import {LIVESTOCK,isLivestock,livestockCapacity,livestockSpots} from './livestock-layout.js';
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
 herd.growth+=STEP;
 if(herd.count<capacity&&herd.growth>=LIVESTOCK[b.kind].birth){herd.count++;herd.growth=0;}
 herd.growth=Math.min(LIVESTOCK[b.kind].birth,herd.growth);
 b.progress+=dt;
 if(b.progress>=recipe.seconds){
   b.progress=0;
   if(b.kind!=='pigs'){const count=Math.min(Math.max(1,Math.ceil(herd.count/2)),outputCapacity(b)-(b.inventory[recipe.output]??0));if(count>0){b.inventory[recipe.output]=(b.inventory[recipe.output]??0)+count;b.produced+=count;}}
   // Keep a breeding pair. Only mature surplus at a full pen enters the meat chain.
   if(herd.count>=capacity&&(b.inventory.meat??0)<=outputCapacity(b)-4){herd.count--;herd.growth=0;b.inventory.meat=(b.inventory.meat??0)+4;b.produced+=4;}
 }
}
/** Pen layout stays relative to the entrance when the building is moved/turned. */
export function penPoint(b:Pick<Building,'kind'|'rotation'|'plot'|'x'|'y'>,x:number,y:number){
 const [w,h]=dimensions(b.kind,b.rotation,b.plot),r=b.rotation;
 const p=r===0?{x,y}:r===1?{x:y,y:h-1-x}:r===2?{x:w-1-x,y:h-1-y}:{x:w-1-y,y:x};
 return{x:b.x+p.x,y:b.y+p.y};
}
export function livestockPose(b:Pick<Building,'id'|'kind'|'rotation'|'plot'|'x'|'y'>,index:number,time:number){
 const [worldW,worldH]=dimensions(b.kind,b.rotation,b.plot),[w,h]=b.rotation%2?[worldH,worldW]:[worldW,worldH],phase=time+index*4.73+b.id*.19,cycle=Math.floor(phase/18),t=phase%18;
 // Each animal stays in its own small patch: no crowding, escapes or paths
 // through the shelter. Resting occupies most of the cycle.
 const spots=livestockSpots(b.kind as keyof typeof LIVESTOCK,[w,h]);
 const spot=spots[index%spots.length],offset=(n:number)=>Math.sin((n+1)*97.17+index*17.43)*.12;
 const start={x:spot[0]+offset(cycle-1),y:spot[1]+offset(cycle+2)},end={x:spot[0]+offset(cycle),y:spot[1]+offset(cycle+3)},f=Math.min(1,t/3);
 const p=penPoint(b,start.x+(end.x-start.x)*f,start.y+(end.y-start.y)*f),a=penPoint(b,start.x,start.y),z=penPoint(b,end.x,end.y);
 return{...p,dx:z.x-a.x,dy:z.y-a.y,walking:t<3,grazing:t>=6&&t<14,phase:t};
}
