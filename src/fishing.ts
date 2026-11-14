import { BUILDINGS, FRONT_DIRECTIONS, SIZE, STEP } from "./catalog.js";
import { fisheryCells } from "./shoreline.js";
import { terrainCell } from "./terrain.js";
import { daylight } from "./daylight.js";
import type { Building, Point, Simulation } from "./simulation.js";

export interface FishingTrip {
  path: Point[];
  distance: number;
  phase: "outbound" | "fishing" | "returning";
  cargo: number;
}
export const BOAT_SPEED = 0.55;
const key = (p: Point) => `${p.x},${p.y}`;
const inside = (p: Point) =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.y) &&
  p.x >= 0 &&
  p.y >= 0 &&
  p.x < SIZE &&
  p.y < SIZE;
export function boatBerths(b: Building) {
  const front = FRONT_DIRECTIONS[b.rotation];
  return fisheryCells(b.x, b.y, b.rotation)
    .filter((p) => p.kind === "water")
    .map((p) => ({ x: p.x - front.x, y: p.y - front.y }));
}
export function openWater(sim: Simulation, p: Point) {
  return (
    inside(p) &&
    terrainCell(p.x, p.y, sim.state.terrain).kind === "water" &&
    !sim.roads.has(key(p)) &&
    !sim.buildingAt(p.x, p.y)
  );
}
/** A trip reserves its narrow water corridor until it returns. Boats never share
 * tiles, cross low bridge decks, or sail through another fishery's pier. */
export function fishingRoute(sim: Simulation, b: Building): Point[] | null {
  const reserved = new Set(
    sim.state.buildings
      .filter(
        (other) =>
          other.id !== b.id && other.kind === "fishery" && !other.construction,
      )
      .flatMap((other) => [
        ...boatBerths(other).map(key),
        ...(other.fishing?.path.map(key) ?? []),
      ]),
  );
  // A fixed mooring prevents the boat jumping between the two ends of its pier.
  const berth = boatBerths(b).find((p) => openWater(sim, p));
  const berths = berth ? [berth] : [];
  for (const berth of berths) {
    if (!openWater(sim, berth) || reserved.has(key(berth))) continue;
    const paths: Point[][] = [[berth]],
      seen = new Set([key(berth)]);
    let best: Point[] | null = null;
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i],
        p = path[path.length - 1];
      if (path.length >= 3 && (!best || path.length > best.length)) best = path;
      if (path.length >= 6) continue;
      for (const d of FRONT_DIRECTIONS) {
        const next = { x: p.x + d.x, y: p.y + d.y },
          k = key(next);
        if (seen.has(k) || reserved.has(k) || !openWater(sim, next)) continue;
        seen.add(k);
        paths.push([...path, next]);
      }
    }
    if (best) return best;
  }
  return null;
}
export function fishingActive(b: Building) {
  return (
    !b.construction &&
    b.enabled &&
    b.connected &&
    b.workers >= BUILDINGS.fishery.jobs
  );
}
export function landCatch(b: Building) {
  if (b.fishing?.cargo)
    b.inventory.fish = (b.inventory.fish ?? 0) + b.fishing.cargo;
  delete b.fishing;
}
export function stepFishing(sim: Simulation, b: Building) {
  let trip = b.fishing;
  if (
    trip &&
    (!boatBerths(b).some((p) => key(p) === key(trip!.path[0])) ||
      trip.path.some((p) => !openWater(sim, p)))
  ) {
    // Moving the fishery or changing the water recovers its catch, never loses it.
    landCatch(b);
    trip = undefined;
  }
  if (!fishingActive(b)) return;
  if (!trip) {
    if (daylight(sim.state.tick).night) return;
    if ((b.inventory.fish ?? 0) >= 20) return;
    const path = fishingRoute(sim, b);
    if (!path) return;
    b.fishing = { path, distance: 0, phase: "outbound", cargo: 0 };
    return;
  }
  if (trip.phase === "fishing") {
    b.progress += STEP;
    if (b.progress >= BUILDINGS.fishery.recipe!.seconds) {
      b.progress = 0;
      trip.cargo = BUILDINGS.fishery.recipe!.count;
      b.produced += trip.cargo;
      trip.phase = "returning";
    }
  } else {
    trip.distance = Math.max(
      0,
      Math.min(
        trip.path.length - 1,
        trip.distance +
          BOAT_SPEED * STEP * (trip.phase === "outbound" ? 1 : -1),
      ),
    );
    if (trip.phase === "outbound" && trip.distance === trip.path.length - 1)
      trip.phase = "fishing";
    else if (trip.phase === "returning" && trip.distance === 0) landCatch(b);
  }
}
export function boatPose(trip: FishingTrip, elapsed = 0) {
  const direction = trip.phase === "returning" ? -1 : 1;
  const distance = Math.max(
    0,
    Math.min(
      trip.path.length - 1,
      trip.distance +
        (trip.phase === "fishing"
          ? 0
          : Math.min(STEP, elapsed) * BOAT_SPEED * direction),
    ),
  );
  const index = Math.min(
    trip.path.length - 2,
    Math.max(0, direction < 0 ? Math.ceil(distance) - 1 : Math.floor(distance)),
  );
  const a = trip.path[index],
    b = trip.path[index + 1],
    fraction = distance - index;
  const dx = (b.x - a.x) * direction,
    dy = (b.y - a.y) * direction;
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    dx,
    dy,
    frame: dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3,
  };
}
export function validFishingTrip(value: FishingTrip) {
  return (
    !!value &&
    Array.isArray(value.path) &&
    value.path.length >= 3 &&
    value.path.length <= 6 &&
    value.path.every(
      (p, i) =>
        p &&
        inside(p) &&
        (i === 0 ||
          Math.abs(p.x - value.path[i - 1].x) +
            Math.abs(p.y - value.path[i - 1].y) ===
            1),
    ) &&
    new Set(value.path.map(key)).size === value.path.length &&
    Number.isFinite(value.distance) &&
    value.distance >= 0 &&
    value.distance <= value.path.length - 1 &&
    ["outbound", "fishing", "returning"].includes(value.phase) &&
    value.cargo ===
      (value.phase === "returning" ? BUILDINGS.fishery.recipe!.count : 0) &&
    (value.phase !== "fishing" || value.distance === value.path.length - 1)
  );
}
export const fishingStatus = (b: Building) =>
  b.fishing?.phase === "outbound"
    ? "Sailing to fishing grounds"
    : b.fishing?.phase === "returning"
      ? "Returning with fish"
      : b.fishing?.phase === "fishing"
        ? "Fishing offshore"
        : "Boat moored at pier";
