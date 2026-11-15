import { STEP } from "./catalog.js";
import { roadMovement, type RoadTypes } from "./roads.js";
import type { Agent, Point } from "./simulation.js";
import {
  lanePose,
  laneCuts,
  laneBounds,
  vehicleExtents as extents,
} from "./lanes.js";
export { lanePoint, lanePose, LANE_OFFSET, WALK_OFFSET } from "./lanes.js";
const key = (p: Point) => `${p.x},${p.y}`;
const STOP_DISTANCE = 1.3,
  RELEASE_DISTANCE = 0.6;
const bodyLength=(a:Agent)=>a.kind==='truck'?.38:.33;
/** Support of an oriented body on a separating axis. Axis vectors are unit length. */
function bodyRadius(a:Agent,distance:number,axis:Point){
  const p=lanePose(a,distance),n=Math.hypot(p.dx,p.dy)||1;
  return bodyLength(a)*Math.abs((p.dx*axis.x+p.dy*axis.y)/n)+.15*Math.abs((p.dx*axis.y-p.dy*axis.x)/n);
}
function bodyAxes(a:Agent,distance:number){
  const p=lanePose(a,distance),n=Math.hypot(p.dx,p.dy)||1;
  return [{x:p.dx/n,y:p.dy/n},{x:-p.dy/n,y:p.dx/n}];
}
/** Maximum body support while the heading rotates along one lane slice. */
function bodySweepRadius(a:Agent,from:number,to:number,axis:Point){
  const p=lanePose(a,from),q=lanePose(a,to),base=Math.atan2(axis.y,axis.x);
  const angle=Math.atan2(p.dy,p.dx)-base,end=Math.atan2(q.dy,q.dx)-base;
  const delta=Math.atan2(Math.sin(end-angle),Math.cos(end-angle));
  const lo=Math.min(angle,angle+delta),hi=Math.max(angle,angle+delta),length=bodyLength(a);
  const value=(t:number)=>length*Math.abs(Math.cos(t))+.15*Math.abs(Math.sin(t));
  let max=Math.max(value(lo),value(hi));const critical=Math.atan2(.15,length);
  for(let k=-3;k<=3;k++)for(const sign of [-1,1]){const t=k*Math.PI+sign*critical;if(t>lo&&t<hi)max=Math.max(max,value(t));}
  return max;
}
function overlaps(a: Agent, da: number, b: Agent, db: number) {
  const p = lanePose(a, da),
    q = lanePose(b, db);
  const ea = extents(a, da),
    eb = extents(b, db);
  if(!(
    Math.abs(p.x - q.x) < ea.x + eb.x + 0.08 &&
    Math.abs(p.y - q.y) < ea.y + eb.y + 0.08
  ))return false;
  return [...bodyAxes(a,da),...bodyAxes(b,db)].every(axis=>
    Math.abs((p.x-q.x)*axis.x+(p.y-q.y)*axis.y)<bodyRadius(a,da,axis)+bodyRadius(b,db,axis)+.08);
}
export function vehiclesOverlap(a: Agent, b: Agent) {
  return overlaps(a, a.segment + a.progress, b, b.segment + b.progress);
}

