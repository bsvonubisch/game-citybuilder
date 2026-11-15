import { dimensions, type BuildingKind, type HouseTier } from "./catalog.js";
import { fisheryLayout } from "./shoreline.js";
import { daylight } from "./daylight.js";
import type { Building, Point, Simulation } from "./simulation.js";
export const ROCK_CLEARING_WORK = 12;

/** The roster follows actual job assignments, including builders still on a journey. */
export function constructionCrew(sim: Simulation, site: Building) {
  if (!site.construction) return [];
  const night = daylight(sim.state.tick).night;
  return sim.state.residents
    .filter((r) => r.job === site.id)
    .map((resident) => {
      const agent = sim.state.agents.find((a) => a.resident === resident.id);
      const onsite = agent?.onsite === site.id;
      const status = !site.enabled
        ? "Construction paused"
        : !site.connected
          ? "Waiting for road access"
          : onsite
            ? night
              ? "Working on site · night pace"
              : site.construction?.clearance ? "Clearing surface rocks" : "Working on site"
            : agent?.active !== false && agent
              ? agent.target === site.id && !agent.returning
                ? "Travelling to site"
                : "Finishing current journey"
              : night && resident.id % 4 !== 0
                ? "Resting until morning"
                : agent?.target !== site.id && agent
                  ? "Finishing current visit"
                  : "Preparing to leave";
      return { resident, agent, onsite, status };
    });
}

export interface Construction {
  /** Labour in worker-seconds; only builders who reached the site contribute. */
  required: number;
  completed: number;
  /** Surface clearance happens before foundations; geology remains underground. */
  clearance?: { tiles: Point[]; work: number };
  upgradeTo?: HouseTier;
  upgradeLevel?: HouseTier;
  /** Permanent excavation at the current deposit; completed depth is stored on the world. */
  deeperTo?: number;
}
const LABOUR: Record<BuildingKind, number> = {
  market:220,
  church:500,
  garden:450,
  cottage:80,
  brickworks:280,
  house: 120,
  farm: 160,
  fishery: 220,
  mill: 240,
  bakery: 200,
  forester: 140,
  sawmill: 220,
  workshop: 280,
  warehouse: 240,
  park: 100,
  tavern: 260,
  quarry: 200,
  mine: 280,
};
export function builderFrame(
  variant: number,
  side: number,
  time: number,
  active: boolean,
) {
  const row = (variant % 2) * 2 + (side % 2);
  const sequence = [0, 1, 1, 2, 3, 0];
  const pose = active ? sequence[Math.floor(time * 5) % sequence.length] : 0;
  return {
    frame: row * 4 + pose,
    originX: [0.39, 0.67, 0.37, 0.65][row],
    originY: [0.87, 0.86, 0.87, 0.87][row],
    size: row < 2 ? 25 : 27,
  };
}
export function constructionWork(kind: BuildingKind, upgradeTo?: HouseTier) {
  return upgradeTo ? (upgradeTo === 3 ? 600 : 300) : LABOUR[kind];
}
export function builderCapacity(b: {
  kind: BuildingKind;
  rotation: number;
  plot?: readonly [number, number];
}) {
  const [w, h] = dimensions(b.kind, b.rotation, b.plot);
  return Math.min(4, Math.max(2, Math.ceil((w * h) / 2)));
}
export function builderPosition(
  b: {
    x: number;
    y: number;
    kind: BuildingKind;
    rotation: number;
    plot?: readonly [number, number];
  },
  slot: number,
) {
  const [w, h] = dimensions(b.kind, b.rotation, b.plot);
  const land =
    b.kind === "fishery"
      ? fisheryLayout(b.rotation).land
      : { x: 0, y: 0, width: w, height: h };
  return {
    x: b.x + land.x - 0.5 + land.width * (slot % 2 ? 0.72 : 0.28),
    y: b.y + land.y - 0.5 + land.height * (slot < 2 ? 0.7 : 0.38),
  };
}
