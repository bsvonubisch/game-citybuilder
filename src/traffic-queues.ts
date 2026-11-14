import { STEP } from "./catalog.js";
import { lanePose } from "./traffic.js";
import type { Agent } from "./simulation.js";

export interface TrafficQueue {
  id: number;
  agents: number[];
  seconds: number;
  severe: boolean;
}
/** Short intersection yields and loading trucks are normal. Warn only when
 * visible road traffic has been held up, and combine neighboring approaches. */
export function trafficQueues(agents: readonly Agent[]): TrafficQueue[] {
  const waiting = agents.filter(
    (a) =>
      a.kind !== "person" &&
      a.active !== false &&
      a.wait <= 0 &&
      a.trafficWait &&
      (a.queuedTicks ?? 0) * STEP >= 1,
  );
  const remaining = new Set(waiting);
  const groups: TrafficQueue[] = [];
  while (remaining.size) {
    const group = [remaining.values().next().value!];
    remaining.delete(group[0]);
    for (let i = 0; i < group.length; i++) {
      const p = lanePose(group[i]);
      for (const other of remaining) {
        const q = lanePose(other);
        if (Math.hypot(p.x - q.x, p.y - q.y) <= 2) {
          group.push(other);
          remaining.delete(other);
        }
      }
    }
    const seconds = Math.max(...group.map((a) => (a.queuedTicks ?? 0) * STEP));
    if (group.length < 2 ? seconds < 8 : seconds < 3) continue;
    const id = Math.min(...group.map((a) => a.id));
    groups.push({
      id,
      agents: group.map((a) => a.id),
      seconds,
      severe: seconds >= 12 || group.length >= 5,
    });
  }
  return groups;
}