/** Swept bounds include every curved path slice and the rotating vehicle body. */
function sweptOverlap(a: Agent, ma: number, b: Agent, mb: number) {
  const da = a.segment + a.progress,
    db = b.segment + b.progress,
    cuts = [0, 1];
  for (const [agent, distance, move] of [
    [a, da, ma],
    [b, db, mb],
  ] as const)
    if (move > 0)
      for (const node of laneCuts(agent, distance, distance + move).slice(
        1,
        -1,
      ))
        cuts.push((node - distance) / move);
  cuts.sort((a, b) => a - b);
  if (cuts.some((t) => overlaps(a, da + ma * t, b, db + mb * t))) return true;
  const intersects = (start: number, end: number, depth = 0): boolean => {
    const p = lanePose(a, da + ma * start),
      q = lanePose(b, db + mb * start),
      p1 = lanePose(a, da + ma * end),
      q1 = lanePose(b, db + mb * end);
    const ea = laneBounds(a, da + ma * start, da + ma * end),
      eb = laneBounds(b, db + mb * start, db + mb * end);
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
    if (enter >= leave - 1e-10) return false;
    const mid = (start + end) / 2;
    // AABBs are only a broad phase. A turning car's empty bounding-box corner
    // used to block an oncoming car reaching a driveway, freezing both forever.
    // Prove separation on the real body axes, including curvature and rotation.
    const am=da+ma*mid,bm=db+mb*mid,pm=lanePose(a,am),qm=lanePose(b,bm);
    for(const axis of [...bodyAxes(a,am),...bodyAxes(b,bm)]){
      const first=(p.x-q.x)*axis.x+(p.y-q.y)*axis.y,last=(p1.x-q1.x)*axis.x+(p1.y-q1.y)*axis.y;
      const middle=(pm.x-qm.x)*axis.x+(pm.y-qm.y)*axis.y;
      const bend=Math.abs(middle-(first+last)/2);
      const radius=bodySweepRadius(a,da+ma*start,da+ma*end,axis)+bodySweepRadius(b,db+mb*start,db+mb*end,axis)+.08+bend;
      if(Math.min(first,last)>=radius||Math.max(first,last)<=-radius)return false;
    }
    if (overlaps(a, da + ma * mid, b, db + mb * mid)) return true;
    // A rotated body's maximum bounds must not be applied at the start of
    // an entire curve: that makes its rear grow backwards into its follower.
    // Refine uncertain intervals until separation is proven, retaining a
    // conservative answer at the precision limit for very short contacts.
    if (depth >= 12) return true;
    return intersects(start, mid, depth + 1) || intersects(mid, end, depth + 1);
  };
  return cuts.some((end, i) => i > 0 && intersects(cuts[i - 1], end));
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
    const cuts = laneCuts(agent, from, to);
    for (let i = 1; i < cuts.length; i++) {
      const d = cuts[i - 1],
        end = cuts[i];
      parts.push({
        p: lanePose(agent, d),
        q: lanePose(agent, end),
        e: laneBounds(agent, d, end),
      });
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
  private roadTypes?: RoadTypes;
  release(id:number) {
    for(const [junction,owners] of this.junctions){owners.delete(id);if(!owners.size)this.junctions.delete(junction);}
  }
  configure(roads: ReadonlySet<string>, roadTypes?: RoadTypes) {
    this.roadTypes = roadTypes;
    roads=new Set([...roads].filter(k=>roadTypes?.[k]!=="pavement"));
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
      if(a.roadWork!==undefined){a.active=true;a.move=a.wait>0?0:STEP*.85;continue;}
      a.move = 0;
      a.trafficWait = false;
      if (a.kind === "person") {
        a.active = a.wait <= 0;
        a.move = a.wait > 0 ? 0 : roadMovement(a, STEP, this.roadTypes);
      }
    }
    const cars = agents.filter((a) => a.kind !== "person");
    const visitsByCar=new Map<Agent,{junction:string;index:number;approach:string}[]>();
    const visits=(a:Agent)=>{
      const known=visitsByCar.get(a);if(known)return known;
      const out=a.path.flatMap((p,index)=>{const junction=this.junctionGroups.get(key(p));return junction?[{junction,index,approach:key(a.path[Math.max(0,index-1)])}]:[];});
      const end=a.path.at(-1),before=a.path.at(-2);
      if(end&&before&&!this.junctionGroups.has(key(end))){
        // A driveway one tile before a crossing still occupies its approach.
        // Reserve the crossing until arrival; otherwise it can nose into the
        // swept body of a turning truck without ever appearing in the queue.
        const junction=this.junctionGroups.get(key({x:end.x+end.x-before.x,y:end.y+end.y-before.y}));
        if(junction)out.push({junction,index:a.path.length,approach:key(end)});
      }
      visitsByCar.set(a,out);return out;
    };
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
        // Keep this below the gap to the next crossing's stop line. Waiting
        // approaches leave space for the full body of a turning truck.
        if (
          !a?.active ||
          !visits(a).some(
            v =>
              v.junction === junction &&
              v.index >= a.segment + a.progress - RELEASE_DISTANCE &&
              v.index <= a.segment + a.progress + 1.8,
          )
        )
          ids.delete(id);
      }
      if (!ids.size) this.junctions.delete(junction);
    }
    const range = (a: Agent, junction: string) => {
      const at = a.segment + a.progress;
      const nodes = visits(a).flatMap(v =>
        v.junction === junction &&
        v.index >= at - RELEASE_DISTANCE
          ? [v.index]
          : [],
      );
      if (!nodes.length) return [at, Math.min(a.path.length - 1, at + 0.8)];
      return [
        Math.max(at, nodes[0] - STOP_DISTANCE),
        Math.min(a.path.length - 1, nodes[nodes.length - 1] + 0.8),
      ];
    };
    const maneuvers = new Map<string, string>();
    const maneuver = (vehicle: Agent, junction: string) => {
      const cacheKey = `${vehicle.id}:${junction}`;
      const cached = maneuvers.get(cacheKey);
      if (cached !== undefined) return cached;
      const indices = visits(vehicle).flatMap(v =>
        v.junction === junction ? [v.index] : [],
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
    const approachDistance = (a: Agent, junction: string) => {
      const at = a.segment + a.progress;
      for (const v of visits(a)) {
        const distance = v.index - at;
        if (
          v.junction === junction &&
          distance >= -RELEASE_DISTANCE &&
          distance <= 1.8
        )
          return distance;
      }
      return Infinity;
    };
    const committed = (a: Agent, junction: string) =>
      a.active && approachDistance(a, junction) < STOP_DISTANCE - 1e-8;
    const readyDepartures = new Set(
      cars
        .filter(
          (a) =>
            !a.active &&
            a.wait <= 0 &&
            !cars.some(
              (b) =>
                b.active &&
                overlaps(a, a.segment + a.progress, b, b.segment + b.progress),
            ),
        )
        .map((a) => a.id),
    );
    // Queue ages are a single tick snapshot. Incrementing a rejected departure
    // must not make it overtake a car assessed later in this same planning pass.
    const waitingAge = new Map(cars.map((a) => [a.id, a.queuedTicks ?? 0]));
    // A compatible convoy may share a crossing, but it cannot extend its turn
    // forever. New reservations and building departures join the same queue.
    // Cars already beyond the stop line must finish before priority changes.
    const olderWaiting = (a: Agent, junction: string) =>
      !committed(a, junction) &&
      cars.some(
        (b) =>
          b !== a &&
          b.wait <= 0 &&
          (b.active || readyDepartures.has(b.id)) &&
          !this.junctions.get(junction)?.has(b.id) &&
          approachDistance(b, junction) !== Infinity &&
          (committed(b, junction) ||
            (waitingAge.get(b.id)! > 0 &&
              (waitingAge.get(b.id)! > waitingAge.get(a.id)! ||
                (waitingAge.get(b.id) === waitingAge.get(a.id) &&
                  b.id < a.id)))) &&
          conflicts(a, b, junction),
      );
    const yielding = new Map<string, Set<number>>();
    const yieldToQueue = (a: Agent, junction: string) => {
      let ids = yielding.get(junction);
      if (!ids) yielding.set(junction, (ids = new Set()));
      ids.add(a.id);
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
        if (blockedByOwner(a, k) || olderWaiting(a, k)) return true;
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
      for (const v of visits(a)) {
        const junction = v.junction,
          distance = v.index - at;
        if (
          !junction ||
          distance < -RELEASE_DISTANCE ||
          distance > 1.8 ||
          this.junctions.get(junction)?.has(a.id)
        )
          continue;
        const approach = v.approach;
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
          Number(committed(b.a, junction)) - Number(committed(a.a, junction)) ||
          (b.a.queuedTicks ?? 0) - (a.a.queuedTicks ?? 0) ||
          a.distance - b.distance ||
          a.a.id - b.a.id,
      );
      for (const { a } of ranked) {
        if (olderWaiting(a, junction)) yieldToQueue(a, junction);
        else if (!blockedByOwner(a, junction)) reserve(junction, a.id);
      }
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
      const freeMove = roadMovement(a, STEP, this.roadTypes);
      let desired = freeMove;
      for (const v of visits(a)) {
        const group = v.junction,i=v.index;
        if (
          group !== undefined &&
          (blockedByOwner(a, group) || yielding.get(group)?.has(a.id)) &&
          i >= at
        )
          desired = Math.min(desired, Math.max(0, i - at - STOP_DISTANCE));
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
        freeMove - 0.001;
      a.queuedTicks = a.trafficWait ? (a.queuedTicks ?? 0) + 1 : 0;
    }
  }
}
