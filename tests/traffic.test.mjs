import test from "node:test";
import assert from "node:assert/strict";
import {
  Traffic,
  lanePoint,
  lanePose,
  vehiclesOverlap,
  LANE_OFFSET,
} from "../.test-dist/traffic.js";
import { Simulation } from "../.test-dist/simulation.js";
import { agentDistance } from "../.test-dist/rendering.js";
import { STEP } from "../.test-dist/catalog.js";
const vehicle = (id, path, kind = "car") => ({
  id,
  kind,
  path,
  segment: 0,
  progress: 0,
  wait: 0,
  active: false,
  source: 1,
  target: 2,
  resident: null,
  cargo: null,
  amount: 0,
  returning: false,
});
const line = (x, y, dx, dy, length) =>
  Array.from({ length }, (_, i) => ({ x: x + dx * i, y: y + dy * i }));
function noCollisions(agents, context) {
  const cars = agents.filter((a) => a.kind !== "person" && a.active);
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++)
      for (let sample = 0; sample <= 12; sample++) {
        const pose = (a) => {
          const distance = agentDistance(a, (STEP * sample) / 12);
          return {
            ...a,
            segment: Math.floor(distance),
            progress: distance - Math.floor(distance),
          };
        };
        assert.equal(
          vehiclesOverlap(pose(cars[i]), pose(cars[j])),
          false,
          `${context}: ${cars[i].id} and ${cars[j].id} at ${sample}/12`,
        );
      }
}
function complete(agents, roads, limit = 700) {
  const traffic = new Traffic();
  traffic.configure(new Set(roads.map((p) => `${p.x},${p.y}`)));
  let queueObserved = false,
    ticks = 0;
  for (; ticks < limit && agents.length; ticks++) {
    traffic.plan(agents);
    noCollisions(agents, `tick ${ticks}`);
    queueObserved ||= agents.some((a) => a.trafficWait);
    for (const a of agents) {
      const d = a.segment + a.progress + a.move;
      a.segment = Math.floor(d);
      a.progress = d - a.segment;
    }
    agents = agents.filter(
      (a) => a.segment + a.progress < a.path.length - 1 - 1e-8,
    );
  }
  assert.equal(agents.length, 0, "all vehicles must reach their destination");
  return { queueObserved, ticks };
}
test("opposite directions use their own right-hand lane on both road axes", () => {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const path = line(5, 5, dx, dy, 5),
      p = lanePoint(path, 2, LANE_OFFSET),
      center = path[2];
    assert.ok(
      Math.abs((p.x - center.x) * -dy + (p.y - center.y) * dx - LANE_OFFSET) <
        1e-9,
    );
    const reverse = lanePoint([...path].reverse(), 2, LANE_OFFSET);
    assert.ok(
      Math.abs(Math.hypot(p.x - reverse.x, p.y - reverse.y) - 2 * LANE_OFFSET) <
        1e-9,
    );
  }
});
test("faster cars queue behind a delivery truck and parked vehicles wait for a safe gap", () => {
  const path = line(0, 0, 1, 0, 12);
  const result = complete(
    [
      vehicle(1, path, "truck"),
      ...Array.from({ length: 8 }, (_, i) => vehicle(i + 2, path)),
    ],
    path,
  );
  assert.equal(result.queueObserved, true);
});
test("cross traffic and left turns clear junctions without collisions or deadlocks", () => {
  const east = line(-4, 0, 1, 0, 9),
    south = line(0, -4, 0, 1, 9);
  const left = [...line(-4, 0, 1, 0, 5), ...line(0, -1, 0, -1, 4)];
  const right = [...line(0, -4, 0, 1, 5), ...line(-1, 0, -1, 0, 4)];
  const paths = [
    east,
    [...east].reverse(),
    south,
    [...south].reverse(),
    left,
    right,
  ];
  const cars = paths.flatMap((path, i) =>
    Array.from({ length: 3 }, (_, j) =>
      vehicle(i * 3 + j + 1, path, j === 0 ? "truck" : "car"),
    ),
  );
  assert.equal(complete(cars, [...east, ...south], 1200).queueObserved, true);
});
test("opposing traffic passes a narrow road bend safely", () => {
  const path = [...line(0, -4, 0, 1, 5), ...line(1, 0, 1, 0, 4)];
  complete(
    [
      vehicle(1, path, "truck"),
      vehicle(2, [...path].reverse(), "truck"),
      vehicle(3, path),
      vehicle(4, [...path].reverse()),
    ],
    path,
  );
});
test("a busy working town remains collision free between simulation ticks and keeps exporting", () => {
  const sim = new Simulation();
  for (let i = 0; i < 2400; i++) {
    noCollisions(sim.state.agents, `town tick ${i}`);
    sim.step();
  }
  assert.ok(sim.state.delivered > 300);
  assert.ok(sim.state.exported > 20);
  assert.ok(
    sim.state.agents.every((a) => (a.queuedTicks ?? 0) < 240),
    "no car should remain stuck for a minute",
  );
});
