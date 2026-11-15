import { AGENT_SPEED } from "./catalog.js";
import type { Agent, Point } from "./simulation.js";

export const ROAD_TYPES = {
  pavement: { name: "Pavement", cost: 10, speed: 1, description: "Pedestrians only", color: "#cbc4b0" },
  dirt: { name: "Dirt", cost: 6, speed: 0.75, description: "25% slower", color: "#a17b4e" },
  stone: { name: "Stone", cost: 12, speed: 1, description: "Standard speed", color: "#a3a49f" },
  brick: { name: "Brick", cost: 24, speed: 1.35, description: "35% faster", color: "#bc7860" },
} as const;
export type RoadType = keyof typeof ROAD_TYPES;
export type RoadTypes = Record<string, RoadType>;
export const isRoadType = (value: unknown): value is RoadType =>
  typeof value === "string" && Object.hasOwn(ROAD_TYPES, value);
export const roadTypeAt = (types: RoadTypes | undefined, p: Point): RoadType =>
  types?.[`${p.x},${p.y}`] ?? "stone";
export const roadSpeed = (types: RoadTypes | undefined, p: Point) =>
  ROAD_TYPES[roadTypeAt(types, p)].speed;

/** Each road tile occupies half of the route segment on either side of its
 * centre. Spend the tick's time on each surface crossed, including boundaries. */
export function roadMovement(a: Agent, seconds: number, types?: RoadTypes) {
  const start = a.segment + a.progress, end = a.path.length - 1;
  let at = start, remaining = seconds;
  while (remaining > 1e-9 && at < end - 1e-9) {
    const tile = Math.min(end, Math.floor(at + 0.5 + 1e-9));
    const speed = AGENT_SPEED[a.kind] * roadSpeed(types, a.path[tile]);
    const boundary = Math.min(end, tile + 0.5);
    const moved = Math.min(boundary - at, remaining * speed);
    at += moved;
    remaining -= moved / speed;
  }
  return Math.max(0, at - start);
}

export function roadTravelTime(path: readonly Point[], types?: RoadTypes, kind: Agent["kind"] = "person") {
  let seconds = 0;
  for (let i = 1; i < path.length; i++) {
    seconds += (0.5 / roadSpeed(types, path[i - 1]) + 0.5 / roadSpeed(types, path[i])) / AGENT_SPEED[kind];
  }
  return seconds;
}
