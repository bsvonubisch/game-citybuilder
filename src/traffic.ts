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

/** Independent swept corridors allow compatible lanes to share a junction.
 * Separating axes include vehicle dimensions and every turning waypoint. */
function corridorsOverlap(
  a: Agent,
  a0: number,
  a1: number,
  b: Agent,
  b0: number,
  b1: number,
) {
  const segments = (agent: Agent, from: number, to: number) => {
    const parts = [];
    for (let d = from; d < to - 1e-8; ) {
      const end = Math.min(to, Math.floor(d + 1e-8) + 1);
      parts.push({
        p: lanePose(agent, d),
        q: lanePose(agent, end),
        e: extents(agent, (d + end) / 2),
      });
      d = end;
    }
    return parts;
  };
  for (const sa of segments(a, a0, a1))
    for (const sb of segments(b, b0, b1)) {
      const axes = [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: sa.q.y - sa.p.y, y: sa.p.x - sa.q.x },
        { x: sb.q.y - sb.p.y, y: sb.p.x - sb.q.x },
      ];
      const separated = axes.some((axis) => {
        if (Math.abs(axis.x) + Math.abs(axis.y) < 1e-9) return false;
        const project = (p: Point) => p.x * axis.x + p.y * axis.y;
        const ap = project(sa.p),
          aq = project(sa.q),
          bp = project(sb.p),
          bq = project(sb.q);
        const margin =
          Math.abs(axis.x) * (sa.e.x + sb.e.x + 0.08) +
          Math.abs(axis.y) * (sa.e.y + sb.e.y + 0.08);
        return (
          Math.max(ap, aq) + margin <= Math.min(bp, bq) ||
          Math.max(bp, bq) + margin <= Math.min(ap, aq)
        );
      });
      if (!separated) return true;
    }
  return false;
}

