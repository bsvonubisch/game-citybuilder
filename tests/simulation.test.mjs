import test from "node:test";
import assert from "node:assert/strict";
import {
  facing,
  opaqueBounds,
  fitGround,
  groundCoordinates,
  agentPose,
} from "../.test-dist/rendering.js";
import { buildingArt } from "../.test-dist/building-art.js";
import {
  BUILDINGS,
  FOOTPRINTS,
  STEP,
  AGENT_SPEED,
} from "../.test-dist/catalog.js";
import { Simulation, parseSave, key } from "../.test-dist/simulation.js";
import { walkFrame, working } from "../.test-dist/animation.js";
import {
  bridgeRails,
  roadHeight,
  BRIDGE_HEIGHT,
  isBridge,
} from "../.test-dist/bridges.js";
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

test("bridges connect people and deliveries across an inlet and survive a save roundtrip", () => {
  const seed = new Simulation().snapshot();
  seed.buildings = [
    { ...seed.buildings.find((b) => b.kind === "house"), x: 18, y: 10 },
    { ...seed.buildings.find((b) => b.kind === "forester"), x: 19, y: 8 },
    { ...seed.buildings.find((b) => b.kind === "warehouse"), x: 18, y: 16 },
  ];
  seed.roads = [
    "20,10",
    ...Array.from({ length: 7 }, (_, i) => `21,${10 + i}`),
  ].filter((p) => p !== "21,13");
  seed.agents = [];
  seed.residents = [];
  const sim = new Simulation(seed),
    money = sim.state.money;
  assert.equal(sim.path({ x: 21, y: 10 }, { x: 21, y: 16 }), null);
  assert.equal(
    execute(sim, { type: "place", kind: "bridge", x: 20, y: 12 }).ok,
    false,
    "bridge tool requires water",
  );
  assert.equal(
    execute(sim, { type: "place", kind: "bridge", x: 21, y: 13 }).ok,
    true,
  );
  assert.equal(sim.state.money, money - 35);
  assert.equal(sim.path({ x: 21, y: 10 }, { x: 21, y: 16 }).length, 7);
  assert.equal(sim.state.residents.length, 3);
  assert.ok(
    sim.state.agents.some((a) =>
      a.path.some((p) => isBridge(sim.roads, p.x, p.y)),
    ),
  );
  advance(sim, 70);
  assert.ok(
    sim.stored("wood") > 60,
    "delivery trucks carry wood across the bridge",
  );
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.ok(restored.path({ x: 21, y: 10 }, { x: 21, y: 16 }));
  assert.equal(roadHeight(restored.roads, 21, 13), BRIDGE_HEIGHT);
  assert.equal(execute(restored, { type: "demolish", x: 21, y: 13 }).ok, true);
  assert.equal(restored.path({ x: 21, y: 10 }, { x: 21, y: 16 }), null);
  assert.equal(
    restored.state.buildings.find((b) => b.kind === "forester").connected,
    false,
  );
  assert.ok(
    restored.state.agents.every((a) =>
      a.path.every((p) => restored.roads.has(key(p))),
    ),
  );
});

test("bridge ramps join land and neighboring spans continuously in both orientations", () => {
  const sim = new Simulation();
  const samples = [
    [21, 10.5, 0],
    [21, 11, 6],
    [21, 11.5, 6],
    [21, 14.5, 6],
    [21, 15, 6],
    [21, 15.5, 0],
    [22.5, 18, 0],
    [23, 18, 6],
  ];
  for (const [x, y, z] of samples) assert.equal(roadHeight(sim.roads, x, y), z);
  for (const [x, y, dx, dy] of [
    [21, 10.5, 0, 1],
    [21, 11.5, 0, 1],
    [21, 15.5, 0, 1],
    [22.5, 18, 1, 0],
  ]) {
    const before = roadHeight(sim.roads, x - dx * 0.0001, y - dy * 0.0001),
      after = roadHeight(sim.roads, x + dx * 0.0001, y + dy * 0.0001);
    assert.ok(
      Math.abs(before - after) < 0.002,
      "no height pop at tile boundaries",
    );
  }
  const roads = new Set(["24,10", "23,10", "25,10", "24,11"]);
  assert.deepEqual(
    bridgeRails(roads, { x: 24, y: 10 }),
    [false, false, false, true],
    "junctions have no rails blocking exits",
  );
  roads.delete("24,11");
  assert.deepEqual(bridgeRails(roads, { x: 24, y: 10 }), [
    false,
    true,
    false,
    true,
  ]);
});

