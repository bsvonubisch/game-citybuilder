import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, key } from "../.test-dist/simulation.js";
import { BUILDINGS } from "../.test-dist/catalog.js";
import {
  canSupply,
  productionConnections,
  productionActivity,
  LogisticsCache,
} from "../.test-dist/logistics.js";

const building = (sim, kind) =>
  sim.state.buildings.find((b) => b.kind === kind);
const execute = (sim, command) => {
  const result = sim.execute({
    id: `logistics-${sim.state.revision}`,
    actorId: "test",
    expectedRevision: sim.state.revision,
    command,
  });
  assert.equal(result.ok, true, result.message);
};

test("production links follow recipe chains, warehouse export rules and front entrances", () => {
  const sim = new Simulation(),
    sawmill = building(sim, "sawmill"),
    forester = building(sim, "forester"),
    workshop = building(sim, "workshop"),
    warehouse = building(sim, "warehouse");
  const before = sim.snapshot();
  const view = productionConnections(sim, sawmill.id);
  assert.deepEqual(
    view.inputs.map((l) => [l.source, l.resource]),
    [[forester.id, "wood"]],
  );
  assert.deepEqual(
    view.outputs.map((l) => [l.target, l.resource]),
    [[workshop.id, "planks"]],
  );
  assert.equal(
    canSupply(sawmill, warehouse),
    false,
    "warehouses do not accept planks in the simulation",
  );
  assert.equal(canSupply(forester, warehouse), true);
  const quarry = productionConnections(sim, building(sim, "quarry").id);
  assert.equal(quarry.inputs.length, 0);
  assert.deepEqual(
    quarry.outputs.map((l) => l.target),
    [warehouse.id],
  );
  for (const b of sim.state.buildings) {
    const network = productionConnections(sim, b.id);
    if (!BUILDINGS[b.kind].recipe) {
      assert.equal(network, null);
      continue;
    }
    for (const l of [...network.inputs, ...network.outputs]) {
      assert.ok(l.path?.length);
      assert.ok(
        sim
          .adjacent(sim.building(l.source))
          .some((p) => key(p) === key(l.path[0])),
      );
      assert.ok(
        sim
          .adjacent(sim.building(l.target))
          .some((p) => key(p) === key(l.path.at(-1))),
      );
      for (let i = 0; i < l.path.length; i++) {
        assert.ok(sim.roads.has(key(l.path[i])));
        if (i)
          assert.equal(
            Math.abs(l.path[i].x - l.path[i - 1].x) +
              Math.abs(l.path[i].y - l.path[i - 1].y),
            1,
          );
      }
    }
  }
  assert.deepEqual(
    sim.snapshot(),
    before,
    "inspection must not change goods, routes or jobs",
  );
});

test("cached routes survive simulation ticks, invalidate after road changes, and respect replaced towns", () => {
  const sim = new Simulation(),
    cache = new LogisticsCache(),
    mill = building(sim, "mill"),
    farm = building(sim, "farm");
  const first = cache.get(sim, mill.id);
  sim.step();
  assert.strictEqual(cache.get(sim, mill.id), first);
  const front = sim.adjacent(farm);
  for (const p of front) execute(sim, { type: "demolish", ...p });
  const broken = cache.get(sim, mill.id);
  assert.notStrictEqual(broken, first);
  assert.equal(broken.inputs.find((l) => l.source === farm.id).path, null);
  for (const p of front) execute(sim, { type: "place", kind: "road", ...p });
  assert.ok(
    cache.get(sim, mill.id).inputs.find((l) => l.source === farm.id).path,
  );
  const replacement = new Simulation();
  replacement.state.revision = sim.state.revision;
  assert.notStrictEqual(
    cache.get(replacement, mill.id),
    cache.get(sim, mill.id),
  );
  assert.equal(cache.get(sim, null), null);
  execute(sim, { type: "demolish", x: mill.x, y: mill.y });
  assert.equal(cache.get(sim, mill.id), null);
});

test("goods highlights track actual cargo and assigned workers without including unrelated traffic", () => {
  const sim = new Simulation(),
    mill = building(sim, "mill"),
    farm = building(sim, "farm"),
    bakery = building(sim, "bakery");
  const view = productionConnections(sim, mill.id);
  const base = {
    id: 9001,
    kind: "truck",
    path: sim.route(farm, mill),
    segment: 0,
    progress: 0,
    resident: null,
    source: farm.id,
    target: mill.id,
    cargo: "grain",
    amount: 4,
    returning: false,
    wait: 0,
    active: true,
  };
  const incoming = base,
    outgoing = {
      ...base,
      id: 9002,
      source: mill.id,
      target: bakery.id,
      cargo: "flour",
    },
    unrelated = { ...base, id: 9003, target: bakery.id };
  const worker = sim.state.agents.find((a) =>
    view.workers.includes(a.resident),
  );
  assert.ok(worker);
  sim.state.agents.push(incoming, outgoing, unrelated, {
    ...base,
    id: 9004,
    amount: 0,
  });
  let activity = productionActivity(sim, view);
  assert.deepEqual(
    activity.incoming.map((a) => a.id),
    [9001],
  );
  assert.deepEqual(
    activity.outgoing.map((a) => a.id),
    [9002],
  );
  assert.ok(activity.workers.some((a) => a.id === worker.id));
  worker.returning = true;
  assert.ok(
    productionActivity(sim, view).workers.some((a) => a.id === worker.id),
    "returning commuters remain assigned workers, not cargo carriers",
  );
  sim.state.agents = sim.state.agents.filter((a) => a.id !== 9002);
  assert.equal(
    productionActivity(sim, view).outgoing.length,
    0,
    "completed deliveries lose their highlight immediately",
  );
});

test("every dispatched shipment is represented by its source and destination production views", () => {
  const sim = new Simulation();
  for (let t = 0; t < 480; t++) sim.step();
  const deliveries = sim.state.agents.filter((a) => a.cargo);
  assert.ok(deliveries.length > 0);
  for (const a of deliveries) {
    const from = productionConnections(sim, a.source);
    assert.ok(
      from.outputs.some(
        (l) => l.target === a.target && l.resource === a.cargo && l.path,
      ),
    );
    assert.ok(
      productionActivity(sim, from).outgoing.some((truck) => truck.id === a.id),
    );
    const to = productionConnections(sim, a.target);
    if (to)
      assert.ok(
        productionActivity(sim, to).incoming.some((truck) => truck.id === a.id),
      );
  }
});
