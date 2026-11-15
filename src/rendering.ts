import type { GroundPoint, PlotCorners } from "./building-art.js";
import type { Agent } from "./simulation.js";
import { AGENT_SPEED, STEP } from "./catalog.js";

export const iso = (x: number, y: number) => ({
  x: (x - y) * 32,
  y: (x + y) * 16,
});
export interface OccludingPlot {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** Mixed plot sizes cannot be sorted by their frontmost corner alone: a 1×1
 * home along the near edge of a 2×2/4×4 plot must appear above that plot.
 * Resolve non-ambiguous footprint relations once after town edits. */
export function buildingDepths(plots: readonly (OccludingPlot & {id:number})[]) {
  const result=new Map(plots.map(p=>[p.id,p.depth]));
  const after=new Map(plots.map(p=>[p.id,[] as number[]]));
  const pending=new Map(plots.map(p=>[p.id,0]));
  for(let i=0;i<plots.length;i++)for(let j=i+1;j<plots.length;j++){
    const a=plots[i],b=plots[j];
    if(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom)continue;
    const aBehind=a.x+a.width<=b.x||a.y+a.height<=b.y;
    const bBehind=b.x+b.width<=a.x||b.y+b.height<=a.y;
    // Diagonally separated plots have no unambiguous near/far relation.
    if(aBehind===bBehind)continue;
    const [back,front]=aBehind?[a,b]:[b,a];
    after.get(back.id)!.push(front.id);pending.set(front.id,pending.get(front.id)!+1);
  }
  const queue=plots.filter(p=>pending.get(p.id)===0).sort((a,b)=>a.depth-b.depth||a.id-b.id).map(p=>p.id);
  for(let i=0;i<queue.length;i++){
    const id=queue[i];
    for(const next of after.get(id)!){
      result.set(next,Math.max(result.get(next)!,result.get(id)!+1));
      pending.set(next,pending.get(next)!-1);
      if(pending.get(next)===0)queue.push(next);
    }
  }
  return result;
}
/** A multi-tile building has two front edges, not a single frontmost point.
 * Keep a traveller in front of either near edge, and behind both far edges.
 * Screen bounds limit comparisons to artwork that can actually overlap. */
export function travellerDepth(
  p: { x: number; y: number },
  bounds: { left: number; right: number; top: number; bottom: number },
  plots: readonly OccludingPlot[],
  rearWins = false,
) {
  const natural = (p.x + p.y) * 32 + 16;
  let lower = -Infinity,
    upper = Infinity;
  for (const b of plots) {
    if (
      bounds.right <= b.left ||
      bounds.left >= b.right ||
      bounds.bottom <= b.top ||
      bounds.top >= b.bottom
    )
      continue;
    if (p.x >= b.x + b.width - 0.5 || p.y >= b.y + b.height - 0.5)
      lower = Math.max(lower, b.depth + 1);
    else upper = Math.min(upper, b.depth - 1);
  }
  // Thin fences between staggered plots must disappear behind the nearer wall
  // when two whole-sprite ordering constraints cannot both be satisfied.
  return rearWins?Math.min(upper,Math.max(lower,natural)):Math.max(lower, Math.min(upper, natural));
}
/** Phaser's default camera zooms about its center, not its top-left corner. */
export function cameraViewport(c: {
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  zoom: number;
}) {
  const width = c.width / c.zoom,
    height = c.height / c.zoom;
  return {
    x: c.scrollX + (c.width - width) / 2,
    y: c.scrollY + (c.height - height) / 2,
    width,
    height,
  };
}
export const groundCoordinates = (x: number, y: number) => ({
  x: x / 64 + y / 32,
  y: y / 32 - x / 64,
});

/** Keep the complete building rigid: one scale and a translation, with no
 * perspective correction, shear or separate axis scaling. The paved lot is
 * rendered separately, so a rectangular lot never distorts a square sprite. */
export function plotTransform(
  [left, front, right]: PlotCorners,
  width: number,
  height: number,
) {
  const back: GroundPoint = [
    left[0] + right[0] - front[0],
    left[1] + right[1] - front[1],
  ];
  const fit = fitGround([left, front, right, back], width, height, 0);
  return {
    scale: fit.scale,
    point: (x: number, y: number) => ({
      x: fit.x + x * fit.scale,
      y: fit.y + y * fit.scale,
    }),
  };
}

/** The lot, unlike the upright artwork, follows the exact occupied grid. */
export const plotOutline = (width: number, height: number) => [
  iso(-0.5, -0.5),
  iso(width - 0.5, -0.5),
  iso(width - 0.5, height - 0.5),
  iso(-0.5, height - 0.5),
];

/** Uniformly fit the ground outline into BOTH tile axes. A screen-space width
 * cannot describe an isometric plot, particularly a rectangular one.
 * Returned offsets refer to the original atlas cell, before alpha trimming. */
export function fitGround(
  ground: readonly GroundPoint[],
  width: number,
  height: number,
  inset = 0.08,
  scaleLimit = Infinity,
) {
  const projected = ground.map(([x, y]) => groundCoordinates(x, y));
  const minX = Math.min(...projected.map((p) => p.x));
  const maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));
  const scale = Math.min(
    scaleLimit,
    (width - 2 * inset) / (maxX - minX),
    (height - 2 * inset) / (maxY - minY),
  );
  const offset = iso(
    (width - 1) / 2 - (scale * (minX + maxX)) / 2,
    (height - 1) / 2 - (scale * (minY + maxY)) / 2,
  );
  return { scale, x: offset.x, y: offset.y };
}

/** Sample deterministic travel between simulation ticks. Following the route by
 * distance (rather than lerping endpoints) keeps turns on the road. No state is
 * changed, and arrival/waiting never extrapolates beyond the destination. */
export function agentDistance(agent: Agent, elapsed = 0) {
  return (
    agent.segment +
    agent.progress +
    (agent.wait > 0
      ? 0
      : Math.max(0, Math.min(elapsed, STEP)) *
        (agent.move === undefined
          ? AGENT_SPEED[agent.kind]
          : agent.move / STEP))
  );
}
export function agentPose(agent: Agent, elapsed = 0) {
  const distance = agentDistance(agent, elapsed);
  const end = agent.path.length - 1;
  const segment = Math.min(Math.floor(distance), Math.max(0, end - 1));
  const progress = Math.min(1, distance - segment);
  const from = agent.path[segment],
    to = agent.path[Math.min(segment + 1, end)];
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    dx: to.x - from.x,
    dy: to.y - from.y,
  };
}

/** Isometric facing columns used by both the pedestrian and vehicle atlases. */
export function facing(dx: number, dy: number): 0 | 1 | 2 | 3 {
  if (dx > 0) return 0; // southeast
  if (dy > 0) return 1; // southwest
  if (dx < 0) return 2; // northwest
  return 3; // northeast
}

/** Eight yaw views around the ground plane: SE, S, SW, W, NW, N, NE, E.
 * Upright sprites are never rotated or skewed in screen space. */
export function travelFacing(dx: number, dy: number) {
  return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
}

/** Bounds exclude alpha padding, so image origins refer to visible ground contact. */
export function opaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] >= 160) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left) return { x: 0, y: 0, width, height, groundX: width / 2 };
  // The frontmost visible ground-contact pixels can be off center in an asymmetrical building.
  let sum = 0,
    count = 0;
  for (let y = Math.max(top, bottom - 2); y <= bottom; y++)
    for (let x = left; x <= right; x++)
      if (data[(y * width + x) * 4 + 3] >= 160) {
        sum += x;
        count++;
      }
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    groundX: (count ? sum / count : (left + right) / 2) - left,
  };
}
