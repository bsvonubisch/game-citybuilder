import { dimensions, type BuildingKind, type HouseTier } from "./catalog.js";
import { fisheryLayout } from "./shoreline.js";

export interface Construction {
  /** Labour in worker-seconds; only builders who reached the site contribute. */
  required: number;
  completed: number;
  upgradeTo?: HouseTier;
  upgradeLevel?: HouseTier;
  /** Permanent excavation at the current deposit; completed depth is stored on the world. */
  deeperTo?: number;
}
const LABOUR: Record<BuildingKind, number> = {
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
