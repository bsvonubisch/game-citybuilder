import { key, terrain, type Point } from "./simulation.js";

export const BRIDGE_HEIGHT = 6;
export const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const;

export function isBridge(roads: ReadonlySet<string>, x: number, y: number) {
  return terrain(x, y) === "water" && roads.has(key({ x, y }));
}

/** Shared by the deck mesh and travellers: level over water, sloped at land exits. */
export function deckHeight(
  roads: ReadonlySet<string>,
  tile: Point,
  u: number,
  v: number,
) {
  let height = BRIDGE_HEIGHT;
  for (const d of DIRECTIONS) {
    const neighbor = { x: tile.x + d.x, y: tile.y + d.y };
    if (roads.has(key(neighbor)) && terrain(neighbor.x, neighbor.y) === "land")
      height = Math.min(
        height,
        BRIDGE_HEIGHT * Math.max(0, 1 - 2 * (u * d.x + v * d.y)),
      );
  }
  return height;
}

export function roadHeight(roads: ReadonlySet<string>, x: number, y: number) {
  const tile = { x: Math.round(x), y: Math.round(y) };
  return isBridge(roads, tile.x, tile.y)
    ? deckHeight(roads, tile, x - tile.x, y - tile.y)
    : 0;
}

/** Connected edges stay open, including corners and T junctions. */
export function bridgeRails(roads: ReadonlySet<string>, tile: Point) {
  return DIRECTIONS.map(
    (d) => !roads.has(key({ x: tile.x + d.x, y: tile.y + d.y })),
  );
}
