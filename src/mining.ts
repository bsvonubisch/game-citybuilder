import {fenceEdgeSet,crossesFence} from "./fences.js";
import { SIZE, STEP, dimensions, footprint } from "./catalog.js";
import { DEPOSITS, DEPOSIT_TILES, MINING_RADIUS, nearbyDeposits, depositTiles, exposedDeposit } from "./deposits.js";
import { groundHeight, terrainCell } from "./terrain.js";
import { daylight } from "./daylight.js";
import { outputCapacity, productionRate } from "./upgrades.js";
import { treeStage, validForestTrip } from "./forestry.js";
import type { Building, Point, Simulation } from "./simulation.js";

export interface MiningTrip {
  resident:number;
  deposit:string;
  rock:Point;
  path:Point[];
  distance:number;
  phase:"outbound"|"mining"|"returning";
  work:number;
  cargo:number;
}
export const ORE_PER_TRIP=6, MINING_SECONDS=6;
const key=(p:Point)=>`${p.x},${p.y}`;
const dirs=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
type MiningTarget={deposit:string;rock:Point;path:Point[]};
const cache=new WeakMap<Simulation,{stamp:string;targets:Map<string,MiningTarget[]>}>();
export function miningTargets(sim:Simulation,b:Building) {
  const stamp=`${sim.state.revision}:${sim.state.clearedDeposits?.length??0}:${Math.floor(sim.state.tick/80)}`, identity=`${b.id}:${b.x}:${b.y}:${b.rotation}`;
  let entry=cache.get(sim);
  if(!entry||entry.stamp!==stamp){entry={stamp,targets:new Map()};cache.set(sim,entry);}
  const known=entry.targets.get(identity);if(known)return known;
  const targets:MiningTarget[]=[],deposits=nearbyDeposits(b);
  if(!deposits.length)return targets;
  const [w,h]=dimensions(b.kind,b.rotation,b.plot),cx=b.x+(w-1)/2,cy=b.y+(h-1)/2;
  const fences=fenceEdgeSet(sim.state.decorations);
  const blocked=new Set([...Object.keys(DEPOSIT_TILES).filter(k=>!sim.state.clearedDeposits?.includes(k)),...sim.state.buildings.flatMap(c=>footprint(c.kind,c.x,c.y,c.rotation,c.plot).map(key)),...footprint(b.kind,b.x,b.y,b.rotation,b.plot).map(key)]);
  // Woodland has room between trunks. Planted trees and solid decorations remain obstacles.
  for(const d of sim.state.decorations){const tree=["oak","pine","birch","blossom"].includes(d.kind);if(d.side===undefined&&!(d.natural&&tree)&&(!tree||treeStage(d,sim.state.tick)==="mature"))blocked.add(key(d));}
  // Existing roads across a legacy seam remain usable; exposed rocks do not.
  for(const k of sim.roads)blocked.delete(k);
  const open=(p:Point)=>p.x>=0&&p.y>=0&&p.x<SIZE&&p.y<SIZE&&terrainCell(p.x,p.y,sim.state.terrain).kind==="land"&&!blocked.has(key(p))&&Math.hypot(p.x-cx,p.y-cy)<=MINING_RADIUS+1;
  // Workers have already entered the workplace from its road entrance. They can
  // leave any unobstructed edge on foot, including a legacy quarry over a seam.
  const starts=new Map<string,Point>();
  for(const p of footprint(b.kind,b.x,b.y,b.rotation,b.plot))for(const d of dirs){const q={x:p.x+d.x,y:p.y+d.y};if(open(q)&&!crossesFence(p,q,fences)&&Math.abs(groundHeight(p.x,p.y,sim.state.terrain)-groundHeight(q.x,q.y,sim.state.terrain))<=8)starts.set(key(q),q);}
  const queue=[...starts.values()],parents=new Map<string,Point|null>(queue.map(p=>[key(p),null]));
  for(let i=0;i<queue.length;i++)for(const d of dirs){const p=queue[i],q={x:p.x+d.x,y:p.y+d.y};if(!parents.has(key(q))&&!crossesFence(p,q,fences)&&open(q)&&Math.abs(groundHeight(p.x,p.y,sim.state.terrain)-groundHeight(q.x,q.y,sim.state.terrain))<=8){parents.set(key(q),p);queue.push(q);}}
  for(const deposit of deposits)for(const rock of depositTiles(deposit)) {
    if(!exposedDeposit(sim.state,rock)||sim.buildingAt(rock.x,rock.y)||sim.state.decorations.some(d=>d.x===rock.x&&d.y===rock.y&&d.side===undefined&&!d.natural)||sim.roads.has(key(rock))||terrainCell(rock.x,rock.y,sim.state.terrain).kind!=="land"||Math.hypot(rock.x-cx,rock.y-cy)>MINING_RADIUS)continue;
    // Older extractors can share an edge with the remaining exposed part of
    // their seam. Work that face directly from the workplace boundary.
    const edge=dirs.map(d=>({x:rock.x+d.x,y:rock.y+d.y})).find(p=>sim.buildingAt(p.x,p.y)?.id===b.id&&!crossesFence(p,rock,fences)&&Math.abs(groundHeight(p.x,p.y,sim.state.terrain)-groundHeight(rock.x,rock.y,sim.state.terrain))<=8);
    if(edge){targets.push({deposit,rock,path:[{x:rock.x+(edge.x-rock.x)*.35,y:rock.y+(edge.y-rock.y)*.35}]});continue;}
    let best:Point[]|undefined;
    for(const d of dirs){const stand={x:rock.x+d.x,y:rock.y+d.y};if(!parents.has(key(stand))||crossesFence(stand,rock,fences))continue;const path:Point[]=[];let at:Point|null=stand;while(at){path.push(at);at=parents.get(key(at))??null;}path.reverse();if(!best||path.length<best.length)best=path;}
    if(best){
      const stand=best.at(-1)!;
      // Keep feet off trunk centres without changing which grid cells are traversable.
      const waypoints=best.map(p=>sim.roads.has(key(p))?p:{x:p.x+.28,y:p.y+.28});
      waypoints.push({x:stand.x+(rock.x-stand.x)*.65,y:stand.y+(rock.y-stand.y)*.65});
      const path:Point[]=[waypoints[0]];
      for(const p of waypoints.slice(1)){const a=path.at(-1)!,steps=Math.ceil(Math.abs(p.x-a.x)+Math.abs(p.y-a.y));for(let i=1;i<=steps;i++)path.push({x:a.x+(p.x-a.x)*i/steps,y:a.y+(p.y-a.y)*i/steps});}
      targets.push({deposit,rock,path});
    }
  }
  targets.sort((a,b)=>a.path.length-b.path.length||a.rock.x-b.rock.x||a.rock.y-b.rock.y);
  entry.targets.set(identity,targets);return targets;
}
export function landOre(b:Building) {
  if(!b.mining)return;
  const resource=b.kind==="quarry"?"stone":"metal";
  b.inventory[resource]=(b.inventory[resource]??0)+b.mining.reduce((n,t)=>n+t.cargo,0);
  delete b.mining;
}
export function stepMining(sim:Simulation,b:Building) {
  b.mining??=[];
  const deposits=nearbyDeposits(b),resource=b.kind==="quarry"?"stone":"metal",night=daylight(sim.state.tick).night;
  const crew=sim.state.agents.filter(a=>a.onsite===b.id&&sim.state.residents.some(r=>r.id===a.resident&&r.job===b.id));
  for(const t of [...b.mining]) {
    if(!crew.some(a=>a.resident===t.resident)||!deposits.includes(t.deposit)||t.path.some(p=>terrainCell(p.x,p.y,sim.state.terrain).kind!=="land"||!!sim.buildingAt(Math.round(p.x),Math.round(p.y)))) {
      b.inventory[resource]=(b.inventory[resource]??0)+t.cargo;b.mining=b.mining.filter(other=>other!==t);continue;
    }
    if(t.phase==="mining") {
      if(!b.enabled||!b.connected||b.construction||(sim.state.deposits[t.deposit]??0)<=0){t.phase="returning";t.path.reverse();t.distance=0;continue;}
      t.work+=STEP*productionRate(b)*(night?.25:1);
      if(t.work>=MINING_SECONDS){t.cargo=Math.min(ORE_PER_TRIP,sim.state.deposits[t.deposit]);sim.state.deposits[t.deposit]-=t.cargo;t.phase="returning";t.path.reverse();t.distance=0;}
    } else {
      t.distance=Math.min(t.path.length-1,t.distance+STEP*.75);
      if(t.distance>=t.path.length-1) {
        if(t.phase==="outbound"){t.phase="mining";t.work=0;}
        else {b.inventory[resource]=(b.inventory[resource]??0)+t.cargo;b.produced+=t.cargo;b.mining=b.mining.filter(other=>other!==t);}
      }
    }
  }
  if(!deposits.length||night||b.construction||!b.enabled||!b.connected||!crew.length)return;
  const reserved=new Set(sim.state.buildings.flatMap(other=>(other.mining??[]).filter(t=>t.phase!=="returning").map(t=>key(t.rock))));
  for(const a of crew) {
    if(b.mining.some(t=>t.resident===a.resident))continue;
    if((b.inventory[resource]??0)+b.mining.length*ORE_PER_TRIP+ORE_PER_TRIP>outputCapacity(b))break;
    const target=miningTargets(sim,b).find(t=>(sim.state.deposits[t.deposit]??0)>0&&!reserved.has(key(t.rock)));if(!target)break;
    reserved.add(key(target.rock));b.mining.push({resident:a.resident!,deposit:target.deposit,rock:target.rock,path:target.path.map(p=>({...p})),distance:0,phase:"outbound",work:0,cargo:0});
  }
}
export function validMiningTrip(t:MiningTrip) {
  return !!t && Object.hasOwn(DEPOSITS,t.deposit) && !!t.rock && DEPOSIT_TILES[key(t.rock)]===t.deposit &&
    Number.isInteger(t.cargo)&&t.cargo>=0&&t.cargo<=ORE_PER_TRIP &&
    ["outbound","mining","returning"].includes(t.phase) &&
    validForestTrip({...t,tree:1,cargo:t.cargo?6:0,phase:t.phase==="mining"?"chopping":t.phase});
}
