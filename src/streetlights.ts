import {FENCE_DIRECTIONS} from "./fences.js";
import type {Decoration} from "./decorations.js";
import type {Point} from "./simulation.js";
import type {Simulation} from "./simulation.js";
import {iso} from "./rendering.js";
import {groundHeight} from "./terrain.js";
import {roadHeight,isBridge,BRIDGE_PARAPET_HEIGHT} from "./bridges.js";
import {roadTypeAt} from "./roads.js";
export const roadEdges=(roads:ReadonlySet<string>,p:Point)=>FENCE_DIRECTIONS.map((d,i)=>({d,i})).filter(({d})=>!roads.has(`${p.x+d.x},${p.y+d.y}`)).map(({i})=>i);
export function lampPoint(d:Pick<Decoration,"x"|"y"|"edge">):Point {
  if(d.edge===undefined)return d;
  const direction=FENCE_DIRECTIONS[d.edge];return{x:d.x+direction.x*.495,y:d.y+direction.y*.495};
}
/** Curbs follow the road surface. Masonry bridge lamps mount on the coping;
 * timber lamps stand on the deck beside the rail, never down at water level. */
export function lampPlacement(sim:Simulation,d:Pick<Decoration,"x"|"y"|"edge">) {
  const point=lampPoint(d),screen=iso(point.x,point.y);
  const road=d.edge!==undefined&&sim.roads.has(`${d.x},${d.y}`);
  const bridge=road&&isBridge(sim.roads,d.x,d.y,sim.state.terrain);
  const kind=roadTypeAt(sim.state.roadTypes,d);
  const elevation=road?roadHeight(sim.roads,point.x,point.y,sim.state.buildings,sim.state.terrain)+(bridge&&(kind==="stone"||kind==="brick")?BRIDGE_PARAPET_HEIGHT:0):groundHeight(d.x,d.y,sim.state.terrain);
  screen.y-=elevation;
  return {point,screen,elevation,bridge};
}
export function nearestRoadEdge(roads:ReadonlySet<string>,tile:Point,p:Point) {
  return roadEdges(roads,tile).sort((a,b)=>{
    const u=lampPoint({...tile,edge:a as 0|1|2|3}),v=lampPoint({...tile,edge:b as 0|1|2|3});
    return Math.hypot(u.x-p.x,u.y-p.y)-Math.hypot(v.x-p.x,v.y-p.y);
  })[0]??0;
}

/** Road widening may turn an old curb into a traffic lane. Keep posts outside. */
export function reconcileRoadLamps(decorations:Decoration[],roads:ReadonlySet<string>) {
  const occupied=new Set<string>();
  return decorations.filter(d=>{
    if(d.edge===undefined)return true;
    const edges=roads.has(`${d.x},${d.y}`)?roadEdges(roads,d):[];
    const free=edges.filter(e=>!occupied.has(`${d.x},${d.y}:${e}`));
    const edge=free.includes(d.edge)?d.edge:free[0];
    if(edge===undefined)return false;
    d.edge=edge as 0|1|2|3;occupied.add(`${d.x},${d.y}:${edge}`);return true;
  });
}
