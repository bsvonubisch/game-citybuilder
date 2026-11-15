import { key, terrain, type Point, type Building } from "./simulation.js";
import { footprint, frontage } from "./catalog.js";
import { groundHeight, type TerrainMap } from "./terrain.js";

export const BRIDGE_HEIGHT = 6;
export const BRIDGE_PARAPET_HEIGHT = 9;
export const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const;

export function isBridge(
  roads: ReadonlySet<string>,
  x: number,
  y: number,
  map?: TerrainMap,
) {
  return terrain(x, y, map) === "water" && roads.has(key({ x, y }));
}

/** A front door on the bank is an entrance, not a closed bridge railing.
 * Side and rear walls never create an opening or an artificial connection. */
export function bridgeLandings(
  roads: ReadonlySet<string>,
  tile: Point,
  buildings: readonly Building[] = [],
  map?: TerrainMap,
) {
  return DIRECTIONS.map((d) => {
    const neighbor = { x: tile.x + d.x, y: tile.y + d.y };
    return (
      terrain(neighbor.x, neighbor.y, map) === "land" &&
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
  map?: TerrainMap,
) {
  let height = BRIDGE_HEIGHT;
  const landings = bridgeLandings(roads, tile, buildings, map);
  for (const [i, d] of DIRECTIONS.entries()) {
    if (landings[i])
      height = Math.min(
        height,
        BRIDGE_HEIGHT * Math.max(0, 0.5 - (u * d.x + v * d.y)),
      );
  }
  return height;
}

export function roadHeight(
  roads: ReadonlySet<string>,
  x: number,
  y: number,
  buildings: readonly Building[] = [],
  map?: TerrainMap,
) {
  const tile = { x: Math.round(x), y: Math.round(y) };
  if (isBridge(roads, tile.x, tile.y, map))
    return deckHeight(roads, tile, x - tile.x, y - tile.y, buildings, map);
  if (!map) return 0;
  const vertex = (dx: number, dy: number) => {
    let height = 0,
      count = 0;
    for (const nx of [tile.x, tile.x + dx])
      for (const ny of [tile.y, tile.y + dy])
        if (
          roads.has(key({ x: nx, y: ny })) &&
          terrain(nx, ny, map) === "land"
        ) {
          height += groundHeight(nx, ny, map);
          count++;
        }
    return count ? height / count : groundHeight(tile.x, tile.y, map);
  };
  const u = x - tile.x + 0.5,
    v = y - tile.y + 0.5;
  return (
    vertex(-1, -1) * (1 - u) * (1 - v) +
    vertex(1, -1) * u * (1 - v) +
    vertex(1, 1) * u * v +
    vertex(-1, 1) * (1 - u) * v
  );
}

/** Connected edges stay open, including corners and T junctions. */
export function bridgeRails(
  roads: ReadonlySet<string>,
  tile: Point,
  buildings: readonly Building[] = [],
  map?: TerrainMap,
) {
  const landings = bridgeLandings(roads, tile, buildings, map);
  return DIRECTIONS.map(
    (d, i) =>
      !roads.has(key({ x: tile.x + d.x, y: tile.y + d.y })) && !landings[i],
  );
}
