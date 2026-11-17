import {MARKET_GOODS} from "./market.js";
import {isLivestock} from './livestock.js';
import { BUILDINGS, buildingRecipe,buildingOutputs,isHome,FOOD_RESOURCES,RESOURCES, type Resource } from "./catalog.js";
import {toolRequirement} from './supplies.js';
import type {
  Agent,
  Building,
  Point,
  Simulation,
  World,
} from "./simulation.js";

export const LOGISTICS_COLORS = {
  input: 0x67dfcf,
  output: 0xffcc66,
  worker: 0xc4a0ff,
};
export interface GoodsConnection {
  source: number;
  target: number;
  resource: Resource;
  path: Point[] | null;
}
export interface ProductionConnections {
  building: number;
  inputs: GoodsConnection[];
  outputs: GoodsConnection[];
  workers: number[];
}

/** Shared by dispatch and inspection: all goods stay in the local supply network. */
export function canSupply(source: Building, target: Building,resource?:Resource) {
  const output = resource?[resource]:source.kind === "warehouse" ? RESOURCES : source.kind==='market'?FOOD_RESOURCES:buildingOutputs(source);
  return (
    !source.construction &&
    !target.construction?.demolition &&
    (!target.construction || output.includes('tools')) &&
    !!output.length &&
    source.id !== target.id &&
    output.some(output=>((!target.construction&&buildingRecipe(target)?.input === output) || (target.kind==="market"&&MARKET_GOODS.includes(output)) ||
      ((source.kind==='warehouse'||source.kind==='market')&&isHome(target.kind)&&(output==='wood'||FOOD_RESOURCES.includes(output))) ||
      (output==='tools'&&toolRequirement(target)>0) ||
      (target.kind === "warehouse" &&
        ["steaks","roasts","grain","milk","eggs","potatoes","carrots","sausages", "meat", "bricks", "bread", "fish", "tools", "wood", "planks", "stone", "metal"].includes(
          output,
        ))))
  );
}

/** Keep missing road links in the inspector, without inventing a map route. */
export function productionConnections(
  sim: Simulation,
  id: number,
): ProductionConnections | null {
  const b = sim.building(id);
  if (!b || !BUILDINGS[b.kind].recipe) return null;
  const link = (source: Building, target: Building): GoodsConnection[] => (source.kind==='warehouse'?RESOURCES:source.kind==='market'?FOOD_RESOURCES:buildingOutputs(source)).filter(r=>canSupply(source,target,r)).map(resource=>({
    source: source.id,
    target: target.id,
    resource,
    path: sim.route(source, target,"truck"),
  }));
  return {
    building: id,
    inputs: sim.state.buildings
      .filter((source) => canSupply(source, b))
      .flatMap((source) => link(source, b)),
    outputs: sim.state.buildings
      .filter((target) => canSupply(b, target))
      .flatMap((target) => link(b, target)),
    workers: sim.state.residents.filter((r) => r.job === id).map((r) => r.id),
  };
}

/** Road searches happen once per selection/network change, never per frame. */
export class LogisticsCache {
  private state?: World;
  private key = "";
  private value: ProductionConnections | null = null;
  get(sim: Simulation, id: number | null) {
    const key = `${id}:${sim.state.revision}`;
    if (this.state !== sim.state || this.key !== key) {
      this.state = sim.state;
      this.key = key;
      this.value = id === null ? null : productionConnections(sim, id);
    }
    return this.value;
  }
}

export function productionActivity(
  sim: Simulation,
  view: ProductionConnections,
) {
  const incoming: Agent[] = [],
    outgoing: Agent[] = [],
    workers: Agent[] = [];
  const assigned = new Set(view.workers);
  for (const a of sim.state.agents) {
    if (a.cargo && a.amount > 0) {
      if (a.target === view.building) incoming.push(a);
      if (a.source === view.building) outgoing.push(a);
    } else if (a.resident !== null && assigned.has(a.resident)) workers.push(a);
  }
  return { incoming, outgoing, workers };
}
