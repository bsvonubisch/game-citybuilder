import {isHome} from "./catalog.js";
import { houseCapacity, type BuildingKind } from "./catalog.js";
import { roadTravelTime } from "./roads.js";
import type { Building, Simulation } from "./simulation.js";
export const MAX_COMMUTE = 28;
export const isLeisure = (kind: string) => kind === "park" || kind === "garden" || kind === "tavern";
export const isService=(kind:string)=>isLeisure(kind)||kind==="church";
export const serviceRange = (kind: string) => (kind === "market" ? 18 : kind === "church" ? 20 : kind === "tavern" ? 14 : kind === "garden" ? 18 : 10);
export const serviceCapacity = (b: Building) =>
  (b.kind === "market" ? 2400 : b.kind === "church" ? 40 : b.kind === "tavern" ? 18 : b.kind === "garden" ? 40 : 12) * (b.level ?? 1);
export const serviceOpen = (kind: string, hour: number) =>
  kind === "church" ? hour >= 8 && hour < 20 : kind === "tavern" ? hour >= 17 || hour < 2 : hour >= 6 && hour < 20;
export function serviceCoverage(sim: Simulation, b: Building) {
  const range = serviceRange(b.kind),
    capacity = serviceCapacity(b);
  const connected = sim.state.buildings.some(
    (w) =>
      w.kind === "warehouse" &&
      (!w.construction || w.construction.upgradeLevel) &&
      sim.route(b, w),
  );
  let remaining = capacity;
  const homes = connected
    ? sim.state.buildings
        .filter(
          (h) =>
            isHome(h.kind) && (!h.construction || h.construction.upgradeTo || h.construction.upgradeLevel),
        )
        .map((home) => {
          const path = sim.route(b, home),
            tiles = path ? path.length - 1 : Infinity;
          return { home, path, tiles, seconds: path ? roadTravelTime(path, sim.state.roadTypes) : Infinity };
        })
        .filter((h) => h.tiles <= range)
        .sort((a, b) => a.tiles - b.tiles || a.home.id - b.home.id)
        .map((h) => {
          const served = Math.min(remaining, houseCapacity(h.home));
          remaining -= served;
          return { ...h, served };
        })
    : [];
  return { connected, range, capacity, residents: capacity - remaining, homes };
}
export function servicePreview(
  kind: BuildingKind,
  x: number,
  y: number,
  rotation: 0 | 1 | 2 | 3,
  level = 1,
): Building {
  return {
    id: -1,
    kind,
    x,
    y,
    rotation,
    level: level as 1 | 2 | 3,
    inventory: {},
    progress: 0,
    workers: 0,
    connected: false,
    enabled: true,
    produced: 0,
  };
}
