import { SIZE, type DecorationKind } from "./catalog.js";
import type { Point } from "./simulation.js";
export interface Decoration extends Point {
  id: number;
  kind: DecorationKind;
  natural: boolean;
  variant?: number;
  ripeAt?: number;
  cutAt?: number;
  regrowsAt?: number;
  edge?: 0|1|2|3;
  side?: 0|1|2|3;
}
export const terrainNoise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
/** Materialize the former procedural scenery once, so removals persist. */
export function initialDecorations(
  roads: ReadonlySet<string>,
  blocked: (x: number, y: number) => boolean,
  nextId: () => number,
) {
  const result: Decoration[] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (blocked(x, y) || roads.has(`${x},${y}`)) continue;
      const h = terrainNoise(x, y),
        wilderness = x < 4 || y < 3 || y > 23 || x > 22;
      const closeRoad = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => roads.has(`${x + dx},${y + dy}`));
      let kind: DecorationKind | undefined;
      if (h > (wilderness ? 0.4 : closeRoad ? 0.97 : 0.84))
        kind = wilderness
          ? h > 0.68
            ? "pine"
            : h > .61 ? "maple" : "oak"
          : h > 0.96
            ? "blossom"
            : h > 0.9
              ? "birch"
              : "oak";
      else if (closeRoad && h > 0.52 && h < 0.61)
        kind = h > 0.56 ? "planter" : "bench";
      if (kind) result.push({ id: nextId(), kind, x, y, natural: true });
    }
  return result;
}
