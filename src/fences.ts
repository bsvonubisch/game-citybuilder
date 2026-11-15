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

export function fenceNeighbour(p:Point,side:number){const d=FENCE_DIRECTIONS[side];return{x:p.x+d.x,y:p.y+d.y};}
export function fenceKey(p:Point,side:number){const q=fenceNeighbour(p,side);return [p.x+','+p.y,q.x+','+q.y].sort().join('|');}
export function fenceEnds(p:Point,side:number):[Point,Point]{
  const d=FENCE_DIRECTIONS[side],c={x:p.x+d.x*.5,y:p.y+d.y*.5};
  return[{x:c.x-d.y*.5,y:c.y-d.x*.5},{x:c.x+d.y*.5,y:c.y+d.x*.5}];
}
export function nearestFenceSide(tile:Point,p:Point):0|1|2|3{const x=p.x-tile.x,y=p.y-tile.y;return Math.abs(x)>Math.abs(y)?x>0?0:2:y>0?1:3;}
export const fenceEdgeSet=(decorations:readonly Decoration[])=>new Set(decorations.filter(d=>d.kind==='fence'&&d.side!==undefined).map(d=>fenceKey(d,d.side!)));
export function crossesFence(a:Point,b:Point,edges:ReadonlySet<string>){return edges.has([a.x+','+a.y,b.x+','+b.y].sort().join('|'));}
export function fencePostMask(d:Pick<Decoration,'id'|'x'|'y'|'side'>,decorations:readonly Decoration[]){
  return fenceEnds(d,d.side??1).reduce((mask,p,i)=>mask|(decorations.some(other=>other.kind==='fence'&&other.id<d.id&&fenceEnds(other,other.side??1).some(q=>q.x===p.x&&q.y===p.y))?0:1<<i),0);
}
