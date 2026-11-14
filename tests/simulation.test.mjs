import test from "node:test";
import assert from "node:assert/strict";
import { facing, opaqueBounds } from "../.test-dist/rendering.js";
import { Simulation, parseSave, key } from "../.test-dist/simulation.js";
const execute = (sim, command, id = "test-" + sim.state.revision) =>
  sim.execute({
    id,
    actorId: "test",
    expectedRevision: sim.state.revision,
    command,
  });
const advance = (sim, seconds) => {
  for (let i = 0; i < seconds * 4; i++) sim.step();
};
test("each road direction selects a distinct matching atlas view", () => {
  assert.equal(facing(1, 0), 0);
  assert.equal(facing(0, 1), 1);
  assert.equal(facing(-1, 0), 2);
  assert.equal(facing(0, -1), 3);
});
test("transparent atlas padding is excluded from visible ground alignment", () => {
  const pixels = new Uint8ClampedArray(10 * 12 * 4);
  for (let y = 2; y <= 8; y++)
    for (let x = 3; x <= 7; x++) pixels[(y * 10 + x) * 4 + 3] = 255;
  assert.deepEqual(opaqueBounds(pixels, 10, 12), {
    x: 3,
    y: 2,
    width: 5,
    height: 7,
    groundX: 2,
  });
});
test("cottages rotate four ways without changing occupancy, residents, or balances", () => {
  const sim = new Simulation(),
    house = sim.state.buildings.find((b) => b.kind === "house"),
    start = house.rotation,
    gold = sim.state.money,
    residents = sim.state.residents.map((r) => r.id);
  for (let i = 0; i < 4; i++)
    assert.equal(execute(sim, { type: "rotate", id: house.id }).ok, true);
  assert.equal(house.rotation, start);
  assert.equal(sim.state.money, gold);
  assert.deepEqual(
    sim.state.residents.map((r) => r.id),
    residents,
  );
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(restored.building(house.id).rotation, start);
  assert.equal(
    execute(sim, {
      type: "rotate",
      id: sim.state.buildings.find((b) => b.kind === "park").id,
    }).ok,
    false,
  );
});
test("placement orientation persists and invalid orientation is rejected", () => {
  const sim = new Simulation();
  assert.equal(
    execute(sim, { type: "place", kind: "house", x: 4, y: 11, rotation: 3 }).ok,
    true,
  );
  assert.equal(sim.buildingAt(4, 11).rotation, 3);
  assert.equal(
    execute(sim, { type: "place", kind: "house", x: 4, y: 16, rotation: 9 }).ok,
    false,
  );
});
test("construction charges gold and delivered materials; commands are idempotent", () => {
  const sim = new Simulation(),
    money = sim.state.money,
    wood = sim.stored("wood");
  const env = {
    id: "once",
    actorId: "test",
    expectedRevision: 0,
    command: { type: "place", kind: "house", x: 4, y: 11 },
  };
  assert.equal(sim.execute(env).ok, true);
  assert.equal(sim.state.money, money - 90);
  assert.equal(sim.stored("wood"), wood - 5);
  assert.equal(sim.execute(env).ok, true);
  assert.equal(sim.state.money, money - 90);
  assert.equal(sim.buildingAt(5, 12).kind, "house");
});
test("invalid placement, stale revision, and insufficient materials cannot spend resources", () => {
  const sim = new Simulation();
  const before = sim.state.money;
  assert.equal(
    execute(sim, { type: "place", kind: "house", x: 25, y: 20 }).ok,
    false,
  );
  assert.equal(
    execute(sim, { type: "place", kind: "mine", x: 5, y: 12 }).ok,
    false,
  );
  assert.equal(
    sim.execute({
      id: "stale",
      actorId: "test",
      expectedRevision: 20,
      command: { type: "place", kind: "house", x: 5, y: 12 },
    }).ok,
    false,
  );
  sim.state.buildings.find((b) => b.kind === "warehouse").inventory.wood = 0;
  assert.equal(
    execute(sim, { type: "place", kind: "house", x: 5, y: 12 }).ok,
    false,
  );
  assert.equal(sim.state.money, before);
});
test("people have homes and workplaces; cars and walkers take valid road routes", () => {
  const sim = new Simulation();
  assert.equal(sim.state.residents.length, 36);
  assert.ok(sim.state.residents.filter((r) => r.job).length > 15);
  assert.ok(sim.state.agents.some((a) => a.kind === "person"));
  assert.ok(sim.state.agents.some((a) => a.kind === "car"));
  for (const a of sim.state.agents)
    for (const p of a.path) assert.ok(sim.roads.has(key(p)));
});
test("both factory chains deliver real goods and export tools", () => {
  const sim = new Simulation();
  advance(sim, 240);
  assert.ok(sim.state.delivered > 60);
  assert.ok(sim.state.exported > 0);
  assert.ok(sim.state.buildings.find((b) => b.kind === "bakery").produced > 0);
  assert.ok(sim.stored("stone") > 45);
  assert.ok(sim.stored("metal") > 25);
  assert.ok(sim.state.deposits["19,4"] < 600);
  for (const b of sim.state.buildings)
    for (const n of Object.values(b.inventory)) assert.ok(n >= 0);
});
test("disconnecting roads stops production and removes impossible routes", () => {
  const sim = new Simulation();
  const farm = sim.state.buildings.find((b) => b.kind === "farm");
  assert.equal(execute(sim, { type: "demolish", x: 13, y: 4 }).ok, true);
  assert.equal(execute(sim, { type: "demolish", x: 13, y: 5 }).ok, true);
  assert.equal(farm.connected, false);
  advance(sim, 30);
  assert.equal(farm.produced, 0);
  assert.ok(
    sim.state.agents.every((a) => a.path.every((p) => sim.roads.has(key(p)))),
  );
});
test("save roundtrip preserves inventories including cargo in transit", () => {
  const sim = new Simulation();
  advance(sim, 24);
  const totals = sim.totals();
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.deepEqual(restored.totals(), totals);
  assert.equal(restored.state.money, sim.state.money);
  assert.equal(restored.state.residents.length, 36);
});
test("deterministic simulation produces identical results from the same starting state", () => {
  const a = new Simulation(),
    b = new Simulation();
  advance(a, 120);
  advance(b, 120);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
test("finite deposits stop extraction at depletion", () => {
  const sim = new Simulation();
  sim.state.deposits["19,4"] = 3;
  advance(sim, 50);
  const quarry = sim.state.buildings.find((b) => b.kind === "quarry");
  assert.equal(quarry.produced, 3);
  assert.equal(sim.state.deposits["19,4"], 0);
  assert.equal(sim.status(quarry), "Deposit exhausted");
});
test("the last warehouse is protected and malformed saves are rejected", () => {
  const sim = new Simulation();
  assert.equal(execute(sim, { type: "demolish", x: 10, y: 11 }).ok, false);
  const bad = sim.snapshot();
  bad.buildings[0].x = 99;
  assert.throws(() => parseSave(JSON.stringify(bad)));
  const duplicate = sim.snapshot();
  duplicate.roads.push(duplicate.roads[0]);
  assert.throws(() => parseSave(JSON.stringify(duplicate)));
});
test("all initial footprints are disjoint, on land, and clear of every road", () => {
  const sim = new Simulation();
  assert.doesNotThrow(() => parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(sim.buildingAt(12, 16).kind, "park");
  assert.equal(
    execute(sim, { type: "place", kind: "road", x: 12, y: 16 }).ok,
    false,
  );
  assert.equal(
    execute(sim, { type: "place", kind: "park", x: 5, y: 11 }).ok,
    false,
  );
  assert.equal(
    execute(sim, { type: "place", kind: "warehouse", x: 27, y: 10 }).ok,
    false,
  );
});
test("older one-tile saves migrate without losing buildings, inventory, or gold", () => {
  const sim = new Simulation();
  const old = sim.snapshot();
  old.version = 1;
  old.buildings.find((b) => b.kind === "park").x = 12;
  const upgraded = parseSave(JSON.stringify(old));
  assert.equal(upgraded.version, 2);
  assert.equal(upgraded.buildings.length, old.buildings.length);
  assert.equal(upgraded.money, old.money);
  assert.doesNotThrow(() => parseSave(JSON.stringify(upgraded)));
});
