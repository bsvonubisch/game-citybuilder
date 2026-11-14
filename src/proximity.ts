import { houseCapacity, type BuildingKind, AGENT_SPEED } from "./catalog.js";
import type { Building, Simulation } from "./simulation.js";
export const MAX_COMMUTE = 28;
export const isLeisure = (kind: string) => kind === "park" || kind === "tavern";
export const serviceRange = (kind: string) => (kind === "tavern" ? 14 : 10);
export const serviceCapacity = (b: Building) =>
  (b.kind === "tavern" ? 18 : 12) * (b.level ?? 1);
export const serviceOpen = (kind: string, hour: number) =>
  kind === "tavern" ? hour >= 17 || hour < 2 : hour >= 6 && hour < 20;
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
            h.kind === "house" && (!h.construction || h.construction.upgradeTo),
        )
        .map((home) => {
          const path = sim.route(b, home),
            tiles = path ? path.length - 1 : Infinity;
          return { home, path, tiles, seconds: tiles / AGENT_SPEED.person };
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
