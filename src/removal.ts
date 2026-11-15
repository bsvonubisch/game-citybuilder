import {roadStroke} from "./road-stroke.js";
import {warehouseReady,LAST_WAREHOUSE_MESSAGE} from "./warehouses.js";
import {footprint} from "./catalog.js";
import type {Point,Simulation} from "./simulation.js";
export function planRemoval(sim:Simulation,from:Point,to:Point) {
  const tiles=roadStroke(from,to),buildings=new Set<number>(),decorations=new Set<number>(),roads=new Set<string>(),outline=new Map<string,Point>();
  for(const p of tiles) {
    const b=sim.buildingAt(p.x,p.y),k=`${p.x},${p.y}`;
    if(b){buildings.add(b.id);for(const q of footprint(b.kind,b.x,b.y,b.rotation,b.plot))outline.set(`${q.x},${q.y}`,q);}
    else if(sim.roads.has(k)){roads.add(k);outline.set(k,p);}
    else {for(const d of sim.state.decorations.filter(d=>d.x===p.x&&d.y===p.y))decorations.add(d.id);if(sim.decorationAt(p.x,p.y))outline.set(k,p);}
  }
  const removesLastDepot = !sim.state.buildings.some(b => b.kind === "warehouse" && !buildings.has(b.id));
  const removesLastWorkingDepot = sim.state.buildings.some(b => warehouseReady(b) && buildings.has(b.id)) && !sim.state.buildings.some(b => warehouseReady(b) && !buildings.has(b.id));
  const error=!tiles.length?"Keep the removal inside the valley.":removesLastDepot||removesLastWorkingDepot?LAST_WAREHOUSE_MESSAGE:!outline.size?"There is nothing to remove here.":undefined;
  return {buildings,decorations,roads,tiles:[...outline.values()],error};
}
