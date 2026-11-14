import {
  BUILDINGS,
  HOUSE_TIERS,
  type HouseTier,
  type Resource,
} from "./catalog.js";
import { constructionWork } from "./construction.js";
import type { Building } from "./simulation.js";
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
      b.kind === "tavern" || b.kind === "park"
        ? `Serves ${next * (b.kind === "tavern" ? 18 : 12)} nearby residents; walking range stays the same.`
        : b.kind === "warehouse"
          ? `Tool exports earn ${Math.round(35 * (1 + (next - 1) * 0.1))} gold each. Stock and road network stay here.`
          : `Production ${Math.round((1 + (next - 1) * 0.35) * 100)}% · output storage ${20 * next} · same workers and footprint.`,
  };
}
