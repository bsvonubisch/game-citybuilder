import type { GroundPoint, PlotCorners } from "./building-art.js";
import type { Agent } from "./simulation.js";
import { AGENT_SPEED, STEP } from "./catalog.js";

export const iso = (x: number, y: number) => ({
  x: (x - y) * 32,
  y: (x + y) * 16,
});
export const groundCoordinates = (x: number, y: number) => ({
  x: x / 64 + y / 32,
  y: y / 32 - x / 64,
});

/** A projective fit aligns the whole base while keeping verticals upright and
 * roof lines straight. The transform has no y term in x, so walls cannot lean. */
export function plotTransform(
  [left, front, right]: PlotCorners,
  width: number,
  height: number,
) {
  const l = iso(-0.5, height - 0.5),
    f = iso(width - 0.5, height - 0.5),
    r = iso(width - 0.5, -0.5);
  const lx = left[0] - front[0],
    ly = left[1] - front[1],
    rx = right[0] - front[0],
    ry = right[1] - front[1];
  const dl = l.x - f.x,
    dr = r.x - f.x,
    g = (dr / rx - dl / lx) / (dl - dr),
    a = dl * (g + 1 / lx);
  const yl = (l.y - f.y) * (g * lx + 1),
    yr = (r.y - f.y) * (g * rx + 1),
    det = lx * ry - rx * ly;
  const b = (yl * ry - yr * ly) / det,
    d = (lx * yr - rx * yl) / det;
  return {
    scale: d,
    scaleAt: (x: number) => d / (g * (x - front[0]) + 1),
    sourceX: (worldX: number) => {
      const z = worldX - f.x;
      return front[0] + z / (a - g * z);
    },
    point: (x: number, y: number) => {
      const dx = x - front[0],
        denominator = g * dx + 1;
      return {
        x: f.x + (a * dx) / denominator,
        y: f.y + (b * dx + d * (y - front[1])) / denominator,
      };
    },
  };
}

/** Uniformly fit the ground outline into BOTH tile axes. A screen-space width
 * cannot describe an isometric plot, particularly a rectangular one.
 * Returned offsets refer to the original atlas cell, before alpha trimming. */
export function fitGround(
  ground: readonly GroundPoint[],
  width: number,
  height: number,
  inset = 0.08,
) {
  const projected = ground.map(([x, y]) => groundCoordinates(x, y));
  const minX = Math.min(...projected.map((p) => p.x));
  const maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));
  const scale = Math.min(
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
