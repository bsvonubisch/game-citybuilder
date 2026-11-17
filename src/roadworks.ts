import {SIZE,STEP,footprint,DECORATIONS} from './catalog.js';
import {toolEfficiency,wearTools} from './supplies.js';
import {terrainCell,groundHeight} from './terrain.js';
import {fenceEdgeSet,crossesFence,fenceNeighbour} from './fences.js';
import {exposedDeposit} from './deposits.js';
import {daylight} from './daylight.js';
import {reconcileRoadLamps} from './streetlights.js';
import {ROAD_TYPES,BRIDGE_TYPES,isRoadType,roadTypeAt,type RoadType} from './roads.js';
import {recordTownEvent} from './town-events.js';
import type {Agent,Point,Simulation,World} from './simulation.js';

export interface RoadWork extends Point {
  id:number;
  type:RoadType;
  operation:'build'|'upgrade'|'remove';
  required:number;
  completed:number;
  /** A removal stroke stays traversable until every tile in its crew job is cleared. */
  group?:number;
}
const key=(p:Point)=>`${p.x},${p.y}`;
const dirs=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
export const ROAD_CREW_LIMIT=4;
export const roadWorkAt=(world:World,p:Point)=>world.roadWorks?.find(w=>w.x===p.x&&w.y===p.y);
export const roadBuildersNeeded=(world:World)=>Math.min(ROAD_CREW_LIMIT,world.roadWorks?.filter(w=>w.completed<w.required).length??0);
export function queueRoadWork(sim:Simulation,p:Point,type:RoadType,operation:RoadWork['operation'],group?:number) {
  const existing=roadWorkAt(sim.state,p);
  // Removing unfinished work still takes a worker; never refund twice.
  if(existing){if(operation==='remove'&&existing.operation!=='remove'){existing.operation='remove';existing.required=4;existing.completed=0;existing.group=group??existing.id;}return;}
  const bridge=terrainCell(p.x,p.y,sim.state.terrain).kind==='water';
  const id=sim.state.nextId++;
  (sim.state.roadWorks??=[]).push({id,x:p.x,y:p.y,type,operation,required:operation==='remove'?(bridge?12:4):(bridge?24:type==='dirt'?4:type==='brick'?10:7),completed:0,...(operation==='remove'?{group:group??id}:{})});
}
/** Rendering sees planned surfaces; routing sees only completed roads. */
const visualCache=new WeakMap<Simulation,{revision:number;view:Simulation}>();
export function roadVisualState(sim:Simulation):Simulation {
  if(!sim.state.roadWorks?.length)return sim;
  const cached=visualCache.get(sim);if(cached?.revision===sim.state.revision)return cached.view;
  const roads=new Set(sim.roads),roadTypes={...sim.state.roadTypes};
  for(const w of sim.state.roadWorks){if(!roads.has(key(w)))roadTypes[key(w)]=w.type;roads.add(key(w));}
  const view={roads,state:{...sim.state,roads:[...roads],roadTypes}} as Simulation;
  visualCache.set(sim,{revision:sim.state.revision,view});return view;
}
export function roadWorkerPosition(a:Agent,elapsed=0) {
  const distance=Math.min(a.path.length-1,a.segment+a.progress+(a.wait>0?0:elapsed*.85));
  const i=Math.min(Math.floor(distance),Math.max(0,a.path.length-2)),p=a.path[i],q=a.path[Math.min(i+1,a.path.length-1)],f=distance-i;
  return {x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f,dx:q.x-p.x,dy:q.y-p.y};
}
function workRoutes(sim:Simulation,start:Point,jobs:RoadWork[]) {
  if(!jobs.length)return [];
  // A tile may have just opened or been removed this step, before reconnect.
  const roads=new Set(sim.state.roads);
  const blocked=new Set(sim.state.buildings.flatMap(b=>footprint(b.kind,b.x,b.y,b.rotation,b.plot).map(key)));
  for(const d of sim.state.decorations)if(d.side===undefined&&d.edge===undefined&&!roadWorkAt(sim.state,d))blocked.add(key(d));
  const fences=fenceEdgeSet(sim.state.decorations),targets=new Set(jobs.map(key)),queue=[start],parents=new Map<string,Point|null>([[key(start),null]]);
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    if(targets.has(key(p))){
      const job=jobs.find(w=>key(w)===key(p))!,path:Point[]=[];let at:Point|null=p;
      while(at){path.push({x:at.x,y:at.y});at=parents.get(key(at))??null;}
      return [{job,path:path.reverse()}];
    }
    // Crews can reach the next bridge tile from a bank or finished deck, never walk across an unfinished span.
    if(terrainCell(p.x,p.y,sim.state.terrain).kind==='water'&&!roads.has(key(p)))continue;
    for(const d of dirs){const q={x:p.x+d.x,y:p.y+d.y},k=key(q);
      if(q.x<0||q.y<0||q.x>=SIZE||q.y>=SIZE||parents.has(k)||blocked.has(k)||exposedDeposit(sim.state,q)||crossesFence(p,q,fences)||Math.abs(groundHeight(p.x,p.y,sim.state.terrain)-groundHeight(q.x,q.y,sim.state.terrain))>8)continue;
      if(terrainCell(q.x,q.y,sim.state.terrain).kind==='water'&&!roads.has(k)&&!targets.has(k))continue;
      parents.set(k,p);queue.push(q);
    }
  }
  return [];
}
function finish(sim:Simulation,w:RoadWork) {
  const k=key(w),water=terrainCell(w.x,w.y,sim.state.terrain).kind==='water';
  if(w.operation==='remove'){
    const existed=sim.roads.has(k),previous=roadTypeAt(sim.state.roadTypes,w);
    sim.state.roads=sim.state.roads.filter(p=>p!==k);
    if(sim.state.roadTypes)delete sim.state.roadTypes[k];
    if(existed)sim.state.money+=Math.floor((water?BRIDGE_TYPES:ROAD_TYPES)[previous].cost/2);
    sim.state.decorations=sim.state.decorations.filter(d=>{
      if(d.edge===undefined||key(d)!==k)return true;
      sim.state.money+=Math.floor(DECORATIONS[d.kind].cost/2);return false;
    });
  }else{
    if(!sim.roads.has(k))sim.state.roads.push(k);
    sim.state.roadTypes??={};sim.state.roadTypes[k]=w.type;
    const roads=new Set(sim.state.roads);
    sim.state.decorations=sim.state.decorations.filter(d=>d.side!==undefined?!(roads.has(key(d))&&roads.has(key(fenceNeighbour(d,d.side)))):d.edge!==undefined||key(d)!==k);
  }
  sim.state.roadWorks=sim.state.roadWorks!.filter(j=>j.id!==w.id);
  const before=sim.state.decorations.length;
  sim.state.decorations=reconcileRoadLamps(sim.state.decorations,new Set(sim.state.roads));
  sim.state.money+=(before-sim.state.decorations.length)*DECORATIONS.streetlight.cost;
  const label=water?`${BRIDGE_TYPES[w.type].name} bridge`:`${ROAD_TYPES[w.type].name} road`;
  recordTownEvent(sim.state,'road',`${label} ${w.operation==='remove'?'removed':w.operation==='upgrade'?'upgraded':'completed'}.`,{tile:w});
}
/** Road crews use real unassigned residents and walk to the tile before doing labour. */
export function stepRoadWorks(sim:Simulation) {
  const works=sim.state.roadWorks??[],day=daylight(sim.state.tick);
  let changed=false;
  for(const a of sim.state.agents.filter(a=>a.roadWork!==undefined)){
    const w=works.find(w=>w.id===a.roadWork),resident=sim.state.residents.find(r=>r.id===a.resident);
    if(!w||!resident||resident.job!==null){delete a.roadWork;changed=true;continue;}
    const distance=Math.min(a.path.length-1,a.segment+a.progress+STEP*.85);
    a.segment=Math.floor(distance);a.progress=distance-a.segment;a.active=true;a.move=STEP*.85;
    if(distance>=a.path.length-1){const home=sim.building(resident.home),efficiency=home?toolEfficiency(home,1):.5;a.wait=1;w.completed=Math.min(w.required,w.completed+STEP*day.workRate*efficiency);if(home)wearTools(home,1,day.workRate,1);
      if(w.completed>=w.required){
        if(w.operation==='remove'){
          const group=sim.state.roadWorks!.filter(j=>j.operation==='remove'&&(j.group??j.id)===(w.group??w.id));
          if(group.every(j=>j.completed>=j.required))for(const j of group)finish(sim,j);
        }else finish(sim,w);
        // Keep this crew member on site and walk straight to the closest
        // reachable unclaimed tile. Reconnecting first would send them back
        // through household/job assignment and lose their current position.
        const busy=new Set(sim.state.agents.filter(other=>other!==a&&other.roadWork!==undefined).map(other=>other.roadWork));
        const next=day.night?undefined:workRoutes(sim,w,(sim.state.roadWorks??[]).filter(job=>job.completed<job.required&&!busy.has(job.id)))[0];
        if(next){a.roadWork=next.job.id;a.path=next.path;a.segment=0;a.progress=0;a.wait=0;a.move=0;}
        else delete a.roadWork;
        changed=true;
      }
    }else a.wait=0;
  }
  if(changed){sim.state.revision++;sim.reconnect(true);}
  if(sim.state.tick%4!==0||day.night||!sim.state.roadWorks?.length)return;
  const busy=new Set(sim.state.agents.filter(a=>a.roadWork!==undefined).map(a=>a.roadWork));
  let slots=ROAD_CREW_LIMIT-busy.size,attempts=0;
  const residents=sim.state.residents,offset=Math.floor(sim.state.tick/4)*4%Math.max(1,residents.length);
  for(let i=0;i<residents.length;i++){
    const r=residents[(i+offset)%residents.length];
    if(slots<=0)break;
    if(r.job!==null||sim.state.agents.some(a=>a.resident===r.id&&a.roadWork!==undefined))continue;
    if(attempts++>=4)break;
    const home=sim.building(r.home);if(!home)continue;
    const previous=sim.state.agents.find(a=>a.resident===r.id);
    const at=previous?.active!==false&&previous?roadWorkerPosition(previous):undefined;
    const start=at?{x:Math.round(at.x),y:Math.round(at.y)}:sim.adjacent(home)[0];
    if(!start)continue;
    const choice=workRoutes(sim,start,sim.state.roadWorks.filter(w=>w.completed<w.required&&!busy.has(w.id)))[0];
    if(!choice)continue;
    sim.state.agents=sim.state.agents.filter(a=>a.resident!==r.id);
    sim.state.agents.push({id:previous?.id??sim.state.nextId++,resident:r.id,kind:'person',source:home.id,target:home.id,path:choice.path,segment:0,progress:0,returning:false,wait:0,active:true,cargo:null,amount:0,roadWork:choice.job.id});
    busy.add(choice.job.id);slots--;
  }
}
export function validateRoadWorks(world:World) {
  if(world.roadWorks===undefined)return;
  if(!Array.isArray(world.roadWorks)||world.roadWorks.length>SIZE*SIZE)throw new Error('Invalid road works.');
  const tiles=new Set<string>(),ids=new Set<number>([...world.buildings,...world.decorations,...world.residents].map(v=>v.id));
  for(const w of world.roadWorks){
    if(!w||!Number.isSafeInteger(w.id)||w.id<1||ids.has(w.id)||![w.x,w.y].every(n=>Number.isInteger(n)&&n>=0&&n<SIZE)||tiles.has(key(w))||!isRoadType(w.type)||!['build','upgrade','remove'].includes(w.operation)||!Number.isFinite(w.required)||w.required<1||w.required>100||!Number.isFinite(w.completed)||w.completed<0||w.completed>w.required||world.buildings.some(b=>footprint(b.kind,b.x,b.y,b.rotation,b.plot).some(p=>key(p)===key(w))))throw new Error('Invalid road work.');
    ids.add(w.id);tiles.add(key(w));world.nextId=Math.max(world.nextId,w.id+1);
    if(w.group!==undefined&&(!Number.isSafeInteger(w.group)||w.group<1))throw new Error('Invalid road removal group.');
  }
}
