import {
  BUILDINGS,
  HOUSE_TIERS,
  RESOURCE_NAMES,
  buildingName,
  type HouseTier,
  type Resource,
} from "./catalog.js";
import { constructionWork } from "./construction.js";
import type { Building, Simulation } from "./simulation.js";

/** Explain actual warehouse shortfalls, including goods already being delivered. */
export function materialGuidance(
  sim: Simulation,
  cost: number,
  materials: Partial<Record<Resource, number>>,
) {
  const steps: string[] = [];
  if (sim.state.money < cost)
    steps.push(
      `Earn ${Math.ceil(cost - sim.state.money)} more gold from household taxes or tool exports.`,
    );
  for (const [resource, required] of Object.entries(materials)) {
    const r = resource as Resource,
      have = sim.stored(r);
    if (have >= required) continue;
    const missing = required - have;
    const inbound = sim.state.agents
      .filter(
        (a) => a.cargo === r && sim.building(a.target)?.kind === "warehouse",
      )
      .reduce((total, a) => total + a.amount, 0);
    const supplier = sim.state.buildings.find(
      (b) => BUILDINGS[b.kind].recipe?.output === r,
    );
    const producer = Object.values(BUILDINGS).find(
      (b) => b.recipe?.output === r,
    );
    const supply =
      inbound >= missing
        ? `${inbound} are already on the way; wait for the warehouse delivery.`
        : supplier?.construction
          ? `Finish the ${buildingName(supplier).toLowerCase()} construction so it can supply them.`
          : supplier
            ? `Check the ${buildingName(supplier).toLowerCase()}: it needs staff, supplies and a road to a warehouse. Wait for its goods to be delivered.`
            : producer
              ? `Build and connect a ${producer.name.toLowerCase()} to supply them.`
              : "Get these goods delivered to a warehouse.";
    steps.push(
      `Need ${missing} more ${RESOURCE_NAMES[r].toLowerCase()} (${have} of ${required} in warehouses). ${supply}`,
    );
  }
  return steps;
}
export const buildingLevel = (b: Building) =>
  b.kind === "house" ? (b.houseTier ?? 1) : (b.level ?? 1);
export const productionRate = (b: Building) => 1 + ((b.level ?? 1) - 1) * 0.35;
export const outputCapacity = (b: Building) => 20 * (b.level ?? 1);
export function nextUpgrade(b: Building) {
  const level = buildingLevel(b);
  if (level >= 3) return null;
  const next = (level + 1) as HouseTier;
  if (b.kind === "house")
    return {
      ...HOUSE_TIERS[next],
      level: next,
      labour: constructionWork("house", next),
      benefit: "Three more residents · same plot.",
    };
  if (b.kind === "cottage") return {level:next, name:`Little cottage · level ${next}`, cost:55 * next, materials:{wood:next*3,stone:next*2}, labour:constructionWork("cottage")*next, benefit:`Room for ${next+1} residents · same 1×1 plot.`};
  return {
    level: next,
    name: `${BUILDINGS[b.kind].name} · level ${next}`,
    cost: BUILDINGS[b.kind].cost * next,
    materials: {
      planks: next * 8,
      stone: next * 8,
      metal: next === 3 ? 12 : 4,
    } as Partial<Record<Resource, number>>,
    labour: constructionWork(b.kind) * next,
    benefit:
      b.kind === "market" ? `Sales earn ${Math.round((1+(next-1)*.1)*100)}% gold · same stalls, staff and plot.` : b.kind === "church" || b.kind === "tavern" || b.kind === "park" || b.kind === "garden"
        ? `Serves ${next * (b.kind === "church" || b.kind === "garden" ? 40 : b.kind === "tavern" ? 18 : 12)} nearby residents; walking range stays the same.`
        : b.kind === "warehouse"
          ? `Tool exports earn ${Math.round(35 * (1 + (next - 1) * 0.1))} gold each. Stock and road network stay here.`
          : `Production ${Math.round((1 + (next - 1) * 0.35) * 100)}% · output storage ${20 * next} · same workers and footprint.`,
  };
}
