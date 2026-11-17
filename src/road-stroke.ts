import {roadWorkAt} from './roadworks.js';
import {sourceObject,sourcePoint,turnPoint,viewTurn} from './view-space.js';
import { SIZE,RESOURCE_NAMES,type Resource } from "./catalog.js";
import { groundHeight, terrainCell } from "./terrain.js";
import type { Point, Simulation } from "./simulation.js";
import { ROAD_TYPES, BRIDGE_TYPES, isRoadType, roadTypeAt, type RoadType } from "./roads.js";

export interface RoadPlan {
  tiles: Point[];
  additions: Point[];
  upgrades: Point[];
  cost: number;
  bridges: number;
  materials:Partial<Record<Resource,number>>;
  blocked?: Point;
  error?: string;
}
const tileKey = (p: Point) => `${p.x},${p.y}`;
const valid = (p: Point | undefined) => !!p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < SIZE && p.y < SIZE;

/** A connected right-angle stretch. The longer axis is drawn first. */
export function roadStroke(from: Point, to: Point): Point[] {
  if (!valid(from) || !valid(to)) return [];
  const path = [{...from}], p = {...from};
  const axes = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? ["x", "y"] as const : ["y", "x"] as const;
  for (const axis of axes) while (p[axis] !== to[axis]) {
    p[axis] += Math.sign(to[axis] - p[axis]);
    path.push({...p});
  }
  return path;
}

/** Read-only preview and command validation use precisely the same plan. */
export function planRoad(sim: Simulation, from: Point, to: Point, roadType: RoadType = "stone"): RoadPlan {
  const source=sourceObject(sim);if(source!==sim){const plan=planRoad(source,sourcePoint(sim,from),sourcePoint(sim,to),roadType),map=(p:Point)=>turnPoint(p,viewTurn(sim));return{...plan,tiles:plan.tiles.map(map),additions:plan.additions.map(map),upgrades:plan.upgrades.map(map),blocked:plan.blocked&&map(plan.blocked)};}
  const tiles = roadStroke(from, to);
  const plan: RoadPlan = { tiles, additions: tiles.filter((p) => !sim.roads.has(tileKey(p))), upgrades: [], cost: 0, bridges: 0, materials:{} };
  if (!isRoadType(roadType)) return { ...plan, error: "Choose a road surface or pedestrian pavement." };
  if (!tiles.length) return { ...plan, error: "Keep both ends of the road inside the valley." };
  if(tiles.some(p=>roadWorkAt(sim.state,p)))return {...plan,error:'Workers are already assigned to this stretch. Wait for them to finish.'};
  const chargeMaterials=(water:boolean)=>{if(water){const b=BRIDGE_TYPES[roadType];plan.materials[b.material]=(plan.materials[b.material]??0)+b.amount;}else if(roadType==="brick")plan.materials.bricks=(plan.materials.bricks??0)+1;};
  const planned = new Set(tiles.map(tileKey));
  for (const p of plan.additions) {
    const water = terrainCell(p.x, p.y, sim.state.terrain).kind === "water";
    plan.cost += water ? BRIDGE_TYPES[roadType].cost : ROAD_TYPES[roadType].cost;
    chargeMaterials(water);
    if (water) plan.bridges++;
    const error = sim.canPlace("road", p.x, p.y);
    if (error && error !== "Not enough gold yet." && !plan.error) {
      plan.error = sim.buildingAt(p.x, p.y) ? `A building blocks the route at ${p.x}, ${p.y}. Shorten the stretch or draw around it.` : error;
      plan.blocked = p;
    }
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const q = { x:p.x+dx, y:p.y+dy };
      if (!planned.has(tileKey(q))) continue;
      const a = groundHeight(p.x,p.y,sim.state.terrain), b = groundHeight(q.x,q.y,sim.state.terrain);
      const shore = water || terrainCell(q.x,q.y,sim.state.terrain).kind === "water";
      if ((Math.abs(a-b)>8 || (shore && a!==b)) && !plan.error) {
        plan.error = "Level this route first. Roads climb one height step per tile; bridge banks must be at water level.";
        plan.blocked = p;
      }
    }
  }
  for (const p of tiles) {
    if (!sim.roads.has(tileKey(p))) continue;
    const previous=roadTypeAt(sim.state.roadTypes,p),conversion=(previous==="pavement")!==(roadType==="pavement");
    const water=terrainCell(p.x,p.y,sim.state.terrain).kind==="water",current=(water?BRIDGE_TYPES:ROAD_TYPES)[previous],next=(water?BRIDGE_TYPES:ROAD_TYPES)[roadType];
    if (conversion || next.cost > current.cost) {
      plan.upgrades.push(p);
      plan.cost += conversion?Math.max(6,next.cost-current.cost):next.cost-current.cost;
      chargeMaterials(water);
    }
  }
  for(const [r,n] of Object.entries(plan.materials))if(!plan.error&&sim.stored(r as Resource)<n)plan.error=`Need ${n-sim.stored(r as Resource)} more ${RESOURCE_NAMES[r as Resource].toLowerCase()} in warehouses.${r==="bricks"?" Build a brickworks and let its deliveries arrive.":" Wait for deliveries or shorten the stretch."}`;
  if (!plan.error && plan.cost > sim.state.money) plan.error = `Need ${Math.ceil(plan.cost-sim.state.money)} more gold. Shorten the stretch or wait for taxes and local market sales.`;
  if (!plan.error && !plan.additions.length && !plan.upgrades.length) plan.error = "This stretch already has roads of this quality or better. Choose a better surface or drag farther.";
  return plan;
}
