import { AGENT_SPEED, STEP } from "./catalog.js";
import type { Agent, Point } from "./simulation.js";

export const LANE_OFFSET = 0.24,
  WALK_OFFSET = 0.4;
const direction = (a: Point, b: Point) => ({ x: b.x - a.x, y: b.y - a.y });
/** Right-hand lanes in world space. Mitered waypoints keep the lane continuous
 * through all four turn directions; pedestrians use the outer pavement edge. */
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
export function lanePose(a: Agent, distance = a.segment + a.progress) {
  const end = a.path.length - 1,
    segment = Math.min(Math.floor(distance), Math.max(0, end - 1)),
    t = Math.min(1, distance - segment);
  const offset = a.kind === "person" ? WALK_OFFSET : LANE_OFFSET;
  const p = lanePoint(a.path, segment, offset),
    q = lanePoint(a.path, Math.min(segment + 1, end), offset);
  const d = direction(a.path[segment], a.path[Math.min(segment + 1, end)]);
  return {
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
    dx: d.x,
    dy: d.y,
  };
}
const key = (p: Point) => `${p.x},${p.y}`;
function extents(a: Agent, distance: number) {
  const p = lanePose(a, distance),
    length = a.kind === "truck" ? 0.38 : 0.33;
  return { x: p.dx ? length : 0.15, y: p.dx ? 0.15 : length };
}
function overlaps(a: Agent, da: number, b: Agent, db: number) {
  const p = lanePose(a, da),
    q = lanePose(b, db);
  const ea = extents(a, da),
    eb = extents(b, db);
  return (
    Math.abs(p.x - q.x) < ea.x + eb.x + 0.08 &&
    Math.abs(p.y - q.y) < ea.y + eb.y + 0.08
  );
}
export function vehiclesOverlap(a: Agent, b: Agent) {
  return overlaps(a, a.segment + a.progress, b, b.segment + b.progress);
}

/** Swept bounds over the whole tick, split exactly at every turn. Sampling only
 * a few instants misses short overlaps when a car changes direction mid-tick. */
function sweptOverlap(a: Agent, ma: number, b: Agent, mb: number) {
  const da = a.segment + a.progress,
    db = b.segment + b.progress,
    cuts = [0, 1];
  for (const [distance, move] of [
    [da, ma],
    [db, mb],
  ])
    if (move > 0)
      for (let node = Math.floor(distance) + 1; node < distance + move; node++)
        cuts.push((node - distance) / move);
  cuts.sort((a, b) => a - b);
  if (cuts.some((t) => overlaps(a, da + ma * t, b, db + mb * t))) return true;
  for (let i = 1; i < cuts.length; i++) {
    const start = cuts[i - 1],
      end = cuts[i],
      mid = (start + end) / 2;
    const p = lanePose(a, da + ma * start),
      q = lanePose(b, db + mb * start),
      p1 = lanePose(a, da + ma * end),
      q1 = lanePose(b, db + mb * end);
    const ea = extents(a, da + ma * mid),
      eb = extents(b, db + mb * mid);
    let enter = 0,
      leave = 1;
    for (const axis of ["x", "y"] as const) {
      const relative = p[axis] - q[axis],
        change = p1[axis] - q1[axis] - relative,
        limit = ea[axis] + eb[axis] + 0.08;
      if (Math.abs(change) < 1e-12) {
        if (Math.abs(relative) >= limit) {
          leave = -1;
          break;
        }
      } else {
        const t0 = (-limit - relative) / change,
          t1 = (limit - relative) / change;
        enter = Math.max(enter, Math.min(t0, t1));
        leave = Math.min(leave, Math.max(t0, t1));
      }
    }
    if (enter < leave - 1e-10) return true;
  }
  return false;
}

