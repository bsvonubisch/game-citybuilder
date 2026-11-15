import {STEP,AGENT_SPEED,dimensions} from './catalog.js';
import {CROPS,farmArea,farmPatch,isCrop,type Crop} from './farm-layout.js';
import {daylight} from './daylight.js';
import {outputCapacity,productionRate} from './upgrades.js';
import {ROCK_CLEARING_WORK} from './construction.js';
import type {Building,Point,Simulation} from './simulation.js';

export interface FarmCell {sownAt?:number}
export interface FarmTask {resident:number;patch:number;action:'sow'|'harvest';phase:'walking'|'working'|'returning';path:Point[];entry?:Point;distance:number;work:number;cargo:number}
export interface Field {cells:FarmCell[];tasks:FarmTask[];phase?:'sowing'|'harvesting'}
export const FARM_WORK_SECONDS=2;
const pathLengths=new WeakMap<Point[],number[]>();
/** Saves store fractional path indices. Travel is measured in actual tiles,
 * including short entrance segments, so spacing never changes walking speed. */
export function farmTravel(t:FarmTask,elapsed=0){
  let lengths=pathLengths.get(t.path);
  if(!lengths){lengths=[0];for(let i=1;i<t.path.length;i++)lengths.push(lengths[i-1]+Math.hypot(t.path[i].x-t.path[i-1].x,t.path[i].y-t.path[i-1].y));pathLengths.set(t.path,lengths);}
  const end=t.path.length-1;
  let i=Math.min(Math.floor(t.distance),Math.max(0,end-1));
  const current=lengths[i]+((lengths[i+1]??lengths[i])-lengths[i])*(t.distance-i);
  const travelled=Math.min(lengths[end],current+(t.phase==='working'?0:Math.max(0,elapsed)*AGENT_SPEED.person));
  while(i<end-1&&lengths[i+1]<=travelled)i++;
  const span=(lengths[i+1]??lengths[i])-lengths[i];
  return{distance:span>0?i+(travelled-lengths[i])/span:end,travelled};
}
export function ensureField(b:Building):Field{const f:Field=b.field??={cells:Array.from({length:farmArea(b.plot)*4},()=>({})),tasks:[]};f.phase??='sowing';return f;}
/** Old fields may still be waiting for the former area-based construction timer. */
export function prepareField(b:Building){
  if(b.crop===undefined)b.crop='wheat';
  ensureField(b);const c=b.construction;
  if(!c||c.demolition||c.upgradeLevel||c.upgradeTo||c.deeperTo!==undefined)return;
  if(!c.clearance){delete b.construction;return;}
  c.required=c.clearance.tiles.length*ROCK_CLEARING_WORK;
  c.completed=c.clearance.work;
}
export function cropStage(cell:FarmCell,crop:Crop,tick:number){
  if(cell.sownAt===undefined)return 'soil';
  const age=(tick-cell.sownAt)*STEP;
  return age<60?'seeded':age<CROPS[crop].grow?'growing':'ripe';
}
export function farmPosition(t:FarmTask,elapsed=0){
  const {distance,travelled}=farmTravel(t,elapsed),i=Math.min(Math.floor(distance),Math.max(0,t.path.length-2));
  const a=t.path[i],b=t.path[Math.min(i+1,t.path.length-1)],f=distance-i;
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,dx:b.x-a.x,dy:b.y-a.y,travelled};
}
export function landHarvest(b:Building){
  if(!b.field)return;const r=CROPS[b.crop??'wheat'].output;
  const cargo=b.field.tasks.reduce((n,t)=>n+t.cargo,0);
  if(cargo){b.inventory[r]=(b.inventory[r]??0)+cargo;b.produced+=cargo;}b.field.tasks=[];
}
export function rotateField(b:Building,turns:number){
  if(!b.field)return;
  landHarvest(b);let [w,h]=dimensions(b.kind,b.rotation,b.plot).map(n=>n*2);
  for(let turn=0;turn<(turns+4)%4;turn++){const cells:FarmCell[]=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells[x*h+(h-1-y)]=b.field.cells[y*w+x];b.field.cells=cells;[w,h]=[h,w];}
}
function fieldPath(from:Point,to:Point){
  const result=[from];let at={...from};
  for(const axis of ['x','y'] as const){const start={...at},steps=Math.ceil(Math.abs(to[axis]-at[axis])/.5);for(let i=1;i<=steps;i++){at={...start,[axis]:start[axis]+(to[axis]-start[axis])*i/steps};result.push(at);}}
  return result;
}
function patchStand(patch:number,b:Building){const p=farmPatch(patch,b.plot);return{x:p.x+.13,y:p.y+.13};}
function closestPatch(b:Building,from:Point,stage:'soil'|'ripe',tick:number){
  const reserved=new Set(b.field!.tasks.map(t=>t.patch));let best:number|undefined,distance=Infinity;
  for(let i=0;i<b.field!.cells.length;i++){
    if(reserved.has(i)||cropStage(b.field!.cells[i],b.crop??'wheat',tick)!==stage)continue;
    const p=patchStand(i,b),d=Math.abs(p.x-from.x)+Math.abs(p.y-from.y);
    if(d<distance){distance=d;best=i;}
  }
  return best;
}
export function stepFarm(sim:Simulation,b:Building){
  if(b.crop===null){ensureField(b);return;}
  const field=ensureField(b),crop=b.crop??'wheat',def=CROPS[crop],night=daylight(sim.state.tick).night;
  const crew=sim.state.agents.filter(a=>a.onsite===b.id&&sim.state.residents.some(r=>r.id===a.resident&&r.job===b.id));
  for(const t of [...field.tasks]){
    if(!crew.some(a=>a.resident===t.resident)){b.inventory[def.output]=(b.inventory[def.output]??0)+t.cargo;b.produced+=t.cargo;field.tasks=field.tasks.filter(v=>v!==t);continue;}
    if(t.phase==='working'){
      if(!b.enabled||!b.connected||b.construction)continue;
      t.work+=STEP*productionRate(b);
      if(t.work>=FARM_WORK_SECONDS){
        const at=t.path.at(-1)!,entry=t.entry??t.path[0];
        if(t.action==='sow')field.cells[t.patch].sownAt=sim.state.tick;
        else {delete field.cells[t.patch].sownAt;t.cargo=def.yield;}
        // Seed adjacent patches in one pass, instead of walking back to the
        // entrance after every handful. Never replant during this harvest.
        const next=t.action==='sow'&&!night?closestPatch(b,at,'soil',sim.state.tick):undefined;
        if(next!==undefined){t.patch=next;t.path=fieldPath(at,patchStand(next,b));t.entry=entry;t.phase='walking';t.distance=0;t.work=0;}
        else {t.phase='returning';t.path=fieldPath(at,entry);t.entry=entry;t.distance=0;}
      }
    }else{
      t.distance=farmTravel(t,STEP).distance;
      if(t.distance>=t.path.length-1){
        if(t.phase==='walking'){t.phase='working';t.work=0;}
        else{b.inventory[def.output]=(b.inventory[def.output]??0)+t.cargo;b.produced+=t.cargo;field.tasks=field.tasks.filter(v=>v!==t);}
      }
    }
  }
  if(field.phase==='sowing'&&field.cells.every(c=>c.sownAt!==undefined))field.phase='harvesting';
  if(field.phase==='harvesting'&&!field.tasks.length&&field.cells.every(c=>c.sownAt===undefined)){
    if(b.nextCrop){
      // Dispatch the old harvest under its original resource before switching.
      if((b.inventory[def.output]??0)>0)return;
      b.crop=b.nextCrop;delete b.nextCrop;field.phase='sowing';return;
    }
    field.phase='sowing';
  }
  if(night||!b.enabled||!b.connected||b.construction||!crew.length)return;
  const [w,h]=dimensions(b.kind,b.rotation,b.plot);
  const room=()=>outputCapacity(b)-(b.inventory[def.output]??0)-field.tasks.filter(t=>t.action==='harvest').length*def.yield;
  for(const agent of crew){
    if(field.tasks.some(t=>t.resident===agent.resident))continue;
    if(field.phase==='harvesting'&&room()<def.yield)break;
    const road=agent.path.at(-1)??{x:b.x,y:b.y+h};
    const entry={x:Math.max(-.4,Math.min(w-.6,road.x-b.x)),y:Math.max(-.4,Math.min(h-.6,road.y-b.y))};
    const next=closestPatch(b,entry,field.phase==='sowing'?'soil':'ripe',sim.state.tick);if(next===undefined)break;
    field.tasks.push({resident:agent.resident!,patch:next,action:field.phase==='sowing'?'sow':'harvest',phase:'walking',path:fieldPath(entry,patchStand(next,b)),entry,distance:0,work:0,cargo:0});
  }
}
export function farmSummary(b:Building,tick:number){const counts={soil:0,seeded:0,growing:0,ripe:0};for(const cell of ensureField(b).cells)counts[cropStage(cell,b.crop??'wheat',tick)]++;return counts;}
export function validateField(b:Building,tick:number){
  if(b.crop!==undefined&&(b.kind!=='farm'||(b.crop!==null&&!isCrop(b.crop))))throw Error('Invalid farm crop.');
  if(b.nextCrop!==undefined&&(b.kind!=='farm'||!isCrop(b.nextCrop)||b.crop===null))throw Error('Invalid next crop.');
  if(!b.field)return;
  const f=b.field,[w,h]=dimensions(b.kind,b.rotation,b.plot),crop=CROPS[b.crop??'wheat'];
  if(f.phase!==undefined&&!['sowing','harvesting'].includes(f.phase))throw Error('Invalid field cycle.');
  if(b.kind!=='farm'||!Array.isArray(f.cells)||f.cells.length!==w*h*4||f.cells.some(c=>!c||(c.sownAt!==undefined&&(!Number.isInteger(c.sownAt)||c.sownAt<0||c.sownAt>tick)))||!Array.isArray(f.tasks)||f.tasks.length>12)throw Error('Invalid farm field.');
  if(b.crop===null&&(f.tasks.length||f.cells.some(c=>c.sownAt!==undefined)))throw Error('Unselected farm contains crops.');
  const workers=new Set<number>(),patches=new Set<number>();
  for(const t of f.tasks){
    if(t?.entry&&(!Number.isFinite(t.entry.x)||!Number.isFinite(t.entry.y)||t.entry.x<-.5||t.entry.y<-.5||t.entry.x>=w-.5||t.entry.y>=h-.5))throw Error('Invalid farm entrance.');
    if(!t||!Number.isInteger(t.resident)||t.resident<=0||workers.has(t.resident)||!Number.isInteger(t.patch)||t.patch<0||t.patch>=f.cells.length||patches.has(t.patch)||!['sow','harvest'].includes(t.action)||!['walking','working','returning'].includes(t.phase)||!Number.isFinite(t.work)||t.work<0||t.work>FARM_WORK_SECONDS+1||![0,crop.yield].includes(t.cargo)|| (t.cargo>0&&(t.action!=='harvest'||t.phase!=='returning'))||!Array.isArray(t.path)||!t.path.length||t.path.length>45||!Number.isFinite(t.distance)||t.distance<0||t.distance>t.path.length-1||t.path.some((p,i)=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<-.5||p.y<-.5||p.x>=w-.5||p.y>=h-.5||(i>0&&Math.hypot(p.x-t.path[i-1].x,p.y-t.path[i-1].y)>.501)))throw Error('Invalid farm worker.');
    workers.add(t.resident);patches.add(t.patch);
  }
}
