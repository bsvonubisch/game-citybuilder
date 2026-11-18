import {fenceEdgeSet,crossesFence} from "./fences.js";
import {berryRipe,BERRY_REGROW_TICKS} from './gathering.js';
import {isTree} from './trees.js';
import {wearTools} from './supplies.js';
import { SIZE, STEP, dimensions, footprint } from "./catalog.js";
import { groundHeight, terrainCell } from "./terrain.js";
import { daylight } from "./daylight.js";
import { outputCapacity, productionRate } from "./upgrades.js";
import { DEPOSIT_TILES } from "./deposits.js";
import type { Decoration } from "./decorations.js";
import type { Building, Point, Simulation, World } from "./simulation.js";
import {sourceObject,sourceBuilding,turnPoint,viewTurn} from './view-space.js';

export const FOREST_RADIUS = 10, REGROW_TICKS = 2400, CHOP_SECONDS = 6, LOGS_PER_TREE = 6;
const LEGACY_REGROW_TICKS = 480;
export interface ForestTrip {
  resident: number;
  tree: number;
  path: Point[];
  distance: number;
  phase: "outbound" | "chopping" | "returning";
  work: number;
  cargo: number;
}
const key = (p: Point) => `${p.x},${p.y}`;
const dirs = [{x:1,y:0}, {x:0,y:1}, {x:-1,y:0}, {x:0,y:-1}];
export const harvestable = (d: Decoration) => d.natural && isTree(d.kind) && d.kind!=="blossom";
/** Retain the visible growth stage of old stumps; mature trees stay mature.
 * Persist the deadline so repeated loads never restart or extend growth. */
