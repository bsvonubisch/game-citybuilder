import test from "node:test";
import assert from "node:assert/strict";
import {
  facing,
  opaqueBounds,
  fitGround,
  groundCoordinates,
  agentPose,
  plotTransform,
  cameraViewport,
  travellerDepth,
} from "../.test-dist/rendering.js";
import { buildingArt } from "../.test-dist/building-art.js";
import {
  BUILDINGS,
  FOOTPRINTS,
  STEP,
  AGENT_SPEED,
  dimensions,
  footprint,
  frontage,
  DECORATIONS,
  HOUSE_TIERS,
  houseCapacity,
} from "../.test-dist/catalog.js";
import { Simulation, parseSave, key } from "../.test-dist/simulation.js";
import { walkFrame, working } from "../.test-dist/animation.js";
import {
  bridgeRails,
  roadHeight,
  BRIDGE_HEIGHT,
  isBridge,
  bridgeLandings,
  deckHeight,
} from "../.test-dist/bridges.js";
import {
  fenceMask,
  fenceSpans,
  FENCE_DIRECTIONS,
} from "../.test-dist/fences.js";
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

test("travellers beside both front edges stay in front of multi-tile buildings and behind rear edges", () => {
  const bounds = { left: -500, right: 500, top: -500, bottom: 500 };
  for (const [width, height] of [
    [2, 2],
    [3, 2],
    [2, 3],
    [3, 3],
  ]) {
    const b = {
      x: 5,
      y: 5,
      width,
      height,
      depth: (10 + width + height - 2) * 32 + 12,
      ...bounds,
    };
    for (const p of [
      { x: 5 + width - 0.3, y: 5 },
      { x: 5, y: 5 + height - 0.3 },
    ]) {
      assert.ok(
        travellerDepth(p, bounds, [b]) > b.depth + 0.2,
        "walkers must cover the near wall and its effects",
      );
    }
    for (const p of [
      { x: 4.7, y: 5 + height - 1 },
      { x: 5 + width - 1, y: 4.7 },
    ]) {
      assert.ok(
        travellerDepth(p, bounds, [b]) < b.depth,
        "rear walkers must be occluded",
      );
    }
    const p = { x: 1, y: 1 };
    assert.equal(
      travellerDepth(p, { left: 600, right: 650, top: 600, bottom: 650 }, [b]),
      80,
    );
  }
});

test("building alerts distinguish missing frontage from an isolated road network", () => {
  const sim = new Simulation();
  const b = sim.state.buildings.find((b) => b.kind === "house");
  b.connected = false;
  const roads = sim.adjacent(b);
  assert.ok(roads.length);
  assert.equal(sim.alert(b).kind, "warehouse");
  for (const p of roads) sim.roads.delete(key(p));
  assert.equal(sim.alert(b).kind, "road");
  b.connected = true;
  assert.equal(sim.alert(b), null);
});

test("production alerts explain blockers, prioritize full output and clear after recovery", () => {
  const sim = new Simulation();
  const b = sim.state.buildings.find((b) => b.kind === "sawmill");
  b.connected = true;
  b.enabled = true;
  b.workers = 2;
  b.inventory = { wood: 3, planks: 0 };
  assert.equal(sim.alert(b), null);
  b.inventory.wood = 0;
  assert.equal(sim.alert(b).kind, "input");
  b.inventory.planks = 20;
  assert.equal(sim.alert(b).kind, "output");
  b.inventory.planks = 0;
  b.workers = 0;
  assert.equal(sim.alert(b).kind, "workers");
  b.enabled = false;
  assert.equal(sim.alert(b).kind, "paused");
  b.enabled = true;
  b.workers = 2;
  b.inventory.wood = 3;
  const before = sim.snapshot();
  assert.equal(sim.alert(b), null);
  assert.deepEqual(
    sim.snapshot(),
    before,
    "reading alerts never mutates a town",
  );
  const warehouse = sim.state.buildings.find((b) => b.kind === "warehouse");
  warehouse.connected = true;
  warehouse.inventory.wood = 999;
  assert.equal(
    sim.alert(warehouse),
    null,
    "unlimited warehouse inventory is not production output storage",
  );
});

