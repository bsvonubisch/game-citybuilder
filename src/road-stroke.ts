import { SIZE } from "./catalog.js";
import { groundHeight, terrainCell } from "./terrain.js";
import type { Point, Simulation } from "./simulation.js";
import { ROAD_TYPES, isRoadType, roadTypeAt, type RoadType } from "./roads.js";

export interface RoadPlan {
  tiles: Point[];
  additions: Point[];
  upgrades: Point[];
  cost: number;
  bridges: number;
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
  const tiles = roadStroke(from, to);
  const plan: RoadPlan = { tiles, additions: tiles.filter((p) => !sim.roads.has(tileKey(p))), upgrades: [], cost: 0, bridges: 0 };
  if (!isRoadType(roadType)) return { ...plan, error: "Choose dirt, stone or brick roads." };
  if (!tiles.length) return { ...plan, error: "Keep both ends of the road inside the valley." };
  const planned = new Set(tiles.map(tileKey));
  for (const p of plan.additions) {
    const water = terrainCell(p.x, p.y, sim.state.terrain).kind === "water";
    plan.cost += water ? 35 : ROAD_TYPES[roadType].cost;
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
    if (!sim.roads.has(tileKey(p)) || terrainCell(p.x, p.y, sim.state.terrain).kind === "water") continue;
    const current = ROAD_TYPES[roadTypeAt(sim.state.roadTypes, p)];
    if (ROAD_TYPES[roadType].cost > current.cost) {
      plan.upgrades.push(p);
      plan.cost += ROAD_TYPES[roadType].cost - current.cost;
    }
  }
  if (!plan.error && plan.cost > sim.state.money) plan.error = `Need ${Math.ceil(plan.cost-sim.state.money)} more gold. Shorten the stretch or wait for taxes and exports.`;
  if (!plan.error && !plan.additions.length && !plan.upgrades.length) plan.error = "This stretch already has roads of this quality or better. Choose a better surface or drag farther.";
  return plan;
}