export function lengthenTreeRegrowth(world: Pick<World, "tick" | "decorations">) {
  for (const d of world.decorations) {
    if (d.cutAt === undefined || d.regrowsAt !== undefined) continue;
    const remaining = Math.max(0, LEGACY_REGROW_TICKS - (world.tick - d.cutAt));
    d.regrowsAt = world.tick + remaining * (REGROW_TICKS / LEGACY_REGROW_TICKS);
  }
}
export function treeRegrowthRemaining(d: Decoration, tick: number) {
  return d.cutAt === undefined ? 0 : Math.max(0, (d.regrowsAt ?? d.cutAt + REGROW_TICKS) - tick);
}
export function treeStage(d: Decoration, tick: number) {
  const remaining = treeRegrowthRemaining(d, tick);
  if (!remaining) return "mature";
  return remaining > REGROW_TICKS * .5 ? "stump" : remaining > REGROW_TICKS * .2 ? "sapling" : "young";
}
export function forestCenter(b: Building) {
  const [w,h] = dimensions(b.kind, b.rotation, b.plot);
  return {x:b.x+(w-1)/2, y:b.y+(h-1)/2};
}
export function forestInside(b: Building, p: Point) {
  const c = forestCenter(b);
  return Math.hypot(p.x-c.x,p.y-c.y) <= FOREST_RADIUS;
}
function walkable(sim: Simulation, p: Point, blocked: Set<string>) {
  return p.x >= 0 && p.y >= 0 && p.x < SIZE && p.y < SIZE &&
    terrainCell(p.x,p.y,sim.state.terrain).kind === "land" && !blocked.has(key(p));
}
const reachCache = new WeakMap<Simulation, {stamp:string; entries:Map<string, {tree:Decoration; path:Point[]}[]>}>();
export function forestTargets(sim: Simulation, b: Building, includeRegrowing=false):{tree:Decoration;path:Point[]}[] {
  const source=sourceObject(sim);if(source!==sim){const map=(p:Point)=>turnPoint(p,viewTurn(sim));return forestTargets(source,sourceBuilding(b,viewTurn(sim)),includeRegrowing).map(t=>({tree:{...t.tree,...map(t.tree)},path:t.path.map(map)}));}
  const stamp = `${sim.state.revision}:${sim.state.tick}`;
  let cache = reachCache.get(sim);
  if (!cache || cache.stamp !== stamp) { cache = {stamp, entries:new Map()}; reachCache.set(sim,cache); }
  const identity = `${b.kind}:${b.id}:${b.x}:${b.y}:${b.rotation}`;
  const cached = cache.entries.get(identity);
  const available=(targets:{tree:Decoration;path:Point[]}[])=>b.kind==='gatherer'&&!includeRegrowing?targets.filter(t=>berryRipe(t.tree,sim.state.tick)):targets;
  if (cached) return available(cached);
  const fences=fenceEdgeSet(sim.state.decorations);
  const blocked = new Set(sim.state.buildings.flatMap(other => footprint(other.kind,other.x,other.y,other.rotation,other.plot).map(key)));
  for (const p of footprint(b.kind,b.x,b.y,b.rotation,b.plot)) blocked.add(key(p));
  for (const k of Object.keys(DEPOSIT_TILES)) if(!sim.state.clearedDeposits?.includes(k))blocked.add(k);
  for (const k of sim.roads) blocked.delete(k);
  for (const d of sim.state.decorations) if ((d.kind === "fence" && d.side===undefined) || (isTree(d.kind) && treeStage(d,sim.state.tick) === "mature" && !(b.kind==='gatherer'&&d.natural)) || (b.kind==='gatherer'&&!d.natural&&d.side===undefined&&d.kind!=='berry')) blocked.add(key(d));
  const start = sim.adjacent(b).find(p => walkable(sim,p,blocked));
  const candidates: {tree:Decoration; path:Point[]}[] = [];
  if (start) {
    const queue = [start], parents = new Map<string, Point|null>([[key(start),null]]);
    for (let i=0;i<queue.length;i++) for (const d of dirs) {
      const p=queue[i], q={x:p.x+d.x,y:p.y+d.y};
      if (!parents.has(key(q)) && !crossesFence(p,q,fences) && forestInside(b,q) && walkable(sim,q,blocked) && Math.abs(groundHeight(p.x,p.y,sim.state.terrain)-groundHeight(q.x,q.y,sim.state.terrain)) <= 8) {
        parents.set(key(q),p); queue.push(q);
      }
    }
    for (const tree of sim.state.decorations) {
      if (!(b.kind==='gatherer'?tree.kind==='berry':harvestable(tree)&&treeStage(tree,sim.state.tick)==='mature') || !forestInside(b,tree)) continue;
      const approaches = dirs.map(d => ({x:tree.x+d.x,y:tree.y+d.y})).filter(p => parents.has(key(p))&&!crossesFence(p,tree,fences));
      let best: Point[]|undefined;
      for (const p of approaches) {
        const path:Point[]=[]; let at:Point|null=p;
        while(at) { path.push(at); at=parents.get(key(at)) ?? null; }
        path.reverse();
        if (!best || path.length<best.length) best=path;
      }
      if (best) {
        const stand=best[best.length-1];
        const waypoints=b.kind==='gatherer'?best.map(p=>sim.roads.has(key(p))?p:{x:p.x+.28,y:p.y+.28}):best;
        waypoints.push({x:stand.x+(tree.x-stand.x)*.65,y:stand.y+(tree.y-stand.y)*.65});
        const path=[waypoints[0]];
        for(const p of waypoints.slice(1)){const a=path[path.length-1],steps=Math.ceil(Math.abs(p.x-a.x)+Math.abs(p.y-a.y));for(let i=1;i<=steps;i++)path.push({x:a.x+(p.x-a.x)*i/steps,y:a.y+(p.y-a.y)*i/steps});}
        candidates.push({tree,path});
      }
    }
  }
  candidates.sort((a,c)=>a.path.length-c.path.length || a.tree.id-c.tree.id);
  cache.entries.set(identity,candidates);
  return available(candidates);
}
export function landTimber(b: Building) {
  if (!b.forestry) return;
  const resource=b.kind==='gatherer'?'berries':'wood';b.inventory[resource]=(b.inventory[resource]??0)+(b.forestry??[]).reduce((n,t)=>n+t.cargo,0);
  delete b.forestry;
}
export function forestPosition(t:ForestTrip, elapsed=0) {
  const at=Math.min(t.path.length-1,t.distance+(t.phase === "chopping" ? 0 : elapsed*.75));
  const i=Math.min(Math.floor(at),Math.max(0,t.path.length-2));
  const a=t.path[i], b=t.path[Math.min(i+1,t.path.length-1)], f=at-i;
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,dx:b.x-a.x,dy:b.y-a.y};
}
export function stepForestry(sim:Simulation,b:Building) {
  b.forestry ??= [];const resource=b.kind==='gatherer'?'berries':'wood';
  const night=daylight(sim.state.tick).night;
  const crew=sim.state.agents.filter(a=>a.onsite===b.id && sim.state.residents.some(r=>r.id===a.resident && r.job===b.id));
  for (const t of [...b.forestry]) {
    const tree=sim.state.decorations.find(d=>d.id===t.tree);
    if (!crew.some(a=>a.resident===t.resident) || t.path.some(p=>terrainCell(p.x,p.y,sim.state.terrain).kind!=="land" || !!sim.buildingAt(Math.round(p.x),Math.round(p.y)))) {
      b.inventory[resource]=(b.inventory[resource]??0)+t.cargo;
      b.forestry=b.forestry.filter(other=>other!==t); continue;
    }
    if (t.phase === "chopping") {
      if (!tree || (b.kind==='gatherer'?!berryRipe(tree,sim.state.tick):treeStage(tree,sim.state.tick)!=="mature") || !b.enabled || b.construction || !b.connected) {
        t.phase="returning"; t.path.reverse(); t.distance=0; continue;
      }
      t.work+=STEP*productionRate(b)*(night?.25:1);
      wearTools(b,1,night?.25:1);
      if(t.work>=CHOP_SECONDS) {
        if(b.kind==='gatherer')tree.ripeAt=sim.state.tick+BERRY_REGROW_TICKS;
        else {tree.cutAt=sim.state.tick;tree.regrowsAt=sim.state.tick+REGROW_TICKS;}
        t.cargo=LOGS_PER_TREE;
        t.phase="returning"; t.path.reverse(); t.distance=0;
      }
    } else {
      t.distance=Math.min(t.path.length-1,t.distance+STEP*.75);
      if(t.distance>=t.path.length-1) {
        if(t.phase==="outbound") { t.phase="chopping"; t.work=0; }
        else {
          b.inventory[resource]=(b.inventory[resource]??0)+t.cargo;
          b.produced+=t.cargo;
          b.forestry=b.forestry.filter(other=>other!==t);
        }
      }
    }
  }
  if(night || b.construction || !b.enabled || !b.connected || !crew.length) return;
  const reserved=new Set(sim.state.buildings.flatMap(other=>(other.forestry??[]).filter(t=>t.phase!=="returning").map(t=>t.tree)));
  for(const a of crew) {
    if(b.forestry.some(t=>t.resident===a.resident)) continue;
    if((b.inventory[resource]??0)+b.forestry.length*LOGS_PER_TREE+LOGS_PER_TREE>outputCapacity(b)) break;
    const target=forestTargets(sim,b).find(t=>!reserved.has(t.tree.id) && (b.kind==='gatherer'?berryRipe(t.tree,sim.state.tick):treeStage(t.tree,sim.state.tick)==="mature"));
    if(!target) break;
    reserved.add(target.tree.id);
    b.forestry.push({resident:a.resident!, tree:target.tree.id,path:target.path.map(p=>({...p})),distance:0,phase:"outbound",work:0,cargo:0});
  }
}
export function validForestTrip(t:ForestTrip) {
  return !!t && Number.isInteger(t.resident) && t.resident>0 && Number.isInteger(t.tree) && t.tree>0 &&
    ["outbound","chopping","returning"].includes(t.phase) && [0,LOGS_PER_TREE].includes(t.cargo) &&
    Number.isFinite(t.work) && t.work>=0 && t.work<=CHOP_SECONDS+1 &&
    Array.isArray(t.path) && t.path.length>0 && t.path.length<=SIZE*SIZE &&
    Number.isFinite(t.distance) && t.distance>=0 && t.distance<=t.path.length-1 &&
    t.path.every((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<SIZE&&p.y<SIZE&&(!i || (Math.abs(p.x-t.path[i-1].x)+Math.abs(p.y-t.path[i-1].y)>0 && Math.abs(p.x-t.path[i-1].x)+Math.abs(p.y-t.path[i-1].y)<=1.001)));
}
