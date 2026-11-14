import { key, terrain, type Point, type Building } from "./simulation.js";
import { footprint, frontage } from "./catalog.js";

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

/** A front door on the bank is an entrance, not a closed bridge railing.
 * Side and rear walls never create an opening or an artificial connection. */
export function bridgeLandings(
  roads: ReadonlySet<string>,
  tile: Point,
  buildings: readonly Building[] = [],
) {
  return DIRECTIONS.map((d) => {
    const neighbor = { x: tile.x + d.x, y: tile.y + d.y };
    return (
      terrain(neighbor.x, neighbor.y) === "land" &&
      (roads.has(key(neighbor)) ||
        buildings.some(
          (b) =>
            frontage(b.kind, b.x, b.y, b.rotation, b.plot).some(
              (p) => key(p) === key(tile),
            ) &&
            footprint(b.kind, b.x, b.y, b.rotation, b.plot).some(
              (p) => key(p) === key(neighbor),
            ),
        ))
    );
  });
}

/** Shared by the deck mesh and travellers: level over water, sloped at land exits. */
export function deckHeight(
  roads: ReadonlySet<string>,
  tile: Point,
  u: number,
  v: number,
  buildings: readonly Building[] = [],
) {
  let height = BRIDGE_HEIGHT;
  const landings = bridgeLandings(roads, tile, buildings);
  for (const [i, d] of DIRECTIONS.entries()) {
    if (landings[i])
      height = Math.min(
        height,
        BRIDGE_HEIGHT * Math.max(0, 1 - 2 * (u * d.x + v * d.y)),
      );
  }
  return height;
}

export function roadHeight(
  roads: ReadonlySet<string>,
  x: number,
  y: number,
  buildings: readonly Building[] = [],
) {
  const tile = { x: Math.round(x), y: Math.round(y) };
  return isBridge(roads, tile.x, tile.y)
    ? deckHeight(roads, tile, x - tile.x, y - tile.y, buildings)
    : 0;
}

/** Connected edges stay open, including corners and T junctions. */
export function bridgeRails(
  roads: ReadonlySet<string>,
  tile: Point,
  buildings: readonly Building[] = [],
) {
  const landings = bridgeLandings(roads, tile, buildings);
  return DIRECTIONS.map(
    (d, i) =>
      !roads.has(key({ x: tile.x + d.x, y: tile.y + d.y })) && !landings[i],
  );
}
