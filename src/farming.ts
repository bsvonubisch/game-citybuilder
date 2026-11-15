import {STEP,dimensions} from './catalog.js';
import {CROPS,farmArea,farmPatch,isCrop,type Crop} from './farm-layout.js';
import {daylight} from './daylight.js';
import {outputCapacity,productionRate} from './upgrades.js';
import type {Building,Point,Simulation} from './simulation.js';

export interface FarmCell {sownAt?:number}
export interface FarmTask {resident:number;patch:number;action:'sow'|'harvest';phase:'walking'|'working'|'returning';path:Point[];distance:number;work:number;cargo:number}
export interface Field {cells:FarmCell[];tasks:FarmTask[]}
export const FARM_WORK_SECONDS=2;
export function ensureField(b:Building):Field{return b.field??={cells:Array.from({length:farmArea(b.plot)*4},()=>({})),tasks:[]};}
export function cropStage(cell:FarmCell,crop:Crop,tick:number){
  if(cell.sownAt===undefined)return 'soil';
  const age=(tick-cell.sownAt)*STEP;
  return age<12?'seeded':age<CROPS[crop].grow?'growing':'ripe';
}
export function farmPosition(t:FarmTask,elapsed=0){
  const distance=Math.min(t.path.length-1,t.distance+(t.phase==='working'?0:elapsed*.9)),i=Math.min(Math.floor(distance),Math.max(0,t.path.length-2));
  const a=t.path[i],b=t.path[Math.min(i+1,t.path.length-1)],f=distance-i;
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,dx:b.x-a.x,dy:b.y-a.y};
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
export function stepFarm(sim:Simulation,b:Building){
  const field=ensureField(b),crop=b.crop??'wheat',def=CROPS[crop],night=daylight(sim.state.tick).night;
  const crew=sim.state.agents.filter(a=>a.onsite===b.id&&sim.state.residents.some(r=>r.id===a.resident&&r.job===b.id));
  for(const t of [...field.tasks]){
    if(!crew.some(a=>a.resident===t.resident)){b.inventory[def.output]=(b.inventory[def.output]??0)+t.cargo;b.produced+=t.cargo;field.tasks=field.tasks.filter(v=>v!==t);continue;}
    if(t.phase==='working'){
      if(!b.enabled||!b.connected||b.construction)continue;
      t.work+=STEP*productionRate(b);
      if(t.work>=FARM_WORK_SECONDS){
        if(t.action==='sow')field.cells[t.patch].sownAt=sim.state.tick;
        else {delete field.cells[t.patch].sownAt;t.cargo=def.yield;}
        t.phase='returning';t.path.reverse();t.distance=0;
      }
    }else{
      t.distance=Math.min(t.path.length-1,t.distance+STEP*.9);
      if(t.distance>=t.path.length-1){
        if(t.phase==='walking'){t.phase='working';t.work=0;}
        else{b.inventory[def.output]=(b.inventory[def.output]??0)+t.cargo;b.produced+=t.cargo;field.tasks=field.tasks.filter(v=>v!==t);}
      }
    }
  }
  if(night||!b.enabled||!b.connected||b.construction||!crew.length)return;
  const [w,h]=dimensions(b.kind,b.rotation,b.plot),reserved=new Set(field.tasks.map(t=>t.patch));
  const room=()=>outputCapacity(b)-(b.inventory[def.output]??0)-field.tasks.filter(t=>t.action==='harvest').length*def.yield;
  const order=field.cells.map((cell,i)=>({i,stage:cropStage(cell,crop,sim.state.tick)})).filter(v=>!reserved.has(v.i)&&(v.stage==='soil'||v.stage==='ripe')).sort((a,c)=>(a.stage==='ripe'?0:1)-(c.stage==='ripe'?0:1)||a.i-c.i);
  for(const agent of crew){
    if(field.tasks.some(t=>t.resident===agent.resident))continue;
    const next=order.find(v=>!reserved.has(v.i)&&(v.stage!=='ripe'||room()>=def.yield));if(!next)break;
    const road=agent.path.at(-1)??{x:b.x,y:b.y+h};
    const entry={x:Math.max(-.4,Math.min(w-.6,road.x-b.x)),y:Math.max(-.4,Math.min(h-.6,road.y-b.y))};
    const at=farmPatch(next.i,b.plot),stand={x:at.x+.13,y:at.y+.13};
    field.tasks.push({resident:agent.resident!,patch:next.i,action:next.stage==='ripe'?'harvest':'sow',phase:'walking',path:fieldPath(entry,stand),distance:0,work:0,cargo:0});reserved.add(next.i);
  }
}
export function farmSummary(b:Building,tick:number){const counts={soil:0,seeded:0,growing:0,ripe:0};for(const cell of ensureField(b).cells)counts[cropStage(cell,b.crop??'wheat',tick)]++;return counts;}
export function validateField(b:Building,tick:number){
  if(b.crop!==undefined&&(b.kind!=='farm'||!isCrop(b.crop)))throw Error('Invalid farm crop.');
  if(!b.field)return;
  const f=b.field,[w,h]=dimensions(b.kind,b.rotation,b.plot),crop=CROPS[b.crop??'wheat'];
  if(b.kind!=='farm'||!Array.isArray(f.cells)||f.cells.length!==w*h*4||f.cells.some(c=>!c||(c.sownAt!==undefined&&(!Number.isInteger(c.sownAt)||c.sownAt<0||c.sownAt>tick)))||!Array.isArray(f.tasks)||f.tasks.length>12)throw Error('Invalid farm field.');
  const workers=new Set<number>(),patches=new Set<number>();
  for(const t of f.tasks){
    if(!t||!Number.isInteger(t.resident)||t.resident<=0||workers.has(t.resident)||!Number.isInteger(t.patch)||t.patch<0||t.patch>=f.cells.length||patches.has(t.patch)||!['sow','harvest'].includes(t.action)||!['walking','working','returning'].includes(t.phase)||!Number.isFinite(t.work)||t.work<0||t.work>FARM_WORK_SECONDS+1||![0,crop.yield].includes(t.cargo)|| (t.cargo>0&&(t.action!=='harvest'||t.phase!=='returning'))||!Array.isArray(t.path)||!t.path.length||t.path.length>45||!Number.isFinite(t.distance)||t.distance<0||t.distance>t.path.length-1||t.path.some((p,i)=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<-.5||p.y<-.5||p.x>=w-.5||p.y>=h-.5||(i>0&&Math.hypot(p.x-t.path[i-1].x,p.y-t.path[i-1].y)>.501)))throw Error('Invalid farm worker.');
    workers.add(t.resident);patches.add(t.patch);
  }
}