test("walking cycles stay within their directional row and stop cycling while waiting", () => {
  for (let direction = 0; direction < 4; direction++)
    for (let variant = 0; variant < 2; variant++) {
      const frames = Array.from(
        { length: 4 },
        (_, i) => walkFrame(direction, variant, i / 10, false).frame,
      );
      assert.ok(new Set(frames).size >= 3);
      assert.ok(
        frames.every(
          (f) =>
            f >= direction * 8 + variant * 4 &&
            f < direction * 8 + variant * 4 + 4,
        ),
      );
      assert.deepEqual(
        walkFrame(direction, variant, 0, true),
        walkFrame(direction, variant, 12.6, true),
      );
    }
});

test("factory machinery pauses without inputs, staff, road access, or storage space", () => {
  const sim = new Simulation(),
    mill = sim.state.buildings.find((b) => b.kind === "mill");
  mill.inventory.grain = 3;
  mill.inventory.flour = 0;
  assert.equal(working(sim, mill), true);
  mill.inventory.grain = 0;
  assert.equal(working(sim, mill), false);
  mill.inventory.grain = 3;
  mill.enabled = false;
  assert.equal(working(sim, mill), false);
  mill.enabled = true;
  mill.connected = false;
  assert.equal(working(sim, mill), false);
  mill.connected = true;
  mill.workers = 0;
  assert.equal(working(sim, mill), false);
  mill.workers = 2;
  mill.inventory.flour = 20;
  assert.equal(working(sim, mill), false);
});

test("ground contacts, including industrial props and all cottage rotations, stay inside their occupied tiles", () => {
  for (const kind of Object.keys(BUILDINGS))
    for (let rotation = 0; rotation < (kind === "house" ? 4 : 1); rotation++) {
      const art = buildingArt(kind, rotation);
      const [w, h] = FOOTPRINTS[kind];
      const fit = fitGround(art.ground, w, h);
      for (const [x, y] of art.ground) {
        const p = groundCoordinates(
          x * fit.scale + fit.x,
          y * fit.scale + fit.y,
        );
        assert.ok(
          p.x >= -0.42 - 1e-9 && p.x <= w - 0.58 + 1e-9,
          `${kind}/${rotation} crosses the x plot edge`,
        );
        assert.ok(
          p.y >= -0.42 - 1e-9 && p.y <= h - 0.58 + 1e-9,
          `${kind}/${rotation} crosses the y plot edge`,
        );
      }
    }
});

test("fitting uses both diagonal plot edges, even when the lowest contact is off center", () => {
  // Same screen width, different ground shape: bounding-box width alone cannot fit this.
  const ground = [
    [0, 50],
    [40, 100],
    [120, 80],
    [160, 40],
  ];
  const fit = fitGround(ground, 3, 2);
  const points = ground.map(([x, y]) =>
    groundCoordinates(x * fit.scale + fit.x, y * fit.scale + fit.y),
  );
  assert.ok(Math.max(...points.map((p) => p.y)) < 1.5);
  assert.ok(Math.min(...points.map((p) => p.y)) > -0.5);
  assert.ok(Math.max(...points.map((p) => p.x)) < 2.5);
  assert.ok(Math.min(...points.map((p) => p.x)) > -0.5);
});

test("agents move between ticks and remain on the road through corners and arrivals", () => {
  const a = {
    kind: "car",
    path: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    segment: 0,
    progress: 0.9,
    wait: 0,
  };
  const before = structuredClone(a);
  const early = agentPose(a, 0.025),
    late = agentPose(a, 0.2);
  assert.ok(early.x > 0.9 && early.x < 1);
  assert.equal(early.y, 0);
  assert.equal(late.x, 1);
  assert.ok(late.y > 0 && late.y < 1);
  assert.equal(facing(late.dx, late.dy), 1);
  assert.deepEqual(a, before, "rendering must not change authoritative state");
  a.segment = 1;
  a.progress = 0.95;
  assert.deepEqual(agentPose(a, STEP), { x: 1, y: 1, dx: 0, dy: 1 });
  a.wait = 2;
  assert.deepEqual(agentPose(a, STEP), agentPose(a, 0));
});

test("visual travel is continuous across a simulation tick for every agent type", () => {
  for (const kind of Object.keys(AGENT_SPEED)) {
    const sim = new Simulation();
    const a = {
      ...sim.state.agents[0],
      kind,
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      segment: 0,
      progress: 0.9,
      wait: 0,
    };
    sim.state.agents = [a];
    const predicted = agentPose(a, STEP);
    sim.step();
    assert.deepEqual(agentPose(a, 0), predicted);
  }
});
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