export class Traffic {
  private junctions = new Map<string, number>();
  private junctionTiles = new Set<string>();
  configure(roads: ReadonlySet<string>) {
    this.junctionTiles.clear();
    this.junctions.clear();
    for (const road of roads) {
      const [x, y] = road.split(",").map(Number);
      const exits = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => roads.has(`${x + dx},${y + dy}`));
      if (
        exits.length >= 3 ||
        (exits.length === 2 &&
          exits[0][0] + exits[1][0] !== 0 &&
          exits[0][1] + exits[1][1] !== 0)
      )
        this.junctionTiles.add(road);
    }
  }
  plan(agents: Agent[]) {
    for (const a of agents) {
      a.move = 0;
      a.trafficWait = false;
      if (a.kind === "person") {
        a.active = a.wait <= 0;
        a.move = a.wait > 0 ? 0 : STEP * AGENT_SPEED.person;
      }
    }
    const cars = agents.filter((a) => a.kind !== "person");
    for (const a of cars) {
      a.active ??= false;
      if (a.wait > 0) a.active = false;
    }
    for (const [junction, id] of this.junctions) {
      const a = cars.find((a) => a.id === id),
        [x, y] = junction.split(",").map(Number);
      if (!a?.active || Math.hypot(lanePose(a).x - x, lanePose(a).y - y) > 1.1)
        this.junctions.delete(junction);
    }
    // Vehicles wait inside their source building until there is room to join.
    for (const a of cars
      .filter((a) => !a.active && a.wait <= 0)
      .sort((a, b) => a.id - b.id)) {
      if (
        cars.some(
          (b) =>
            b.active &&
            overlaps(a, a.segment + a.progress, b, b.segment + b.progress),
        )
      ) {
        a.trafficWait = true;
        continue;
      }
      const p = lanePose(a),
        near = [...this.junctionTiles].filter((k) => {
          const [x, y] = k.split(",").map(Number);
          return Math.hypot(p.x - x, p.y - y) < 1.2;
        });
      const blocked = near.some((k) => {
        const owner = this.junctions.get(k);
        if (owner !== undefined && owner !== a.id) return true;
        const [x, y] = k.split(",").map(Number);
        return cars.some(
          (b) =>
            b !== a &&
            b.active &&
            Math.hypot(lanePose(b).x - x, lanePose(b).y - y) < 1.6,
        );
      });
      if (blocked) {
        a.trafficWait = true;
        continue;
      }
      a.active = true;
      for (const junction of near) this.junctions.set(junction, a.id);
    }
    // Pick the first car in each approach queue, then use waiting time for fairness.
    const candidates = new Map<
      string,
      Map<string, { a: Agent; distance: number }>
    >();
    for (const a of cars.filter((a) => a.active)) {
      const at = a.segment + a.progress;
      for (
        let i = Math.max(0, a.segment);
        i <= Math.min(a.path.length - 1, a.segment + 2);
        i++
      ) {
        const junction = key(a.path[i]),
          distance = i - at;
        if (
          !this.junctionTiles.has(junction) ||
          distance < -0.7 ||
          distance > 1.8 ||
          this.junctions.has(junction)
        )
          continue;
        const approach = key(a.path[Math.max(0, i - 1)]);
        let approaches = candidates.get(junction);
        if (!approaches) candidates.set(junction, (approaches = new Map()));
        const previous = approaches.get(approach);
        if (!previous || distance < previous.distance)
          approaches.set(approach, { a, distance });
      }
    }
    for (const [junction, approaches] of candidates) {
      const winner = [...approaches.values()].sort(
        (a, b) =>
          (b.a.queuedTicks ?? 0) - (a.a.queuedTicks ?? 0) ||
          a.distance - b.distance ||
          a.a.id - b.a.id,
      )[0];
      this.junctions.set(junction, winner.a.id);
    }
    const owners = new Set(this.junctions.values());
    const ordered = cars
      .filter((a) => a.active)
      .sort(
        (a, b) =>
          Number(owners.has(b.id)) - Number(owners.has(a.id)) ||
          b.segment + b.progress - (a.segment + a.progress) ||
          a.id - b.id,
      );
    for (const a of ordered) {
      const at = a.segment + a.progress;
      let desired = Math.min(
        STEP * AGENT_SPEED[a.kind],
        a.path.length - 1 - at,
      );
      for (
        let i = a.segment;
        i <= Math.min(a.path.length - 1, a.segment + 2);
        i++
      ) {
        const owner = this.junctions.get(key(a.path[i]));
        if (owner !== undefined && owner !== a.id && i >= at)
          desired = Math.min(desired, Math.max(0, i - at - 1.1));
      }
      const clear = (move: number) =>
        cars.every(
          (b) => b === a || !b.active || !sweptOverlap(a, move, b, b.move ?? 0),
        );
      if (desired > 0 && !clear(desired)) {
        let low = 0,
          high = desired;
        for (let i = 0; i < 9; i++) {
          const mid = (low + high) / 2;
          if (clear(mid)) low = mid;
          else high = mid;
        }
        desired = low < 0.001 ? 0 : low;
      }
      a.move = desired;
      a.trafficWait =
        desired < STEP * AGENT_SPEED[a.kind] - 0.001 && at < a.path.length - 1;
      a.queuedTicks = a.trafficWait ? (a.queuedTicks ?? 0) + 1 : 0;
    }
  }
}