test("depleted extractor alerts clear with a usable deposit and pauses take priority", () => {
  const sim = new Simulation();
  const seed = sim.state.buildings.find((b) => b.kind === "forester");
  const b = {
    ...seed,
    kind: "quarry",
    connected: true,
    enabled: true,
    workers: 2,
  };
  sim.state.deposits[key(b)] = 0;
  assert.equal(sim.alert(b).kind, "depleted");
  b.enabled = false;
  assert.equal(sim.alert(b).kind, "paused");
  b.enabled = true;
  sim.state.deposits[key(b)] = 3;
  assert.equal(sim.alert(b), null);
});

test("minimap and badges use the zoomed camera viewport and retain its center", () => {
  const c = { scrollX: -100, scrollY: 200, width: 1200, height: 800, zoom: 1 };
  assert.deepEqual(cameraViewport(c), {
    x: -100,
    y: 200,
    width: 1200,
    height: 800,
  });
  const v = cameraViewport({ ...c, zoom: 2 });
  assert.deepEqual(v, { x: 200, y: 400, width: 600, height: 400 });
  assert.equal(v.x + v.width / 2, c.scrollX + c.width / 2);
  assert.equal(v.y + v.height / 2, c.scrollY + c.height / 2);
});

test("bridges connect people and deliveries across an inlet and survive a save roundtrip", () => {
  const seed = new Simulation().snapshot();
  seed.buildings = [
    {
      ...seed.buildings.find((b) => b.kind === "house"),
      x: 18,
      y: 10,
      rotation: 1,
    },
    {
      ...seed.buildings.find((b) => b.kind === "forester"),
      x: 19,
      y: 8,
      rotation: 0,
    },
    {
      ...seed.buildings.find((b) => b.kind === "warehouse"),
      x: 18,
      y: 16,
      rotation: 1,
    },
  ];
  seed.roads = [
    "20,10",
    ...Array.from({ length: 7 }, (_, i) => `21,${10 + i}`),
  ].filter((p) => p !== "21,13");
  seed.agents = [];
  seed.decorations = [];
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

test("all 52 building and house-tier views preserve proportions inside current and legacy lots", () => {
  for (const kind of Object.keys(BUILDINGS))
    for (const tier of kind === "house" ? [1, 2, 3] : [1])
      for (let rotation = 0; rotation < 4; rotation++) {
        const art = buildingArt(kind, rotation, tier);
        for (const [w, h] of [dimensions(kind, rotation), FOOTPRINTS[kind]]) {
          const fit = plotTransform(art.ground, w, h);
          const [left, front, right] = art.ground;
          const back = [
            left[0] + right[0] - front[0],
            left[1] + right[1] - front[1],
          ];
          [...art.ground, back].forEach(([x, y]) => {
            const screen = fit.point(x, y),
              p = groundCoordinates(screen.x, screen.y);
            assert.ok(
              p.x >= -0.5 - 1e-9 &&
                p.x <= w - 0.5 + 1e-9 &&
                p.y >= -0.5 - 1e-9 &&
                p.y <= h - 0.5 + 1e-9,
              `${kind}/${rotation}: foundation stays inside ${w}×${h}`,
            );
            assert.equal(
              fit.point(x, y - 100).x,
              screen.x,
              "vertical walls remain upright",
            );
          });
          // Equal source lengths must stay equal everywhere in the sprite. The
          // old projective fit kept lines straight but stretched one roof side.
          for (const [x, y] of [
            [0, 0],
            [100, 100],
            [400, 300],
          ]) {
            const a = fit.point(x, y),
              b = fit.point(x + 100, y),
              c = fit.point(x, y + 100);
            assert.ok(Math.abs(b.x - a.x - 100 * fit.scale) < 1e-9);
            assert.ok(Math.abs(c.y - a.y - 100 * fit.scale) < 1e-9);
            assert.equal(b.y, a.y, "no shear along horizontal roof edges");
            assert.equal(c.x, a.x, "no shear along vertical walls");
          }
          const line = [
            [100, 80],
            [250, 120],
            [400, 160],
          ].map(([x, y]) => fit.point(x, y));
          const [a, b, c] = line;
          assert.ok(
            Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) <
              1e-8,
            "roof lines stay straight",
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
test("house upgrades charge once, retain families and plots, persist and increase capacity", () => {
  const sim = new Simulation(),
    house = sim.state.buildings.find((b) => b.kind === "house" && b.connected);
  const warehouse = sim.state.buildings.find((b) => b.kind === "warehouse");
  warehouse.inventory.planks = 40;
  const original = {
    x: house.x,
    y: house.y,
    rotation: house.rotation,
    plot: house.plot,
  };
  const residents = sim.state.residents
    .filter((r) => r.home === house.id)
    .map((r) => r.id);
  const money = sim.state.money,
    wood = sim.stored("wood"),
    stone = sim.stored("stone"),
    metal = sim.stored("metal");
  const env = {
    id: "upgrade-once",
    actorId: "test",
    expectedRevision: sim.state.revision,
    command: { type: "upgrade", id: house.id },
  };
  assert.equal(sim.execute(env).ok, true);
  assert.equal(sim.execute(env).ok, true);
  assert.equal(house.houseTier, 2);
  assert.equal(sim.state.money, money - 180);
  assert.equal(sim.stored("wood"), wood - 12);
  assert.equal(sim.stored("stone"), stone - 10);
  assert.equal(
    sim.state.residents.filter((r) => r.home === house.id).length,
    6,
  );
  assert.equal(execute(sim, { type: "upgrade", id: house.id }).ok, true);
  assert.equal(houseCapacity(house), 9);
  assert.equal(sim.state.money, money - 600);
  assert.equal(sim.stored("planks"), 24);
  assert.equal(sim.stored("stone"), stone - 30);
  assert.equal(sim.stored("metal"), metal - 8);
  assert.deepEqual(
    { x: house.x, y: house.y, rotation: house.rotation, plot: house.plot },
    original,
  );
  assert.ok(
    residents.every((id) =>
      sim.state.residents.some((r) => r.id === id && r.home === house.id),
    ),
  );
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(restored.building(house.id).houseTier, 3);
  assert.equal(
    restored.state.residents.filter((r) => r.home === house.id).length,
    9,
  );
  for (let i = 0; i < 4; i++)
    assert.equal(execute(restored, { type: "rotate", id: house.id }).ok, true);
  assert.equal(restored.building(house.id).houseTier, 3);
  const before = restored.snapshot();
  assert.equal(execute(restored, { type: "upgrade", id: house.id }).ok, false);
  assert.deepEqual(restored.snapshot(), before);
  const gold = restored.state.money;
  assert.equal(
    execute(restored, { type: "demolish", x: house.x, y: house.y }).ok,
    true,
  );
  assert.equal(restored.state.money, gold + Math.floor((90 + 180 + 420) / 2));
});

test("unaffordable, disconnected, stale and non-house upgrades change nothing", () => {
  for (const scenario of [
    "gold",
    "wood",
    "stone",
    "disconnected",
    "wrong-building",
    "stale",
  ]) {
    const sim = new Simulation(),
      house = sim.state.buildings.find(
        (b) => b.kind === "house" && b.connected,
      );
    if (scenario === "gold") sim.state.money = 0;
    if (scenario === "wood" || scenario === "stone")
      sim.state.buildings.find((b) => b.kind === "warehouse").inventory[
        scenario
      ] = 0;
    if (scenario === "disconnected") {
      house.rotation = (house.rotation + 2) % 4;
      sim.reconnect();
      assert.equal(house.connected, false);
    }
    const before = sim.snapshot();
    const id =
      scenario === "wrong-building"
        ? sim.state.buildings.find((b) => b.kind === "warehouse").id
        : house.id;
    const result = sim.execute({
      id: scenario,
      actorId: "test",
      expectedRevision: sim.state.revision + (scenario === "stale" ? 1 : 0),
      command: { type: "upgrade", id },
    });
    assert.equal(result.ok, false, scenario);
    assert.deepEqual(sim.snapshot(), before, scenario);
  }
});

test("old saves default to cottages and malformed house tiers are rejected", () => {
  const old = new Simulation().snapshot();
  for (const b of old.buildings) delete b.houseTier;
  const loaded = parseSave(JSON.stringify(old));
  assert.ok(
    loaded.buildings
      .filter((b) => b.kind === "house")
      .every((b) => b.houseTier === 1),
  );
  for (const tier of [0, 4, 1.5, "2", {}]) {
    const save = structuredClone(old);
    save.buildings.find((b) => b.kind === "house").houseTier = tier;
    assert.throws(() => parseSave(JSON.stringify(save)), /Invalid building/);
  }
  const save = structuredClone(old);
  save.buildings.find((b) => b.kind === "warehouse").houseTier = 2;
  assert.throws(() => parseSave(JSON.stringify(save)), /Invalid building/);
});

test("fence spans meet across tile boundaries for every connection pattern", () => {
  const p = { x: 10, y: 10 };
  for (let mask = 0; mask < 16; mask++) {
    const neighbours = FENCE_DIRECTIONS.flatMap((d, i) =>
      mask & (1 << i)
        ? [{ id: i, kind: "fence", natural: false, x: p.x + d.x, y: p.y + d.y }]
        : [],
    );
    assert.equal(fenceMask(p, neighbours), mask);
    for (const [i, d] of FENCE_DIRECTIONS.entries())
      if (mask & (1 << i)) {
        const edge = fenceSpans(mask).find(
          ([, end]) => end.x === d.x / 2 && end.y === d.y / 2,
        );
        const neighbourEnd = fenceSpans(1 << (i + 2) % 4)[0][1];
        assert.ok(edge);
        assert.equal(p.x + edge[1].x, p.x + d.x + neighbourEnd.x);
        assert.equal(p.y + edge[1].y, p.y + d.y + neighbourEnd.y);
      }
  }
  assert.equal(
    fenceMask(p, [
      { kind: "fence", x: 11, y: 11 },
      { kind: "bench", x: 11, y: 10 },
    ]),
    0,
  );
});

test("placed fences form corners and update neighbouring connections after removal and save", () => {
  const sim = new Simulation();
  const points = [
    { x: 16, y: 17 },
    { x: 17, y: 17 },
    { x: 18, y: 17 },
  ];
  sim.state.decorations = sim.state.decorations.filter(
    (d) => !points.some((p) => p.x === d.x && p.y === d.y),
  );
  for (const p of points)
    assert.equal(execute(sim, { type: "place", kind: "fence", ...p }).ok, true);
  assert.equal(fenceMask(points[1], sim.state.decorations), 5);
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(fenceMask(points[1], restored.state.decorations), 5);
  assert.equal(execute(restored, { type: "demolish", ...points[1] }).ok, true);
  assert.equal(fenceMask(points[0], restored.state.decorations), 0);
  assert.equal(fenceMask(points[2], restored.state.decorations), 0);
});

test("bridges leave front entrances open and ramp to the bank without opening side walls", () => {
  const seed = new Simulation().state.buildings.find((b) => b.kind === "house");
  let house, tile;
  for (let x = 18; x < 26 && !house; x++)
    for (let y = 2; y < 24 && !house; y++)
      for (let rotation = 0; rotation < 4; rotation++) {
        if (
          !footprint("house", x, y, rotation).every(
            (p) => !isBridge(new Set([key(p)]), p.x, p.y),
          )
        )
          continue;
        const front = frontage("house", x, y, rotation).find((p) =>
          isBridge(new Set([key(p)]), p.x, p.y),
        );
        if (front) {
          house = { ...seed, x, y, rotation };
          tile = front;
          break;
        }
      }
  assert.ok(house);
  const roads = new Set([key(tile)]),
    landings = bridgeLandings(roads, tile, [house]);
  const edge = landings.findIndex(Boolean),
    d = FENCE_DIRECTIONS[edge];
  assert.ok(edge >= 0);
  assert.equal(bridgeRails(roads, tile, [house])[edge], false);
  assert.equal(deckHeight(roads, tile, d.x / 2, d.y / 2, [house]), 0);
  assert.equal(deckHeight(roads, tile, 0, 0, [house]), BRIDGE_HEIGHT);
  assert.equal(
    bridgeRails(roads, tile, [
      { ...house, rotation: (house.rotation + 2) % 4 },
    ])[edge],
    true,
  );
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
    true,
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
  delete old.decorations;
  old.buildings.find((b) => b.kind === "park").x = 12;
  const upgraded = parseSave(JSON.stringify(old));
  assert.equal(upgraded.version, 3);
  assert.equal(upgraded.buildings.length, old.buildings.length);
  assert.equal(upgraded.money, old.money);
  assert.doesNotThrow(() => parseSave(JSON.stringify(upgraded)));
});

test("every building can be placed in every orientation, with rectangular plots turning and saves preserving it", () => {
  for (const kind of Object.keys(BUILDINGS))
    for (let rotation = 0; rotation < 4; rotation++) {
      const seed = new Simulation().snapshot();
      seed.buildings = seed.buildings.filter((b) => b.kind === "warehouse");
      seed.roads = [];
      seed.decorations = [];
      seed.residents = [];
      seed.agents = [];
      seed.money = 10000;
      Object.assign(seed.buildings[0].inventory, {
        wood: 1000,
        stone: 1000,
        metal: 1000,
      });
      const sim = new Simulation(seed),
        x = kind === "quarry" || kind === "mine" ? 19 : 8,
        y = kind === "quarry" ? 4 : kind === "mine" ? 7 : 20;
      assert.equal(
        execute(sim, { type: "place", kind, x, y, rotation }).ok,
        true,
        `${kind}/${rotation}`,
      );
      const b = sim.buildingAt(x, y),
        [w, h] = dimensions(kind, rotation);
      assert.deepEqual(b.plot, [w, h]);
      assert.equal(sim.buildingAt(x + w - 1, y + h - 1).id, b.id);
      assert.equal(sim.buildingAt(x + w, y + h), undefined);
      const restored = new Simulation(
        parseSave(JSON.stringify(sim.snapshot())),
      );
      assert.equal(restored.building(b.id).rotation, rotation);
      assert.deepEqual(restored.building(b.id).plot, [w, h]);
      for (let i = 0; i < 4; i++)
        assert.equal(execute(sim, { type: "rotate", id: b.id }).ok, true);
      assert.equal(b.rotation, rotation);
    }
});

test("front access distinguishes the entrance from side and back roads", () => {
  const sim = new Simulation();
  assert.equal(
    execute(sim, { type: "place", kind: "house", x: 4, y: 11, rotation: 0 }).ok,
    true,
  );
  const b = sim.buildingAt(4, 11);
  assert.equal(
    b.connected,
    false,
    "a back road and a side road are not entrance access",
  );
  assert.deepEqual(sim.adjacent(b), []);
  assert.equal(execute(sim, { type: "rotate", id: b.id }).ok, true);
  assert.equal(
    b.connected,
    true,
    "turning the entrance to the existing road connects the house",
  );
  const residents = sim.state.residents
    .filter((r) => r.home === b.id)
    .map((r) => r.id);
  assert.equal(residents.length, 3);
  assert.equal(execute(sim, { type: "rotate", id: b.id }).ok, true);
  assert.equal(b.connected, true, "the north road also reaches this entrance");
  assert.equal(execute(sim, { type: "rotate", id: b.id }).ok, true);
  assert.equal(b.connected, false);
  assert.deepEqual(
    sim.state.residents.filter((r) => r.home === b.id).map((r) => r.id),
    residents,
    "rotating away from a road does not evict residents",
  );
});

test("a rotated rectangular plot cannot overlap a road and rejection changes nothing", () => {
  const sim = new Simulation();
  assert.equal(
    execute(sim, { type: "place", kind: "farm", x: 8, y: 20 }).ok,
    true,
  );
  const b = sim.buildingAt(8, 20);
  assert.equal(
    execute(sim, { type: "place", kind: "road", x: 8, y: 22 }).ok,
    true,
  );
  const before = sim.snapshot();
  assert.equal(execute(sim, { type: "rotate", id: b.id }).ok, false);
  assert.deepEqual(sim.snapshot(), before);
});

test("all decoration types can be placed, selected by tile, removed and saved without regrowth", () => {
  for (const [kind, def] of Object.entries(DECORATIONS)) {
    const sim = new Simulation(),
      natural = sim.decorationAt(9, 20);
    if (natural) execute(sim, { type: "demolish", x: 9, y: 20 });
    const money = sim.state.money,
      agents = sim.state.agents.map((a) => a.id);
    assert.equal(execute(sim, { type: "place", kind, x: 9, y: 20 }).ok, true);
    assert.equal(sim.state.money, money - def.cost);
    assert.equal(sim.decorationAt(9, 20).kind, kind);
    assert.deepEqual(
      sim.state.agents.map((a) => a.id),
      agents,
      "gardening does not reset every journey",
    );
    assert.equal(execute(sim, { type: "place", kind, x: 9, y: 20 }).ok, false);
    let restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
    assert.equal(restored.decorationAt(9, 20).kind, kind);
    assert.equal(execute(restored, { type: "demolish", x: 9, y: 20 }).ok, true);
    assert.equal(
      restored.state.money,
      money - def.cost + Math.floor(def.cost / 2),
    );
    restored = new Simulation(parseSave(JSON.stringify(restored.snapshot())));
    assert.equal(restored.decorationAt(9, 20), undefined);
    assert.equal(
      execute(restored, { type: "place", kind, x: 25, y: 20 }).ok,
      false,
    );
    assert.equal(
      execute(restored, { type: "place", kind, x: 6, y: 20 }).ok,
      false,
    );
  }
  const sim = new Simulation(),
    tree = sim.state.decorations.find((d) => d.kind === "oak"),
    money = sim.state.money;
  assert.equal(
    execute(sim, { type: "demolish", x: tree.x, y: tree.y }).ok,
    true,
  );
  assert.equal(
    sim.state.money,
    money,
    "natural trees are not an unlimited source of gold",
  );
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(restored.decorationAt(tree.x, tree.y), undefined);
});

test("version two towns retain occupied plots, stocks, residents and front-connected access", () => {
  const sim = new Simulation(),
    old = sim.snapshot();
  old.version = 2;
  delete old.decorations;
  old.buildings.forEach((b) => {
    delete b.plot;
    b.rotation = 0;
  });
  const restored = new Simulation(parseSave(JSON.stringify(old)));
  assert.equal(restored.state.version, 3);
  for (const b of restored.state.buildings) {
    const original = old.buildings.find((o) => o.id === b.id);
    assert.equal(b.x, original.x);
    assert.equal(b.y, original.y);
    assert.deepEqual(b.plot, FOOTPRINTS[b.kind]);
    assert.equal(b.connected, true);
  }
  assert.equal(restored.state.money, old.money);
  assert.deepEqual(restored.totals(), sim.totals());
  assert.deepEqual(
    restored.state.residents.map((r) => r.id),
    old.residents.map((r) => r.id),
  );
  assert.ok(restored.state.decorations.length > 0);
});

import { MapTouches, gestureCamera } from "../.test-dist/gestures.js";
test("touch drags and pinches never place buildings on release", () => {
  const t = new MapTouches();
  t.start(1, { x: 100, y: 100 });
  assert.equal(t.move(1, { x: 103, y: 102 }), null);
  assert.equal(t.end(1), true);
  t.start(1, { x: 100, y: 100 });
  assert.ok(t.move(1, { x: 130, y: 105 }));
  assert.equal(t.end(1), false);
  t.start(1, { x: 100, y: 100 });
  t.start(2, { x: 200, y: 100 });
  assert.equal(t.move(2, { x: 250, y: 100 }).scale, 1.5);
  assert.equal(t.end(2), false);
  t.move(1, { x: 105, y: 100 });
  assert.equal(t.end(1), false);
  t.start(1, { x: 20, y: 20 });
  t.cancel();
  assert.equal(t.end(1), false);
  t.start(3, { x: 20, y: 20 });
  assert.equal(t.end(3), true);
});
test("pinch zoom preserves the world point beneath the moving finger midpoint, including limits", () => {
  const c = { scrollX: 150, scrollY: 300, width: 390, height: 700, zoom: 1.2 };
  for (const scale of [0.01, 1.5, 100]) {
    const g = { from: { x: 80, y: 250 }, to: { x: 110, y: 275 }, scale };
    const n = gestureCamera(c, g);
    const world = (camera, p) => ({
      x: camera.scrollX + c.width / 2 + (p.x - c.width / 2) / camera.zoom,
      y: camera.scrollY + c.height / 2 + (p.y - c.height / 2) / camera.zoom,
    });
    const before = world(c, g.from),
      after = world(n, g.to);
    assert.ok(Math.abs(before.x - after.x) < 1e-8);
    assert.ok(Math.abs(before.y - after.y) < 1e-8);
    assert.ok(n.zoom >= 0.55 && n.zoom <= 2.7);
  }
});

import {
  planTerrain,
  terrainCell,
  groundHeight,
} from "../.test-dist/terrain.js";
test("terrain brushes charge once, persist, protect structures and refund undo without resetting production", () => {
  const sim = new Simulation();
  const money = sim.state.money;
  const b = sim.state.buildings.find((b) => b.kind === "sawmill");
  b.progress = 2.5;
  const cmd = { type: "terrain", mode: "raise", x: 2, y: 2, size: 3, steps: 2 };
  assert.equal(planTerrain(sim.state, cmd).cost, 144);
  assert.equal(execute(sim, cmd, "height-once").ok, true);
  assert.equal(execute(sim, cmd, "height-once").ok, true);
  assert.equal(sim.state.money, money - 144);
  assert.equal(groundHeight(2, 2, sim.state.terrain), 16);
  assert.equal(b.progress, 2.5);
  const loaded = parseSave(JSON.stringify(sim.snapshot()));
  assert.deepEqual(loaded.terrain, sim.state.terrain);
  const before = sim.snapshot();
  assert.equal(execute(sim, { ...cmd, x: 6, y: 10, size: 1 }).ok, false);
  assert.deepEqual(sim.snapshot(), before);
  assert.equal(execute(sim, { type: "undoTerrain" }).ok, true);
  assert.equal(sim.state.money, money);
  assert.equal(groundHeight(2, 2, sim.state.terrain), 0);
  assert.equal(execute(sim, { type: "undoTerrain" }).ok, false);
});
test("brushes raise the lowest terraces, lower the highest, and level to the selected center", () => {
  const sim = new Simulation();
  sim.state.terrain = { "1,1": { kind: "land", height: 2 } };
  let plan = planTerrain(sim.state, {
    type: "terrain",
    mode: "raise",
    x: 2,
    y: 2,
    size: 3,
  });
  assert.ok(!plan.changes.some((p) => p.x === 1 && p.y === 1));
  assert.ok(plan.changes.every((c) => c.height === 1));
  assert.equal(
    execute(sim, { type: "terrain", mode: "lower", x: 2, y: 2, size: 3 }).ok,
    true,
  );
  assert.equal(terrainCell(1, 1, sim.state.terrain).height, 1);
  assert.equal(
    execute(sim, { type: "terrain", mode: "level", x: 2, y: 2, size: 3 }).ok,
    true,
  );
  assert.equal(terrainCell(1, 1, sim.state.terrain).height, 0);
});
test("ponds flood connected low ground, permit real bridges, and filling water permits buildings", () => {
  const sim = new Simulation();
  sim.state.decorations = [];
  sim.state.terrain = {
    "1,1": { kind: "land", height: -2 },
    "2,1": { kind: "land", height: -1 },
  };
  assert.equal(
    execute(sim, { type: "terrain", mode: "water", x: 1, y: 1, size: 1 }).ok,
    true,
  );
  assert.equal(terrainCell(2, 1, sim.state.terrain).kind, "water");
  assert.equal(terrainCell(3, 1, sim.state.terrain).kind, "land");
  assert.equal(
    execute(sim, { type: "place", kind: "bridge", x: 1, y: 1 }).ok,
    true,
  );
  assert.equal(isBridge(sim.roads, 1, 1, sim.state.terrain), true);
  assert.ok(
    roadHeight(sim.roads, 1, 1, sim.state.buildings, sim.state.terrain) > 0,
  );
  assert.equal(
    execute(sim, { type: "terrain", mode: "land", x: 26, y: 21, size: 2 }).ok,
    true,
  );
  assert.equal(
    execute(sim, { type: "place", kind: "house", x: 26, y: 21 }).ok,
    true,
  );
  assert.ok(
    parseSave(JSON.stringify(sim.snapshot())).buildings.some(
      (b) => b.x === 26 && b.y === 21,
    ),
  );
});
test("buildings require level ground and sloping roads meet continuously at shared edges", () => {
  const sim = new Simulation();
  sim.state.decorations = [];
  assert.equal(
    execute(sim, { type: "terrain", mode: "raise", x: 1, y: 1, size: 1 }).ok,
    true,
  );
  assert.match(sim.canPlace("house", 1, 1), /Level/);
  sim.state.terrain = {
    "1,1": { kind: "land", height: 1 },
    "2,1": { kind: "land", height: 2 },
    "3,1": { kind: "land", height: 3 },
  };
  for (const x of [1, 2, 3])
    assert.equal(
      execute(sim, { type: "place", kind: "road", x, y: 1 }).ok,
      true,
    );
  for (const x of [1.5, 2.5])
    for (const y of [0.6, 1, 1.4])
      assert.ok(
        Math.abs(
          roadHeight(sim.roads, x - 1e-7, y, [], sim.state.terrain) -
            roadHeight(sim.roads, x + 1e-7, y, [], sim.state.terrain),
        ) < 1e-4,
      );
  assert.equal(
    execute(sim, { type: "place", kind: "road", x: 4, y: 1 }).ok,
    false,
    "roads cannot jump a cliff",
  );
});
test("invalid terrain, unaffordable edits, and occupied flood areas leave towns intact", () => {
  const sim = new Simulation();
  const baseline = sim.snapshot();
  for (const command of [
    { mode: "raise", size: 0 },
    { mode: "raise", size: 1, steps: 99 },
    { mode: "water", size: 5, x: 6, y: 10 },
  ]) {
    assert.equal(
      execute(sim, { type: "terrain", x: 2, y: 2, ...command }).ok,
      false,
    );
    assert.deepEqual(sim.snapshot(), baseline);
  }
  sim.state.money = 0;
  assert.equal(
    execute(sim, { type: "terrain", x: 2, y: 2, size: 1, mode: "raise" }).ok,
    false,
  );
  for (const cell of [
    { kind: "land", height: 100 },
    { kind: "water", height: 2 },
    { kind: "lava", height: 0 },
  ])
    assert.throws(
      () =>
        parseSave(JSON.stringify({ ...baseline, terrain: { "1,1": cell } })),
      /terrain/,
    );
  assert.throws(
    () =>
      parseSave(
        JSON.stringify({
          ...baseline,
          terrain: { "99,1": { kind: "land", height: 1 } },
        }),
      ),
    /terrain/,
  );
});
