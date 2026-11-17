import {SIZE,STEP,footprint} from './catalog.js';
import {isTree} from './trees.js';
import {wearTools} from './supplies.js';
import {DAY_TICKS,daylight} from './daylight.js';
import {terrainCell,groundHeight} from './terrain.js';
import {exposedDeposit} from './deposits.js';
import {fenceEdgeSet,crossesFence} from './fences.js';
import {forestCenter,forestPosition,validForestTrip} from './forestry.js';
import {outputCapacity,productionRate} from './upgrades.js';
import type {Simulation,Building,Point,World} from './simulation.js';
export const HUNT_RADIUS=12,MEAT_PER_HUNT=6,HUNT_SECONDS=4,WILDLIFE_BUILDING_BUFFER=3;
export interface Animal extends Point {id:number;home:Point;to?:Point;progress:number;wait:number;heading:number;respawnAt?:number}
export interface HuntTrip {resident:number;animal:number;path:Point[];distance:number;phase:'outbound'|'aiming'|'returning';work:number;cargo:number}
const key=(p:Point)=>`${p.x},${p.y}`,dirs=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
const cache=new WeakMap<Simulation,{stamp:string;blocked:Set<string>;settlement:Set<string>;woodland:Set<string>;fences:ReturnType<typeof fenceEdgeSet>}>();
function landscape(sim:Simulation){
 const stamp=`${sim.state.revision}:${Math.floor(sim.state.tick/80)}`;let value=cache.get(sim);
 if(!value||value.stamp!==stamp){const plots=sim.state.buildings.flatMap(b=>footprint(b.kind,b.x,b.y,b.rotation,b.plot)),blocked=new Set(plots.map(key)),settlement=new Set<string>(),woodland=new Set<string>();
  for(const p of plots)for(let dy=-WILDLIFE_BUILDING_BUFFER;dy<=WILDLIFE_BUILDING_BUFFER;dy++)for(let dx=-WILDLIFE_BUILDING_BUFFER;dx<=WILDLIFE_BUILDING_BUFFER;dx++)if(Math.hypot(dx,dy)<=WILDLIFE_BUILDING_BUFFER)settlement.add(key({x:p.x+dx,y:p.y+dy}));
  for(const road of sim.roads){const [x,y]=road.split(',').map(Number);settlement.add(road);for(const d of dirs)settlement.add(key({x:x+d.x,y:y+d.y}));}
  for(const d of sim.state.decorations)if(isTree(d.kind)&&d.cutAt===undefined){blocked.add(key(d));if(d.natural)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(Math.hypot(dx,dy)<=3)woodland.add(key({x:d.x+dx,y:d.y+dy}));}
  value={stamp,blocked,settlement,woodland,fences:fenceEdgeSet(sim.state.decorations)};cache.set(sim,value);
 }return value;
}
export function wildOpen(sim:Simulation,p:Point,roads=false){const land=landscape(sim),k=key(p);return Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<SIZE&&p.y<SIZE&&terrainCell(p.x,p.y,sim.state.terrain).kind==='land'&&!land.blocked.has(k)&&!exposedDeposit(sim.state,p)&&(roads||(!land.settlement.has(k)&&land.woodland.has(k)));}
function crossing(sim:Simulation,a:Point,b:Point){return !crossesFence(a,b,landscape(sim).fences)&&Math.abs(groundHeight(a.x,a.y,sim.state.terrain)-groundHeight(b.x,b.y,sim.state.terrain))<=8;}
const hash=(x:number,y:number)=>((Math.imul(x+1,73856093)^Math.imul(y+1,19349663))>>>0);
export function ensureWildlife(sim:Simulation){
 if(sim.state.wildlife)return;
 const candidates:Point[]=[];for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++)if(wildOpen(sim,{x,y})&&sim.state.decorations.some(d=>d.natural&&Math.abs(d.x-x)<=2&&Math.abs(d.y-y)<=2))candidates.push({x,y});
 candidates.sort((a,b)=>hash(a.x,a.y)-hash(b.x,b.y));
 const chosen:Point[]=[];for(const group of [candidates.filter(p=>p.x<29&&p.y<29),candidates])for(const p of group){if(chosen.length>=(group===candidates?44:14))break;if(chosen.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=2))chosen.push(p);}
 sim.state.wildlife=chosen.map((p,i)=>({...p,id:i+1,home:{...p},progress:0,wait:2+i%7,heading:i%4}));
}
export function animalPosition(a:Animal,elapsed=0){const t=a.to?Math.min(1,a.progress+elapsed*.35):0;return {x:a.x+((a.to?.x??a.x)-a.x)*t,y:a.y+((a.to?.y??a.y)-a.y)*t};}
export function stepWildlife(sim:Simulation){
 ensureWildlife(sim);const reserved=new Set(sim.state.buildings.flatMap(b=>(b.hunting??[]).filter(t=>t.phase!=='returning').map(t=>t.animal)));
 for(const a of sim.state.wildlife!){
  if(a.respawnAt!==undefined){if(sim.state.tick<a.respawnAt)continue;delete a.respawnAt;}
  if(!wildOpen(sim,a)){
   const options:Point[]=[];for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const p={x:a.home.x+dx,y:a.home.y+dy};if(wildOpen(sim,p))options.push(p);}
   if(!options.length){a.respawnAt=sim.state.tick+DAY_TICKS;continue;}const p=options[hash(a.id,sim.state.tick)%options.length];a.x=p.x;a.y=p.y;a.home={...p};delete a.to;a.progress=0;
  }
  if(reserved.has(a.id))continue;
  if(a.to){if(!wildOpen(sim,a.to)||!crossing(sim,a,a.to)){delete a.to;a.progress=0;continue;}a.progress+=STEP*.35;if(a.progress>=1){a.x=a.to.x;a.y=a.to.y;delete a.to;a.progress=0;a.wait=3+(hash(a.id,sim.state.tick)%9);}continue;}
  a.wait-=STEP;if(a.wait>0)continue;
  const occupied=new Set(sim.state.wildlife!.filter(b=>b.id!==a.id&&b.respawnAt===undefined).flatMap(b=>[key(b),...(b.to?[key(b.to)]:[])]));
  const choices=dirs.map((d,heading)=>({x:a.x+d.x,y:a.y+d.y,heading})).filter(p=>wildOpen(sim,p)&&crossing(sim,a,p)&&Math.hypot(p.x-a.home.x,p.y-a.home.y)<=4&&!occupied.has(key(p)));
  const next=choices[hash(a.id,sim.state.tick)%choices.length];if(next){a.to={x:next.x,y:next.y};a.heading=next.heading;}else a.wait=5;
 }
}
export function huntTargets(sim:Simulation,b:Building){
 const c=forestCenter(b),queue=sim.adjacent(b).filter(p=>wildOpen(sim,p,true)),parents=new Map<string,Point|null>(queue.map(p=>[key(p),null]));
 for(let i=0;i<queue.length;i++)for(const d of dirs){const p=queue[i],q={x:p.x+d.x,y:p.y+d.y};if(!parents.has(key(q))&&Math.hypot(q.x-c.x,q.y-c.y)<=HUNT_RADIUS&&wildOpen(sim,q,true)&&crossing(sim,p,q)){parents.set(key(q),p);queue.push(q);}}
 const reserved=new Set(sim.state.buildings.flatMap(other=>(other.hunting??[]).filter(t=>t.phase!=='returning').map(t=>t.animal)));
 return (sim.state.wildlife??[]).filter(a=>a.respawnAt===undefined&&!a.to&&!reserved.has(a.id)&&Math.hypot(a.x-c.x,a.y-c.y)<=HUNT_RADIUS).flatMap(animal=>{
  const options=dirs.map(d=>({x:animal.x+d.x,y:animal.y+d.y})).filter(p=>parents.has(key(p))&&crossing(sim,p,animal));let best:Point[]|undefined;
  for(const option of options){const path:Point[]=[];let p:Point|null=option;while(p){path.push(p);p=parents.get(key(p))??null;}path.reverse();if(!best||path.length<best.length)best=path;}
  return best?[{animal,path:best}]:[];
 }).sort((a,b)=>a.path.length-b.path.length||a.animal.id-b.animal.id);
}
export function landHunt(b:Building){if(b.hunting){b.inventory.meat=(b.inventory.meat??0)+b.hunting.reduce((n,t)=>n+t.cargo,0);delete b.hunting;}}
function turnBack(t:HuntTrip){const p=huntPosition(t),path=t.path.slice(0,Math.floor(t.distance)+1);if(t.distance%1)path.push({x:p.x,y:p.y});t.path=path.reverse();t.distance=0;t.phase='returning';}
export const huntPosition=(t:HuntTrip,elapsed=0)=>forestPosition({...t,tree:t.animal,phase:t.phase==='aiming'?'chopping':t.phase},elapsed);
export function stepHunting(sim:Simulation,b:Building){
 b.hunting??=[];const night=daylight(sim.state.tick).night,crew=sim.state.agents.filter(a=>a.onsite===b.id&&sim.state.residents.some(r=>r.id===a.resident&&r.job===b.id));
 for(const t of [...b.hunting]){
  const animal=sim.state.wildlife?.find(a=>a.id===t.animal);
  if(!crew.some(a=>a.resident===t.resident)||t.path.some(p=>terrainCell(p.x,p.y,sim.state.terrain).kind!=='land'||sim.buildingAt(p.x,p.y))){b.inventory.meat=(b.inventory.meat??0)+t.cargo;b.hunting=b.hunting.filter(other=>other!==t);continue;}
  if(t.phase!=='returning'&&(!animal||animal.respawnAt!==undefined||b.construction||!b.enabled||!b.connected)){turnBack(t);continue;}
  if(t.phase==='aiming'){
   t.work+=STEP*productionRate(b);wearTools(b,1);if(t.work>=HUNT_SECONDS){animal!.respawnAt=sim.state.tick+DAY_TICKS*2;animal!.wait=5;t.cargo=MEAT_PER_HUNT;t.path.reverse();t.distance=0;t.phase='returning';}
  }else{t.distance=Math.min(t.path.length-1,t.distance+STEP*.75);if(t.distance>=t.path.length-1){if(t.phase==='outbound'){t.phase='aiming';t.work=0;}else{b.inventory.meat=(b.inventory.meat??0)+t.cargo;b.produced+=t.cargo;b.hunting=b.hunting.filter(other=>other!==t);}}}
 }
 if(night||b.construction||!b.enabled||!b.connected||sim.state.tick%8!==b.id%8)return;
 for(const a of crew){if(b.hunting.some(t=>t.resident===a.resident))continue;if((b.inventory.meat??0)+(b.hunting.length+1)*MEAT_PER_HUNT>outputCapacity(b))break;const target=huntTargets(sim,b)[0];if(!target)break;b.hunting.push({resident:a.resident!,animal:target.animal.id,path:target.path.map(p=>({...p})),distance:0,phase:'outbound',work:0,cargo:0});}
}
export function validHunt(t:HuntTrip){return !!t&&validForestTrip({...t,tree:t.animal,phase:t.phase==='aiming'?'chopping':t.phase})&&['outbound','aiming','returning'].includes(t.phase)&&t.work<=HUNT_SECONDS+1;}
export function validateWildlife(world:World){if(world.wildlife===undefined)return;if(!Array.isArray(world.wildlife)||world.wildlife.length>80)throw Error('Invalid wildlife.');const ids=new Set<number>();for(const a of world.wildlife){const point=(p:Point)=>!!p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<SIZE&&p.y<SIZE;if(!a||!Number.isInteger(a.id)||a.id<=0||ids.has(a.id)||!point(a)||!point(a.home)||!Number.isFinite(a.progress)||a.progress<0||a.progress>=1||!Number.isFinite(a.wait)||a.wait< -1||a.wait>60||![0,1,2,3].includes(a.heading)||(a.respawnAt!==undefined&&(!Number.isInteger(a.respawnAt)||a.respawnAt<0))||(a.to&&(!point(a.to)||Math.abs(a.x-a.to.x)+Math.abs(a.y-a.to.y)!==1)))throw Error('Invalid animal.');ids.add(a.id);}}