export class Traffic {
  private junctions = new Map<string, Set<number>>();
  private junctionTiles = new Set<string>();
  private junctionGroups = new Map<string, string>();
  private groupTiles = new Map<string, Point[]>();
  configure(roads: ReadonlySet<string>) {
    this.junctionTiles.clear();
    this.junctions.clear();
    this.junctionGroups.clear();
    this.groupTiles.clear();
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
    // Adjacent junction tiles form one crossing. Reserving them separately
    // lets opposing cars each hold half of the crossing forever.
    for (const tile of this.junctionTiles) {
      if (this.junctionGroups.has(tile)) continue;
      const queue = [tile],
        members: Point[] = [];
      this.junctionGroups.set(tile, tile);
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i].split(",").map(Number);
        members.push({ x, y });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const next = `${x + dx},${y + dy}`;
          if (this.junctionTiles.has(next) && !this.junctionGroups.has(next)) {
            this.junctionGroups.set(next, tile);
            queue.push(next);
          }
        }
      }
      this.groupTiles.set(tile, members);
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
      if (a.wait > 0) {
        a.active = false;
        a.queuedTicks = 0;
      }
    }
    for (const [junction, ids] of this.junctions) {
      for (const id of ids) {
        const a = cars.find((a) => a.id === id);
        // Release once the rear has cleared, before stopping at the next crossing.
        // The old 1.1-tile radius overlapped the next crossing's stop line.
        if (
          !a?.active ||
          !a.path.some(
            (p, i) =>
              this.junctionGroups.get(key(p)) === junction &&
              i >= a.segment + a.progress - 0.7 &&
              i <= a.segment + a.progress + 1.8,
          )
        )
          ids.delete(id);
      }
      if (!ids.size) this.junctions.delete(junction);
    }
    const range = (a: Agent, junction: string) => {
      const at = a.segment + a.progress;
      const nodes = a.path.flatMap((p, i) =>
        this.junctionGroups.get(key(p)) === junction && i >= at - 0.7
          ? [i]
          : [],
      );
      if (!nodes.length) return [at, Math.min(a.path.length - 1, at + 0.8)];
      return [
        Math.max(at, nodes[0] - 1.1),
        Math.min(a.path.length - 1, nodes[nodes.length - 1] + 0.8),
      ];
    };
    const maneuvers = new Map<string, string>();
    const maneuver = (vehicle: Agent, junction: string) => {
      const cacheKey = `${vehicle.id}:${junction}`;
      const cached = maneuvers.get(cacheKey);
      if (cached !== undefined) return cached;
      const indices = vehicle.path.flatMap((p, i) =>
        this.junctionGroups.get(key(p)) === junction ? [i] : [],
      );
      const lane = !indices.length
        ? ""
        : vehicle.path
            .slice(Math.max(0, indices[0] - 1), indices[indices.length - 1] + 2)
            .map(key)
            .join(";");
      maneuvers.set(cacheKey, lane);
      return lane;
    };
    const conflicts = (a: Agent, b: Agent, junction: string) => {
      // Vehicles taking the same lane through a crossing can follow one another.
      // The swept body checks below still enforce the actual following gap.
      // Reserving the whole corridor exclusively made every car stop in turn.
      const lane = maneuver(a, junction);
      if (lane && lane === maneuver(b, junction)) return false;
      const ar = range(a, junction),
        br = range(b, junction);
      return corridorsOverlap(a, ar[0], ar[1], b, br[0], br[1]);
    };
    const blockedByOwner = (a: Agent, junction: string) =>
      [...(this.junctions.get(junction) ?? [])].some((id) => {
        const b = cars.find((b) => b.id === id);
        return b && b !== a && conflicts(a, b, junction);
      });
    const reserve = (junction: string, id: number) => {
      let owners = this.junctions.get(junction);
      if (!owners) this.junctions.set(junction, (owners = new Set()));
      owners.add(id);
    };
    // Vehicles wait inside their source building until there is room to join.
    for (const a of cars
      .filter((a) => !a.active && a.wait <= 0)
      .sort(
        (a, b) => (b.queuedTicks ?? 0) - (a.queuedTicks ?? 0) || a.id - b.id,
      )) {
      if (
        cars.some(
          (b) =>
            b.active &&
            overlaps(a, a.segment + a.progress, b, b.segment + b.progress),
        )
      ) {
        a.trafficWait = true;
        a.queuedTicks = (a.queuedTicks ?? 0) + 1;
        continue;
      }
      const p = lanePose(a),
        near = [
          ...new Set(
            [...this.junctionTiles]
              .filter((k) => {
                const [x, y] = k.split(",").map(Number);
                return Math.hypot(p.x - x, p.y - y) < 1.2;
              })
              .map((k) => this.junctionGroups.get(k)!),
          ),
        ];
      const blocked = near.some((k) => {
        if (blockedByOwner(a, k)) return true;
        return cars.some(
          (b) =>
            b !== a &&
            b.active &&
            conflicts(a, b, k) &&
            this.groupTiles
              .get(k)!
              .some(
                ({ x, y }) =>
                  Math.hypot(lanePose(b).x - x, lanePose(b).y - y) < 0.7,
              ),
        );
      });
      if (blocked) {
        a.trafficWait = true;
        a.queuedTicks = (a.queuedTicks ?? 0) + 1;
        continue;
      }
      a.active = true;
      for (const junction of near) reserve(junction, a.id);
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
        const junction = this.junctionGroups.get(key(a.path[i])),
          distance = i - at;
        if (
          !junction ||
          distance < -0.7 ||
          distance > 1.8 ||
          this.junctions.get(junction)?.has(a.id)
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
      const ranked = [...approaches.values()].sort(
        (a, b) =>
          (b.a.queuedTicks ?? 0) - (a.a.queuedTicks ?? 0) ||
          a.distance - b.distance ||
          a.a.id - b.a.id,
      );
      for (const { a } of ranked)
        if (!blockedByOwner(a, junction)) reserve(junction, a.id);
    }
    const owners = new Set(
      [...this.junctions.values()].flatMap((ids) => [...ids]),
    );
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
        const group = this.junctionGroups.get(key(a.path[i]));
        if (group !== undefined && blockedByOwner(a, group) && i >= at)
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
        desired <
        Math.min(STEP * AGENT_SPEED[a.kind], a.path.length - 1 - at) - 0.001;
      a.queuedTicks = a.trafficWait ? (a.queuedTicks ?? 0) + 1 : 0;
    }
  }
}
