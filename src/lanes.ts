import type { Agent, Point } from "./simulation.js";

export const LANE_OFFSET = 0.24,
  WALK_OFFSET = 0.4;
const ROUND = 0.35,
  SLICES = 12;
const direction = (a: Point, b: Point) => ({ x: b.x - a.x, y: b.y - a.y });
export function lanePoint(
  path: readonly Point[],
  index: number,
  offset: number,
) {
  const p = path[index];
  const before =
    index > 0
      ? direction(path[index - 1], p)
      : direction(p, path[Math.min(1, path.length - 1)]);
  const after =
    index < path.length - 1 ? direction(p, path[index + 1]) : before;
  const corner = before.x !== after.x || before.y !== after.y;
  return {
    x: p.x - (before.y + (corner ? after.y : 0)) * offset,
    y: p.y + (before.x + (corner ? after.x : 0)) * offset,
  };
}
type Route = { points: Point[]; corners: Set<number>; cuts: number[] };
const routes = new WeakMap<readonly Point[], Map<number, Route>>();
function route(a: Agent) {
  const offset = a.kind === "person" ? WALK_OFFSET : LANE_OFFSET;
  let variants = routes.get(a.path);
  if (!variants) routes.set(a.path, (variants = new Map()));
  let r = variants.get(offset);
  if (r) return r;
  const points = a.path.map((_, i) => lanePoint(a.path, i, offset));
  r = { points, corners: new Set(), cuts: [] };
  for (let i = 1; i < points.length - 1; i++) {
    r.cuts.push(i);
    const p = direction(points[i - 1], points[i]),
      q = direction(points[i], points[i + 1]);
    if (Math.abs(p.x * q.y - p.y * q.x) < 1e-9) continue;
    r.corners.add(i);
    for (let slice = 0; slice <= SLICES; slice++)
      r.cuts.push(i - ROUND + (slice * 2 * ROUND) / SLICES);
  }
  r.cuts = [...new Set(r.cuts)].sort((a, b) => a - b);
  variants.set(offset, r);
  return r;
}
/** Round lane waypoints with tangent-continuous quadratic arcs. Simulation,
 * rendering and traffic all use this same path and distance parameter. */
export function lanePose(a: Agent, distance = a.segment + a.progress) {
  const r = route(a),
    end = r.points.length - 1;
  distance = Math.max(0, Math.min(end, distance));
  const node = Math.round(distance);
  if (r.corners.has(node) && Math.abs(distance - node) <= ROUND) {
    const center = r.points[node],
      before = r.points[node - 1],
      after = r.points[node + 1];
    const start = {
      x: center.x + (before.x - center.x) * ROUND,
      y: center.y + (before.y - center.y) * ROUND,
    };
    const finish = {
      x: center.x + (after.x - center.x) * ROUND,
      y: center.y + (after.y - center.y) * ROUND,
    };
    const t = (distance - node + ROUND) / (2 * ROUND),
      u = 1 - t;
    return {
      x: u * u * start.x + 2 * u * t * center.x + t * t * finish.x,
      y: u * u * start.y + 2 * u * t * center.y + t * t * finish.y,
      dx: (u * (center.x - start.x) + t * (finish.x - center.x)) / ROUND,
      dy: (u * (center.y - start.y) + t * (finish.y - center.y)) / ROUND,
    };
  }
  const segment = Math.min(Math.floor(distance), Math.max(0, end - 1)),
    t = distance - segment;
  const p = r.points[segment],
    q = r.points[Math.min(segment + 1, end)];
  return {
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
    dx: q.x - p.x,
    dy: q.y - p.y,
  };
}
export function laneCuts(a: Agent, from: number, to: number) {
  return [
    from,
    ...route(a).cuts.filter((d) => d > from + 1e-9 && d < to - 1e-9),
    to,
  ];
}
export function vehicleExtents(a: Agent, distance: number) {
  const p = lanePose(a, distance),
    norm = Math.hypot(p.dx, p.dy) || 1;
  const length = a.kind === "truck" ? 0.38 : 0.33;
  return {
    x: (length * Math.abs(p.dx) + 0.15 * Math.abs(p.dy)) / norm,
    y: (length * Math.abs(p.dy) + 0.15 * Math.abs(p.dx)) / norm,
  };
}
/** Conservative body bounds for one straight/arc slice, including the exact
 * maximum quadratic deviation from its chord and all intermediate headings. */
export function laneBounds(a: Agent, from: number, to: number) {
  const p = lanePose(a, from),
    q = lanePose(a, to),
    mid = lanePose(a, (from + to) / 2);
  const length = a.kind === "truck" ? 0.38 : 0.33,
    width = 0.15;
  const angle = Math.atan2(p.dy, p.dx),
    end = Math.atan2(q.dy, q.dx);
  const delta = Math.atan2(Math.sin(end - angle), Math.cos(end - angle));
  const lo = Math.min(angle, angle + delta),
    hi = Math.max(angle, angle + delta);
  const maximum = (x: number, y: number) => {
    const value = (t: number) =>
      x * Math.abs(Math.cos(t)) + y * Math.abs(Math.sin(t));
    let bound = Math.max(value(lo), value(hi));
    if (hi - lo > 1e-9) {
      const critical = Math.atan2(y, x);
      for (let k = -2; k <= 2; k++)
        for (const sign of [-1, 1]) {
          const t = k * Math.PI + sign * critical;
          if (t > lo && t < hi) bound = Math.max(bound, value(t));
        }
    }
    return bound;
  };
  return {
    x: maximum(length, width) + Math.abs(mid.x - (p.x + q.x) / 2),
    y: maximum(width, length) + Math.abs(mid.y - (p.y + q.y) / 2),
  };
}
