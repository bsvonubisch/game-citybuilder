import {STEP} from './catalog.js';
import {berryRipe} from './gathering.js';
import {forestInside,forestTargets} from './forestry.js';
import {iso} from './rendering.js';
import {groundHeight} from './terrain.js';
import {sourceObject,sourceBuilding,turnPoint,viewTurn} from './view-space.js';
import type {Decoration} from './decorations.js';
import type {Building,Simulation} from './simulation.js';

export const BERRY_STATES={
  ripe:{label:'Ripe',color:0x72bc85},
  gathering:{label:'Being gathered',color:0x79b8dc},
  regrowing:{label:'Regrowing',color:0xdcb35f},
  blocked:{label:'No route',color:0xd28177},
} as const;
export type BerryState=keyof typeof BERRY_STATES;
export interface BerryMarker {bush:Decoration;state:BerryState;remaining:number}

/** The selection and inspector share the same real paths, fruit timers and reservations. */
export function gatheringArea(sim:Simulation,b:Building):BerryMarker[]{
  const source=sourceObject(sim),turn=viewTurn(sim);
  if(source!==sim)return gatheringArea(source,sourceBuilding(b,turn)).map(m=>({...m,bush:{...m.bush,...turnPoint(m.bush,turn)}}));
  const reachable=new Set(forestTargets(sim,b,true).map(t=>t.tree.id));
  const assigned=new Set(sim.state.buildings.filter(other=>other.kind==='gatherer').flatMap(other=>(other.forestry??[]).filter(t=>t.phase!=='returning').map(t=>t.tree)));
  return sim.state.decorations.filter(d=>d.kind==='berry'&&forestInside(b,d)).map(bush=>({
    bush,
    state:!reachable.has(bush.id)?'blocked':!berryRipe(bush,sim.state.tick)?'regrowing':assigned.has(bush.id)?'gathering':'ripe',
    remaining:Math.ceil(Math.max(0,(bush.ripeAt??0)-sim.state.tick)*STEP),
  }));
}

/** Match the actual decoration's bottom-centre anchor, including its three-pixel ground offset. */
export function berryMarkerPoint(sim:Simulation,bush:Decoration){
  const p=iso(bush.x,bush.y);return {x:p.x,y:p.y+3-groundHeight(bush.x,bush.y,sim.state.terrain)};
}
export function gatheringSummary(markers:BerryMarker[]){
  const counts={ripe:0,gathering:0,regrowing:0,blocked:0};
  for(const m of markers)counts[m.state]++;
  const times=markers.filter(m=>m.state==='regrowing').map(m=>m.remaining);
  return {...counts,nextRipe:times.length?Math.min(...times):0};
}
