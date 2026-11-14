import type { Decoration } from "./decorations.js";
import type { Point } from "./simulation.js";

export const FENCE_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const;
/** A shared half-span on each occupied cardinal edge; diagonal pieces don't join. */
export function fenceMask(point: Point, decorations: readonly Decoration[]) {
  return FENCE_DIRECTIONS.reduce(
    (mask, d, i) =>
      mask |
      (decorations.some(
        (n) =>
          n.kind === "fence" && n.x === point.x + d.x && n.y === point.y + d.y,
      )
        ? 1 << i
        : 0),
    0,
  );
}
export function fenceSpans(mask: number): readonly [Point, Point][] {
  return mask === 0
    ? [
        [
          { x: -0.38, y: 0 },
          { x: 0.38, y: 0 },
        ],
      ]
    : FENCE_DIRECTIONS.flatMap((d, i) =>
        mask & (1 << i)
          ? [
              [
                { x: 0, y: 0 },
                { x: d.x / 2, y: d.y / 2 },
              ] as [Point, Point],
            ]
          : [],
      );
}
