import test from "node:test";
import assert from "node:assert/strict";
import { nearbyDeposits } from "../.test-dist/deposits.js";
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
  foundationGeometry,
  FOUNDATION_HEIGHT,
  STONES_PER_TILE,
} from "../.test-dist/foundation.js";
import { plazaLayout } from "../.test-dist/park-art.js";
import { rotorView } from "../.test-dist/windmill.js";
import { fisheryCells } from "../.test-dist/shoreline.js";
import {
  BUILDINGS,
  SIZE,
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
import { Simulation, parseSave, key } from "./legacy-town.mjs";
import { roadStroke, planRoad } from "../.test-dist/road-stroke.js";
import { ROAD_TYPES, roadTypeAt } from "../.test-dist/roads.js";
import { forestTargets, forestInside, treeStage, LOGS_PER_TREE, REGROW_TICKS } from "../.test-dist/forestry.js";
import {
  DEPOSITS,
  INITIAL_RESERVE,
  deeperLayer,
} from "../.test-dist/deposits.js";
import { baseTerrain } from "../.test-dist/terrain.js";
import { daylight, warmEmission, shiftChange, DAY_TICKS, lengthenDays } from "../.test-dist/daylight.js";
import {townNeeds,buildingNeeds} from "../.test-dist/needs.js";
import {planRemoval} from "../.test-dist/removal.js";
import {
  NIGHT_AMBIENT,
  windowGround,
  castShadow,
} from "../.test-dist/lighting.js";
import {
  serviceCoverage,
  servicePreview,
  serviceOpen,
  MAX_COMMUTE,
} from "../.test-dist/proximity.js";
import {
  nextUpgrade,
  productionRate,
  outputCapacity,
  materialGuidance,
} from "../.test-dist/upgrades.js";
import { walkFrame, working } from "../.test-dist/animation.js";
import {
  constructionWork,
  builderFrame,
  builderPosition,
  builderCapacity,
  constructionCrew,
} from "../.test-dist/construction.js";
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
test("the displayed day advances at midnight while keeping the 08:00 start", () => {
  assert.equal(daylight(0).day, 1);
  assert.equal(daylight(0).hour, 8);
  assert.equal(daylight(159 * 4).day, 1);
  assert.equal(daylight(160 * 4).day, 2);
  assert.equal(daylight(160 * 4).hour, 0);
  assert.equal(daylight(240 * 4).day, 2);
});

test("drag removal protects the last warehouse atomically and queues stock recovery",()=>{
  const sim=new Simulation(),warehouse=sim.state.buildings.find(b=>b.kind==="warehouse");
  const before=sim.snapshot();
  assert.equal(execute(sim,{type:"removeStroke",from:warehouse,to:{x:warehouse.x+3,y:warehouse.y}}).ok,false);
  assert.deepEqual(sim.snapshot(),before);
  const farm=sim.state.buildings.find(b=>b.kind==="farm");farm.inventory.grain=17;
  const plan=planRemoval(sim,farm,{x:farm.x+1,y:farm.y+1});
  assert.equal(plan.buildings.size,1);
  const stock=sim.stored("grain"),gold=sim.state.money;
  assert.equal(execute(sim,{type:"removeStroke",from:farm,to:{x:farm.x+1,y:farm.y+1}}).ok,true);
  assert.equal(sim.building(farm.id).construction.demolition,true);
  assert.equal(sim.stored("grain"),stock);
  assert.equal(farm.inventory.grain,17);
  assert.equal(sim.state.money,gold);
});

test("needs distinguish ready meals, staffed workplaces and reachable leisure from stored totals",()=>{
  const sim=new Simulation();
  for(const b of sim.state.buildings){b.inventory.bread=0;b.inventory.fish=0;}
  const bakery=sim.state.buildings.find(b=>b.kind==="bakery");
  bakery.inventory.bread=90;
  const needs=townNeeds(sim),food=needs.find(n=>n.id==="food");
  assert.equal(food.have,0,"undelivered food is not ready for households");
  assert.equal(food.need,Math.ceil(sim.state.residents.length/3));
  assert.equal(needs.find(n=>n.id==="nightlife").have,0);
  const jobs=sim.state.buildings.filter(b=>b.enabled&&!b.construction&&BUILDINGS[b.kind].jobs);
  assert.equal(needs.find(n=>n.id==="workers").need,jobs.reduce((n,b)=>n+BUILDINGS[b.kind].jobs,0));
  bakery.inventory.flour=0;
  assert.equal(buildingNeeds(sim,bakery).find(n=>n.label==="Flour").ok,false);
  bakery.inventory.flour=BUILDINGS.bakery.recipe.amount;
  assert.equal(buildingNeeds(sim,bakery).find(n=>n.label==="Flour").ok,true);
});

test("longer days preserve old save date, hour and stump regrowth age exactly once",()=>{
  assert.equal(DAY_TICKS*STEP,240);
  const world={tick:750,decorations:[{cutAt:700}]};
  lengthenDays(world);
  assert.equal(daylight(world.tick).hour,11);
  assert.equal(daylight(world.tick).day,4);
  assert.equal(world.tick-world.decorations[0].cutAt,50);
  const snapshot=structuredClone(world);lengthenDays(world);
  assert.deepEqual(world,snapshot);
});
test("night light pools follow each rotated foundation and shadows point away from nearby lamps", () => {
  assert.ok(NIGHT_AMBIENT.every((value, i) => value < [122, 138, 177][i]));
  for (let rotation = 0; rotation < 4; rotation++) {
    const b = { kind: "warehouse", x: 10, y: 12, rotation, plot: [2, 3] };
    const [w, h] = dimensions(b.kind, rotation, b.plot);
    const frontX = (b.x + w - b.y - h) * 32;
    assert.equal(
      windowGround(b, frontX, 8).y,
      (b.x + w + b.y + h - 1) * 16 - 8,
    );
    assert.ok(Number.isFinite(windowGround(b, -999, 0).y));
    assert.ok(Number.isFinite(windowGround(b, 999, 0).y));
  }
  const lamp = { x: 0, y: -25, groundX: 0, groundY: 0, power: 1, radius: 60 };
  assert.ok(castShadow(20, 10, [lamp], true).x > 0);
  assert.ok(castShadow(-20, -10, [lamp], true).x < 0);
  assert.ok(castShadow(20, 10, [lamp], true).y > 0);
  assert.ok(castShadow(-20, -10, [lamp], true).y < 0);
  assert.ok(
    castShadow(400, 400, [lamp], true).alpha <
      castShadow(20, 10, [lamp], true).alpha,
  );
});
test("shift notices match work-rate boundaries and ignore loading, pauses and time resets", () => {
  assert.equal(shiftChange(119 * 4, 120 * 4), "night");
  assert.equal(daylight(120 * 4).workRate, 0.25);
  assert.equal(shiftChange(219 * 4, 220 * 4), "morning");
  assert.equal(daylight(220 * 4).workRate, 1);
  assert.equal(
    shiftChange(116 * 4, 124 * 4),
    "night",
    "accelerated play may skip the exact boundary",
  );
  for (const [before, after] of [
    [undefined, 150],
    [120, 120],
    [160, 161],
    [120, 50],
    [0, 360],
    [99, 100],
  ]) {
    assert.equal(shiftChange(before === undefined ? undefined : before * 4, after * 4), null);
  }
});
test("construction roster follows assigned residents through travel and work, and clears on completion", () => {
  const sim = new Simulation();
  const house = sim.state.buildings.find(
    (b) => b.kind === "house" && b.connected,
  );
  sim.state.money = 10000;
  Object.assign(
    sim.state.buildings.find((b) => b.kind === "warehouse").inventory,
    { planks: 100, stone: 100 },
  );
  assert.equal(execute(sim, { type: "upgrade", id: house.id }).ok, true);
  const crew = constructionCrew(sim, house);
  assert.equal(crew.length, house.workers);
  assert.equal(crew.length, builderCapacity(house));
  assert.ok(
    crew.every((c) => c.agent?.resident === c.resident.id && !c.onsite),
  );
  for (
    let tick = 0;
    tick < 400 && !constructionCrew(sim, house).some((c) => c.onsite);
    tick++
  )
    sim.step();
  const working = constructionCrew(sim, house).find((c) => c.onsite);
  assert.ok(working, "a real assigned builder reaches the plot");
  assert.match(working.status, /Working on site/);
  finishConstruction(sim, house);
  assert.deepEqual(constructionCrew(sim, house), []);
});
const finishConstruction = (sim, b) => {
  for (let i = 0; i < 5000 && b.construction; i++) sim.step();
  assert.equal(b.construction, undefined, "builders complete their work");
};
test("construction work scales by tier and worker animation keeps fixed feet and stays inside every plot", () => {
  assert.ok(constructionWork("house", 3) > constructionWork("house", 2));
  assert.ok(constructionWork("house", 2) > constructionWork("house"));
  for (const kind of Object.keys(BUILDINGS))
    for (let rotation = 0; rotation < 4; rotation++) {
      const b = { kind, rotation, x: 4, y: 4 },
        [w, h] = dimensions(kind, rotation);
      for (let slot = 0; slot < builderCapacity(b); slot++) {
        const p = builderPosition(b, slot);
        assert.ok(
          p.x > b.x - 0.5 &&
            p.x < b.x + w - 0.5 &&
            p.y > b.y - 0.5 &&
            p.y < b.y + h - 0.5,
        );
        const idle = builderFrame(slot % 2, slot % 2, 0, false),
          frames = new Set();
        for (let t = 0; t < 2; t += 0.1) {
          const pose = builderFrame(slot % 2, slot % 2, t, true);
          frames.add(pose.frame);
          assert.equal(pose.originX, idle.originX);
          assert.equal(pose.originY, idle.originY);
          assert.equal(pose.size, idle.size);
          assert.deepEqual(builderFrame(slot % 2, slot % 2, t, false), idle);
        }
        assert.equal(frames.size, 4);
      }
    }
});

test("construction requires available builders to arrive, reserves costs once and opens only when complete", () => {
  const sim = new Simulation(),
    money = sim.state.money,
    wood = sim.stored("wood");
  const jobs = sim.state.residents
    .filter((r) => r.job !== null)
    .map((r) => [r.id, r.job]);
  assert.equal(
    execute(sim, { type: "place", kind: "house", x: 4, y: 11, rotation: 1 }).ok,
    true,
  );
  const b = sim.buildingAt(4, 11);
  assert.ok(b.construction);
  assert.equal(sim.state.money, money - BUILDINGS.house.cost);
  assert.equal(sim.stored("wood"), wood - BUILDINGS.house.materials.wood);
  assert.equal(sim.state.residents.filter((r) => r.home === b.id).length, 0);
  assert.ok(b.workers > 0);
  for (const [id, job] of jobs)
    assert.equal(
      sim.state.residents.find((r) => r.id === id).job,
      job,
      "existing industry worker keeps their job",
    );
  sim.step();
  assert.equal(b.construction.completed, 0, "travel does not count as labour");
  for (
    let i = 0;
    i < 500 && !sim.state.agents.some((a) => a.onsite === b.id);
    i++
  )
    sim.step();
  const crew = sim.state.agents.filter((a) => a.onsite === b.id);
  assert.ok(crew.length > 0, "builders reach the site");
  const progress = b.construction.completed;
  sim.step();
  assert.equal(b.construction.completed, progress + crew.length * STEP);
  const saved = new Simulation(parseSave(JSON.stringify(sim.state)));
  assert.equal(
    saved.building(b.id).construction.completed,
    b.construction.completed,
  );
  assert.equal(
    execute(sim, { type: "move", id: b.id, x: b.x, y: b.y }).ok,
    true,
  );
  assert.equal(
    b.construction.completed,
    progress + crew.length * STEP,
    "moving preserves labour",
  );
  finishConstruction(sim, b);
  assert.equal(sim.state.residents.filter((r) => r.home === b.id).length, 3);
  assert.equal(
    sim.state.agents.some((a) => a.onsite === b.id),
    false,
    "builders leave after completion",
  );
});

test("disconnected or unstaffed construction never progresses and malformed progress is rejected", () => {
  const sim = new Simulation();
  execute(sim, { type: "place", kind: "house", x: 4, y: 11, rotation: 0 });
  const b = sim.buildingAt(4, 11);
  advance(sim, 120);
  assert.equal(b.construction.completed, 0);
  assert.equal(b.workers, 0);
  assert.match(sim.alert(b).message, /front entrance/);
  b.construction.completed = -1;
  assert.throws(() => parseSave(JSON.stringify(sim.state)), /Invalid building/);
});

test("moving preserves a working building, stocks, labour, progress and live deliveries", () => {
  const sim = new Simulation();
  advance(sim, 50);
  const b = sim.state.buildings.find((b) => b.kind === "sawmill");
  b.progress = 2.5;
  b.inventory.planks = 13;
  let destination;
  for (let y = 0; y < 28 && !destination; y++)
    for (let x = 0; x < 28; x++) {
      if (
        (x !== b.x || y !== b.y) &&
        !sim.canMove(b.id, x, y) &&
        sim.state.buildings.some(
          (w) => w.kind === "warehouse" && sim.route({ ...b, x, y }, w),
        )
      ) {
        destination = { x, y };
        break;
      }
    }
  assert.ok(destination, "a connected destination exists");
  const before = structuredClone(b),
    totals = sim.totals(),
    money = sim.state.money;
  const travellers = sim.state.agents.map((a) => ({
    id: a.id,
    segment: a.segment,
    progress: a.progress,
  }));
  const result = execute(sim, { type: "move", id: b.id, ...destination });
  assert.equal(result.ok, true, result.message);
  assert.equal(sim.building(b.id), b);
  for (const field of [
    "inventory",
    "progress",
    "produced",
    "enabled",
    "workers",
    "rotation",
    "plot",
  ])
    assert.deepEqual(b[field], before[field], field);
  assert.deepEqual(sim.totals(), totals);
  assert.equal(sim.state.money, money);
  for (const a of travellers) {
    const current = sim.state.agents.find((c) => c.id === a.id);
    assert.ok(current, "live traveller identity retained");
    assert.equal(current.segment, a.segment);
    assert.equal(current.progress, a.progress);
  }
  const loaded = parseSave(JSON.stringify(sim.state)).buildings.find(
    (c) => c.id === b.id,
  );
  const restored = structuredClone(b);
  for (const truck of sim.state.agents.filter(
    (a) => a.kind === "truck" && a.source === b.id && a.cargo,
  ))
    restored.inventory[truck.cargo] =
      (restored.inventory[truck.cargo] ?? 0) + truck.amount;
  assert.deepEqual(
    loaded,
    restored,
    "reload returns in-flight cargo to its source without losing goods",
  );
  advance(sim, 120);
  assert.ok(b.produced > before.produced, "production continues");
  assert.ok(sim.state.delivered > 0, "deliveries continue");
});

test("rejected moves are atomic and moving a house keeps its residents and tier", () => {
  const sim = new Simulation(),
    b = sim.state.buildings.find((b) => b.kind === "house");
  b.houseTier = 3;
  sim.reconnect();
  const before = structuredClone(sim.state);
  const road = sim.state.roads[0].split(",").map(Number);
  assert.equal(
    execute(sim, { type: "move", id: b.id, x: road[0], y: road[1] }).ok,
    false,
  );
  assert.deepEqual(sim.state, before);
  const residents = sim.state.residents
    .filter((r) => r.home === b.id)
    .map((r) => r.id);
  let target;
  for (let y = 0; y < 28 && !target; y++)
    for (let x = 0; x < 28; x++)
      if (!sim.canMove(b.id, x, y)) {
        target = { x, y };
        break;
      }
  assert.equal(execute(sim, { type: "move", id: b.id, ...target }).ok, true);
  assert.equal(b.houseTier, 3);
  assert.deepEqual(
    sim.state.residents.filter((r) => r.home === b.id).map((r) => r.id),
    residents,
  );
});

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
  const seed = sim.state.buildings.find((b) => b.kind === "quarry");
  const b = {
    ...seed,
    kind: "quarry",
    connected: true,
    enabled: true,
    workers: 2,
  };
  for(const id of nearbyDeposits(b))sim.state.deposits[id] = 0;
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
      x: 19,
      y: 16,
      rotation: 1,
    },
  ];
  seed.roadTypes={};
  seed.roads = [
    "20,10",
    ...Array.from({ length: 7 }, (_, i) => `21,${10 + i}`),
  ].filter((p) => p !== "21,13");
  seed.agents = [];
  seed.decorations = [];
  seed.residents = [];
  // This bridge test isolates transport; forestry now requires actual trees.
  seed.buildings.find((b) => b.kind === "forester").inventory.wood = 12;
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
    [21, 11, 3],
    [21, 11.5, 6],
    [21, 14.5, 6],
    [21, 15, 3],
    [21, 15.5, 0],
    [22.5, 18, 0],
    [23, 18, 3],
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
  assert.equal(house.houseTier, 1);
  assert.equal(house.construction.upgradeTo, 2);
  assert.equal(sim.state.money, money - 180);
  assert.equal(sim.stored("wood"), wood - 12);
  assert.equal(sim.stored("stone"), stone - 10);
  assert.equal(
    sim.state.residents.filter((r) => r.home === house.id).length,
    3,
    "existing family stays during renovation",
  );
  finishConstruction(sim, house);
  assert.equal(house.houseTier, 2);
  assert.equal(
    sim.state.residents.filter((r) => r.home === house.id).length,
    6,
  );
  const upgradeMoney = sim.state.money,
    upgradePlanks = sim.stored("planks"),
    upgradeStone = sim.stored("stone"),
    upgradeMetal = sim.stored("metal");
  assert.equal(execute(sim, { type: "upgrade", id: house.id }).ok, true);
  assert.equal(houseCapacity(house), 6);
  assert.equal(sim.state.money, upgradeMoney - 420);
  assert.equal(sim.stored("planks"), upgradePlanks - 16);
  assert.equal(sim.stored("stone"), upgradeStone - 20);
  assert.equal(sim.stored("metal"), upgradeMetal - 8);
  const saved = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(saved.building(house.id).construction.upgradeTo, 3);
  finishConstruction(sim, house);
  assert.equal(houseCapacity(house), 9);
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
  assert.equal(restored.building(house.id).construction.demolition,true);
  assert.equal(restored.state.money, gold, "refund waits for demolition to finish");
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
  assert.equal(deckHeight(roads, tile, 0, 0, [house]), BRIDGE_HEIGHT/2);
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
  // Include the five-times-longer crop growth and physical harvesting trips.
  advance(sim, 900);
  assert.ok(sim.state.delivered > 60);
  assert.ok(sim.state.exported > 0);
  assert.ok(sim.state.buildings.find((b) => b.kind === "bakery").produced > 0);
  assert.ok(sim.stored("stone") > 45);
  assert.ok(sim.stored("metal") > 25);
  assert.ok(sim.state.deposits["19,4"] < INITIAL_RESERVE);
  for (const b of sim.state.buildings)
    for (const n of Object.values(b.inventory)) assert.ok(n >= 0);
});

test("foresters travel to different real trees, chop stumps, then deliver timber", () => {
  const sim = new Simulation();
  const lodge = sim.state.buildings.find((b) => b.kind === "forester");
  lodge.inventory.wood = 0;
  const phases = new Set();
  let carried = false, delivered = false;
  for (let i = 0; i < 800; i++) {
    sim.step();
    const trips = lodge.forestry ?? [];
    const chopping = trips.filter(t => t.phase !== "returning");
    assert.equal(new Set(chopping.map(t => t.tree)).size, chopping.length, "workers reserve separate trees");
    for (const trip of trips) {
      phases.add(trip.phase);
      assert.ok(sim.state.agents.some(a => a.resident === trip.resident && a.onsite === lodge.id));
      if (trip.cargo) {
        carried = true;
        const tree = sim.state.decorations.find(d => d.id === trip.tree);
        assert.equal(treeStage(tree, sim.state.tick), "stump");
        assert.equal(trip.cargo, LOGS_PER_TREE);
        if (!lodge.produced) assert.equal(lodge.inventory.wood, 0, "carried logs are not usable inventory");
      }
    }
    if (lodge.produced >= LOGS_PER_TREE) { delivered = true; break; }
  }
  assert.deepEqual([...phases].sort(), ["chopping", "outbound", "returning"]);
  assert.ok(carried && delivered);
});

test("forestry reach respects woodland, buildings and regrowth, while garden trees are protected", () => {
  const sim = new Simulation(), lodge = sim.state.buildings.find(b => b.kind === "forester");
  const targets = forestTargets(sim, lodge);
  assert.ok(targets.length > 0);
  for (const {tree, path} of targets) {
    assert.ok(tree.natural && forestInside(lodge, tree));
    for (const p of path) assert.ok(!sim.buildingAt(p.x, p.y));
  }
  const tree = targets[0].tree;
  tree.natural = false; sim.state.revision++;
  assert.ok(!forestTargets(sim, lodge).some(t => t.tree.id === tree.id));
  tree.natural = true; tree.cutAt = sim.state.tick; sim.state.revision++;
  assert.ok(!forestTargets(sim, lodge).some(t => t.tree.id === tree.id));
  assert.equal(treeStage(tree, tree.cutAt), "stump");
  assert.equal(treeStage(tree, tree.cutAt + REGROW_TICKS * .6), "sapling");
  assert.equal(treeStage(tree, tree.cutAt + REGROW_TICKS * .9), "young");
  sim.state.tick += REGROW_TICKS;
  assert.equal(treeStage(tree, sim.state.tick), "mature");
  assert.ok(forestTargets(sim, lodge).some(t => t.tree.id === tree.id));
});

test("carried timber and stump age survive saves without duplicating goods", () => {
  const sim = new Simulation(), lodge = sim.state.buildings.find(b => b.kind === "forester");
  for (let i=0;i<600 && !lodge.forestry?.some(t=>t.cargo);i++) sim.step();
  assert.ok(lodge.forestry.some(t=>t.cargo));
  // Isolate the forestry load; delivery cargo has its own save tests.
  sim.state.agents = sim.state.agents.filter(a=>a.kind!=="truck");
  const timber = (lodge.inventory.wood??0) + lodge.forestry.reduce((n,t)=>n+t.cargo,0);
  const cuts = sim.state.decorations.filter(d=>d.cutAt!==undefined).map(d=>[d.id,d.cutAt]);
  let loaded = parseSave(JSON.stringify(sim.snapshot()));
  assert.equal(loaded.buildings.find(b=>b.id===lodge.id).inventory.wood,timber);
  assert.deepEqual(loaded.decorations.filter(d=>d.cutAt!==undefined).map(d=>[d.id,d.cutAt]),cuts);
  loaded = parseSave(JSON.stringify(loaded));
  assert.equal(loaded.buildings.find(b=>b.id===lodge.id).inventory.wood,timber);
  const malformed=sim.snapshot(); malformed.buildings.find(b=>b.id===lodge.id).forestry[0].cargo=10000;
  assert.throws(()=>parseSave(JSON.stringify(malformed)),/forestry/);
});

test("empty forest areas produce no free timber", () => {
  const sim = new Simulation(), lodge=sim.state.buildings.find(b=>b.kind==="forester");
  sim.state.decorations=sim.state.decorations.filter(d=>!forestInside(lodge,d));
  sim.state.revision++;
  advance(sim,130);
  assert.equal(lodge.produced,0);
  assert.equal(sim.alert(lodge)?.title,"No reachable mature trees");
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
  for(const id of nearbyDeposits(sim.state.buildings.find(b=>b.kind==='quarry')))sim.state.deposits[id]=0;
  sim.state.deposits["19,4"] = 3;
  advance(sim, 180);
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
      seed.roadTypes={};
  seed.roads = [];
      seed.decorations = [];
      seed.residents = [];
      seed.agents = [];
      seed.money = 10000;
      Object.assign(seed.buildings[0].inventory, {
        wood: 1000,
        stone: 1000,
        metal: 1000,
        planks: 1000,
      });
      const sim = new Simulation(seed),
        x = kind === "quarry" || kind === "mine" ? 16 : 8,
        y = kind === "quarry" || kind === "mine" ? 7 : 18;
      if (kind === "fishery") {
        sim.state.terrain = Object.fromEntries(
          fisheryCells(x, y, rotation).map((p) => [
            key(p),
            { kind: p.kind, height: 0 },
          ]),
        );
      }
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
        assert.equal(
          execute(sim, { type: "rotate", id: b.id }).ok,
          kind !== "fishery",
        );
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
  finishConstruction(sim, b);
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

test("a compact production plot cannot move onto a road and rejection changes nothing", () => {
  const sim = new Simulation();
  assert.equal(
    execute(sim, { type: "place", kind: "farm", x: 8, y: 20 }).ok,
    true,
  );
  const b = sim.buildingAt(8, 20);
  assert.equal(
    execute(sim, { type: "place", kind: "road", x: 7, y: 21 }).ok,
    true,
  );
  const before = sim.snapshot();
  assert.equal(
    execute(sim, { type: "move", id: b.id, x: 7, y: 21, rotation: 1 }).ok,
    false,
  );
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
      kind === "streetlight" || kind === "fence",
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
test("road drags form connected tile paths in every direction, including single clicks", () => {
  const from = { x: 8, y: 8 };
  for (const to of [
    { x: 8, y: 8 }, { x: 2, y: 8 }, { x: 14, y: 8 },
    { x: 8, y: 2 }, { x: 8, y: 14 }, { x: 2, y: 5 },
    { x: 5, y: 14 }, { x: 14, y: 5 }, { x: 12, y: 14 },
  ]) {
    const path = roadStroke(from, to);
    assert.deepEqual(path[0], from);
    assert.deepEqual(path.at(-1), to);
    assert.equal(path.length, Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + 1);
    assert.equal(new Set(path.map(key)).size, path.length);
    for (let i = 1; i < path.length; i++) {
      assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y), 1);
    }
  }
  for (const invalid of [undefined, null, { x: -1, y: 1 }, { x: SIZE, y: 1 }, { x: 1.5, y: 1 }, { x: Infinity, y: 1 }]) {
    assert.deepEqual(roadStroke(from, invalid), []);
    assert.deepEqual(roadStroke(invalid, from), []);
  }
});

test("one road drag builds roads and bridges together, charges only new tiles, and persists", () => {
  const sim = new Simulation();
  const from = { x: 1, y: 1 }, to = { x: 5, y: 1 };
  sim.state.terrain = { "3,1": { kind: "water", height: 0 } };
  assert.equal(execute(sim, { type: "place", kind: "road", ...from }).ok, true);
  sim.state.decorations = sim.state.decorations.filter((d) => ![
    "2,1", "2,2", "3,1",
  ].includes(key(d)));
  sim.state.decorations.push(
    { id: sim.state.nextId++, kind: "bench", x: 2, y: 1, natural: false },
    { id: sim.state.nextId++, kind: "bench", x: 2, y: 2, natural: false },
  );
  advance(sim, 3);
  const before = sim.snapshot();
  const travellers = before.agents.filter((a) => a.path.length > 1);
  assert.ok(travellers.length > 0);
  const plan = planRoad(sim, from, to);
  assert.equal(plan.error, undefined);
  assert.equal(plan.additions.length, 4);
  assert.equal(plan.bridges, 1);
  assert.equal(plan.cost, 12 * 3 + 55);
  assert.deepEqual(sim.snapshot(), before, "preview does not modify the town");
  const command = { type: "roadStroke", from, to };
  const result = execute(sim, command, "whole-road-once");
  assert.equal(result.ok, true, result.message);
  assert.equal(sim.state.revision, before.revision + 1);
  assert.equal(sim.state.money, before.money - plan.cost);
  for (const p of plan.tiles) assert.ok(sim.roads.has(key(p)));
  assert.equal(isBridge(sim.roads, 3, 1, sim.state.terrain), true);
  assert.ok(!sim.decorationAt(2, 1));
  assert.ok(sim.decorationAt(2, 2));
  for (const old of travellers) {
    const current = sim.state.agents.find((a) => a.id === old.id);
    assert.ok(current, "building roads keeps existing travellers");
    assert.deepEqual(current.path, old.path);
    assert.equal(current.progress, old.progress);
  }
  const after = sim.snapshot();
  assert.deepEqual(execute(sim, command, "whole-road-once"), result);
  assert.deepEqual(sim.snapshot(), after, "repeating the command never charges twice");
  assert.equal(execute(sim, command).ok, false, "an existing stretch needs no new construction");
  assert.deepEqual(sim.snapshot(), after);
  const restored = new Simulation(parseSave(JSON.stringify(after)));
  assert.deepEqual(restored.state.roads, after.roads);
  assert.equal(isBridge(restored.roads, 3, 1, restored.state.terrain), true);
});

test("blocked or unaffordable road stretches reject atomically without clearing scenery or spending gold", () => {
  for (const problem of ["money", "building", "cliff", "bank", "boat", "bounds", "missing"]) {
    const sim = new Simulation();
    let from = { x: 1, y: 1 }, to = { x: 5, y: 1 };
    if (problem === "money") sim.state.money = 50; // Every tile is individually affordable.
    if (problem === "building") {
      const b = sim.state.buildings.find((b) => b.kind === "warehouse");
      from = { x: b.x - 1, y: b.y };
      to = { x: b.x + 2, y: b.y };
    }
    if (problem === "cliff") sim.state.terrain = { "3,1": { kind: "land", height: 2 } };
    if (problem === "bank") sim.state.terrain = {
      "2,1": { kind: "land", height: 1 }, "3,1": { kind: "water", height: 0 },
    };
    if (problem === "boat") sim.state.buildings[0].fishing = { path: [{ x: 3, y: 1 }] };
    if (problem === "bounds") to = { x: SIZE, y: 1 };
    if (problem === "missing") to = undefined;
    const before = sim.snapshot();
    const preview = planRoad(sim, from, to);
    assert.ok(preview.error, problem);
    const result = execute(sim, { type: "roadStroke", from, to });
    assert.equal(result.ok, false, problem);
    assert.equal(result.message, preview.error);
    assert.deepEqual(sim.snapshot(), before, problem);
  }
});

test("a whole road stretch accepts gentle slopes but rejects a changed town revision", () => {
  const sim = new Simulation();
  const command = { type: "roadStroke", from: { x: 1, y: 1 }, to: { x: 3, y: 1 } };
  sim.state.terrain = {
    "1,1": { kind: "land", height: 0 },
    "2,1": { kind: "land", height: 1 },
    "3,1": { kind: "land", height: 2 },
  };
  const before = sim.snapshot();
  assert.equal(sim.execute({ id: "old-road", actorId: "test", expectedRevision: before.revision - 1, command }).ok, false);
  assert.deepEqual(sim.snapshot(), before);
  assert.equal(execute(sim, command).ok, true);
  assert.equal(sim.state.money, before.money - 36);
  for (const x of [1.5, 2.5]) assert.ok(Math.abs(
    roadHeight(sim.roads, x - 1e-7, 1, [], sim.state.terrain) -
    roadHeight(sim.roads, x + 1e-7, 1, [], sim.state.terrain),
  ) < 1e-4);
});

test("road surfaces build cheaply, upgrade for the difference, persist and refund their own cost", () => {
  const sim = new Simulation();
  const from = { x: 1, y: 1 }, to = { x: 4, y: 1 };
  sim.state.buildings.find(b=>b.kind==="warehouse").inventory.bricks=20;
  const initialMoney = sim.state.money;
  for (const [roadType, price, upgrades] of [["dirt", 24, 0], ["stone", 24, 4], ["brick", 48, 4]]) {
    const before = sim.snapshot();
    const preview = planRoad(sim, from, to, roadType);
    assert.equal(preview.cost, price);
    assert.equal(preview.upgrades.length, upgrades);
    assert.equal(execute(sim, { type: "roadStroke", from, to, roadType }).ok, true);
    assert.equal(sim.state.money, before.money - price);
    for (const p of roadStroke(from, to)) assert.equal(roadTypeAt(sim.state.roadTypes, p), roadType);
    for (const b of sim.state.buildings) {
      const previous = before.buildings.find((old) => old.id === b.id);
      const expected={...previous.inventory};if(b.kind==="warehouse"&&roadType==="brick")expected.bricks-=4;
      assert.deepEqual(b.inventory, expected);
      assert.equal(b.progress, previous.progress);
    }
    const loaded = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
    assert.deepEqual(loaded.state.roadTypes, sim.state.roadTypes);
  }
  assert.equal(sim.state.money, initialMoney - 4 * ROAD_TYPES.brick.cost);
  const before = sim.snapshot();
  for (const roadType of ["dirt", "stone", "brick"]) {
    assert.equal(execute(sim, { type: "roadStroke", from, to, roadType }).ok, false);
    assert.deepEqual(sim.snapshot(), before, "same or lower quality never charges or downgrades");
  }
  assert.equal(execute(sim, { type: "demolish", ...from }).ok, true);
  assert.equal(sim.state.money, before.money + ROAD_TYPES.brick.cost / 2);
  assert.ok(!Object.hasOwn(sim.state.roadTypes, key(from)));
  assert.doesNotThrow(() => parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(execute(sim, { type: "place", kind: "road", ...from }).ok, true);
  assert.equal(roadTypeAt(sim.state.roadTypes, from), "stone", "removed metadata cannot change a replacement road");
});

test("mixed upgrades and additions are atomic and bridge surfaces follow the chosen material", () => {
  const sim = new Simulation();
  const from = { x: 1, y: 1 }, to = { x: 5, y: 1 };
  sim.state.terrain = { "3,1": { kind: "water", height: 0 } };
  assert.equal(execute(sim, { type: "roadStroke", from, to: { x: 2, y: 1 }, roadType: "dirt" }).ok, true);
  sim.state.buildings.find(b=>b.kind==="warehouse").inventory.bricks=20;
  const plan = planRoad(sim, from, to, "brick");
  assert.equal(plan.cost, 2 * (24 - 6) + 2 * 24 + 75);
  assert.equal(plan.additions.length, 3);
  assert.equal(plan.upgrades.length, 2);
  assert.equal(plan.bridges, 1);
  sim.state.money = plan.cost - 1;
  const before = sim.snapshot();
  assert.equal(execute(sim, { type: "roadStroke", from, to, roadType: "brick" }).ok, false);
  assert.deepEqual(sim.snapshot(), before);
  sim.state.money++;
  assert.equal(execute(sim, { type: "roadStroke", from, to, roadType: "brick" }).ok, true);
  assert.equal(sim.state.money, 0);
  assert.equal(roadTypeAt(sim.state.roadTypes, { x: 3, y: 1 }), "brick");
  assert.equal(planRoad(sim, { x: 3, y: 1 }, { x: 3, y: 1 }, "brick").cost, 0);
});

test("legacy roads stay stone and malformed surface metadata or commands are rejected", () => {
  const sim = new Simulation();
  const legacy = sim.snapshot();
  delete legacy.roadTypes;
  const loaded = new Simulation(parseSave(JSON.stringify(legacy)));
  assert.deepEqual(loaded.state.roads, legacy.roads);
  assert.equal(loaded.state.money, legacy.money);
  for (const k of loaded.state.roads) {
    const [x, y] = k.split(",").map(Number);
    assert.equal(roadTypeAt(loaded.state.roadTypes, { x, y }), "stone");
  }
  for (const metadata of [null, [], { "1,1": "brick" }, { [legacy.roads[0]]: "highway" }, { [legacy.roads[0]]: "toString" }]) {
    assert.throws(() => parseSave(JSON.stringify({ ...legacy, roadTypes: metadata })), /road surfaces/);
  }
  const before = sim.snapshot();
  for (const roadType of ["highway", "toString", 3, {}]) {
    assert.equal(execute(sim, { type: "roadStroke", from: { x: 1, y: 1 }, to: { x: 3, y: 1 }, roadType }).ok, false);
    assert.deepEqual(sim.snapshot(), before);
  }
});

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
  assert.equal(t.count, 2, "two touches cancel a road draft before panning");
  assert.equal(t.move(2, { x: 250, y: 100 }).scale, 1.5);
  assert.equal(t.end(2), false);
  t.move(1, { x: 105, y: 100 });
  assert.equal(t.end(1), false);
  assert.equal(t.count, 0);
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

test("all building views share exact raised plot bounds and stone density", () => {
  let count = 0;
  for (const kind of Object.keys(BUILDINGS))
    for (const tier of kind === "house" ? [1, 2, 3] : [1])
      for (let rotation = 0; rotation < 4; rotation++) {
        const [w, h] = dimensions(kind, rotation),
          g = foundationGeometry(w, h);
        assert.equal(g.height, FOUNDATION_HEIGHT);
        assert.equal(g.columns / w, STONES_PER_TILE);
        assert.equal(g.rows / h, STONES_PER_TILE);
        const corners = g.base.map((p) => groundCoordinates(p.x, p.y));
        assert.deepEqual(corners, [
          { x: -0.5, y: -0.5 },
          { x: w - 0.5, y: -0.5 },
          { x: w - 0.5, y: h - 0.5 },
          { x: -0.5, y: h - 0.5 },
        ]);
        assert.ok(
          buildingArt(kind, rotation, tier).texture.startsWith(
            kind === "farm" ? "farm-" : kind === "market" ? "market-" : kind === "park" || kind === "garden" ? "park-" : "building-",
          ),
        );
        count++;
      }
  assert.equal(count, (Object.keys(BUILDINGS).length + 2) * 4);
});
test("rotating the plaza preserves objects, shapes and benches facing the fountain", () => {
  const reference = plazaLayout(0);
  for (let rotation = 0; rotation < 4; rotation++) {
    const objects = plazaLayout(rotation);
    assert.equal(objects.length, 8);
    assert.deepEqual(
      objects.map((p) => p.id).sort(),
      reference.map((p) => p.id).sort(),
    );
    assert.equal(objects.filter((p) => p.kind === "flowers").length, 2);
    for (const obj of objects) {
      const original = reference.find((p) => p.id === obj.id);
      assert.ok(
        Math.abs(
          Math.hypot(obj.x - 0.5, obj.y - 0.5) -
            Math.hypot(original.x - 0.5, original.y - 0.5),
        ) < 1e-10,
      );
      if (obj.kind === "bench") {
        assert.ok(obj.dx * (0.5 - obj.x) + obj.dy * (0.5 - obj.y) > 0);
        assert.ok(
          Math.abs(obj.dx * (0.5 - obj.y) - obj.dy * (0.5 - obj.x)) < 1e-10,
        );
      }
      if (obj.kind === "lamp")
        assert.ok(
          Math.abs((obj.x - obj.y) * 32) > 24,
          "lanterns must not align with the central spout in any view",
        );
    }
  }
  assert.deepEqual(plazaLayout(4), reference);
});
test("windmill rear sails sit behind the tower on their own far-side hubs", () => {
  const views = Array.from({ length: 4 }, (_, r) => rotorView(r));
  assert.equal(new Set(views.map((v) => JSON.stringify(v))).size, 4);
  assert.ok(views[0].depthOffset > 0 && views[1].depthOffset > 0);
  assert.ok(views[2].depthOffset < 0 && views[3].depthOffset < 0);
  assert.ok(
    buildingArt("mill", 2).mechanism[0] > buildingArt("mill", 0).mechanism[0],
  );
  assert.ok(
    buildingArt("mill", 3).mechanism[0] < buildingArt("mill", 1).mechanism[0],
  );
});

test("compact industry lots migrate inside the old footprint while keeping frontage, stock and work", () => {
  for (const kind of ["farm", "sawmill", "workshop", "warehouse"])
    for (let rotation = 0; rotation < 4; rotation++)
      for (const plot of [
        [3, 2],
        [2, 3],
      ]) {
        const save = new Simulation().snapshot();
        const warehouse = save.buildings.find((b) => b.kind === "warehouse");
        const building = {
          ...structuredClone(warehouse),
          id: 1000,
          kind,
          x: 8,
          y: 20,
          rotation,
          plot,
          inventory: { planks: 17, wood: 11 },
          progress: 0.37,
          produced: 14,
          construction: { required: 240, completed: 93 },
        };
        save.buildings =
          kind === "warehouse" ? [building] : [warehouse, building];
        save.decorations = [];
        save.residents = [];
        save.agents = [];
        const front = frontage(kind, 8, 20, rotation, plot);
        save.roadTypes={};save.roads = [key(front.at(-1))];
        const oldCells = new Set(
          footprint(kind, 8, 20, rotation, plot).map(key),
        );
        const restored = parseSave(JSON.stringify(save)),
          b = restored.buildings.find((b) => b.id === 1000);
        assert.deepEqual(b.plot, [2, 2]);
        assert.ok(
          footprint(kind, b.x, b.y, rotation, b.plot).every((p) =>
            oldCells.has(key(p)),
          ),
        );
        assert.ok(
          frontage(kind, b.x, b.y, rotation, b.plot).some((p) =>
            save.roads.includes(key(p)),
          ),
        );
        for (const field of [
          "inventory",
          "progress",
          "produced",
          "construction",
          "enabled",
          "id",
        ])
          assert.deepEqual(b[field], building[field]);
        assert.equal(restored.money, save.money);
        assert.doesNotThrow(() => parseSave(JSON.stringify(restored)));
      }
});

test("fountain squares accept roads on every edge regardless of rotation", () => {
  const expected = [
    "9,10",
    "9,11",
    "12,10",
    "12,11",
    "10,9",
    "11,9",
    "10,12",
    "11,12",
  ].sort();
  for (let rotation = 0; rotation < 4; rotation++) {
    assert.deepEqual(
      frontage("park", 10, 10, rotation).map(key).sort(),
      expected,
    );
  }
  const sim = new Simulation(),
    park = sim.state.buildings.find((b) => b.kind === "park");
  const roads = sim.adjacent(park).map(key).sort();
  assert.ok(roads.length > 0);
  for (let i = 0; i < 4; i++) {
    assert.equal(execute(sim, { type: "rotate", id: park.id }).ok, true);
    assert.equal(park.connected, true);
    assert.deepEqual(sim.adjacent(park).map(key).sort(), roads);
  }
});

test("expanded valley preserves every starter terrain tile and offers buildable deposits throughout", () => {
  assert.equal(SIZE, 64);
  for (let y = 0; y < 28; y++)
    for (let x = 0; x < 28; x++) {
      const original =
        x >= 23 + Math.floor(Math.sin(y * 0.37) * 1.6) || (y < 2 && x > 18)
          ? "water"
          : "land";
      assert.equal(baseTerrain(x, y), original, `${x},${y}`);
    }
  const sim = new Simulation();
  assert.equal(Object.keys(DEPOSITS).length, 28);
  for (const [k, kind] of Object.entries(DEPOSITS)) {
    assert.equal(sim.state.deposits[k], INITIAL_RESERVE);
    const [x, y] = k.split(",").map(Number);
    if (x < 28 && y < 28) continue;
    const building=kind==="stone"?"quarry":"mine";
    assert.ok(sim.canPlace(building,x,y),"the workplace belongs beside exposed rocks");
    assert.ok([{x:x-3,y},{x,y:y-3},{x:x+2,y},{x,y:y+2}].some(p=>sim.canPlace(building,p.x,p.y)===null),`accessible ${k}`);
  }
  assert.equal(sim.canPlace("house", 61, 61), null);
  assert.match(sim.canPlace("house", 63, 63), /footprint|valley/);
  assert.doesNotThrow(() => parseSave(JSON.stringify(sim.snapshot())));
});

test("old towns expand once without moving buildings, replacing cleared scenery or resetting consumption", () => {
  const current = new Simulation().snapshot();
  delete current.valleyVersion;
  delete current.depositDepths;
  current.decorations = current.decorations.filter((d) => d.x < 28 && d.y < 28);
  current.deposits = Object.fromEntries(
    Object.keys(DEPOSITS)
      .filter((k) => k.split(",").every((v) => Number(v) < 28))
      .map((k) => [k, 543]),
  );
  current.agents = [];
  const removed = current.decorations.pop();
  current.terrain = { "1,1": { kind: "land", height: 2 } };
  current.decorations = current.decorations.filter(
    (d) => d.x !== 1 || d.y !== 1,
  );
  const expanded = parseSave(JSON.stringify(current));
  assert.deepEqual(expanded.buildings, current.buildings);
  assert.deepEqual(expanded.roads, current.roads);
  assert.deepEqual(expanded.terrain, current.terrain);
  assert.deepEqual(
    expanded.decorations.filter((d) => d.x < 28 && d.y < 28),
    current.decorations,
  );
  assert.ok(!expanded.decorations.some((d) => d.id === removed.id));
  assert.equal(expanded.deposits["19,4"], INITIAL_RESERVE - 57);
  assert.equal(expanded.deposits["6,32"], INITIAL_RESERVE);
  expanded.deposits["19,4"] -= 30;
  const reloaded = parseSave(JSON.stringify(expanded));
  assert.deepEqual(reloaded.deposits, expanded.deposits);
  assert.deepEqual(reloaded.decorations, expanded.decorations);
});

test("an exhausted deposit supports repeated deeper layers with real builders and keeps its location and stock", () => {
  const sim = new Simulation(),
    b = sim.state.buildings.find((b) => b.kind === "quarry");
  const location = key(b),
    original = { id: b.id, x: b.x, y: b.y, rotation: b.rotation };
  sim.state.money = 100000;
  for (const w of sim.state.buildings.filter((b) => b.kind === "warehouse"))
    Object.assign(w.inventory, { planks: 1000, metal: 1000 });
  for (let depth = 0; depth < 4; depth++) {
    sim.state.deposits[location] = 0;
    b.inventory.stone = 7;
    b.progress = 2;
    const next = deeperLayer(depth),
      beforeGold = sim.state.money;
    const result = execute(sim, { type: "deepen", id: b.id });
    assert.equal(result.ok, true, result.message);
    assert.equal(sim.state.money, beforeGold - next.cost);
    assert.equal(b.construction.deeperTo, depth + 1);
    assert.equal(
      sim.state.deposits[location],
      0,
      "reserve only unlocked after labour",
    );
    assert.equal(b.inventory.stone, 7);
    assert.equal(b.progress, 2);
    assert.ok(
      sim.canMove(b.id, 6, 32),
      "an excavation cannot move to another deposit",
    );
    const saved = parseSave(JSON.stringify(sim.snapshot()));
    assert.equal(
      saved.buildings.find((c) => c.id === b.id).construction.deeperTo,
      depth + 1,
    );
    finishConstruction(sim, b);
    assert.equal(sim.state.depositDepths[location], depth + 1);
    assert.equal(sim.state.deposits[location], next.reserve);
    for (const [field, value] of Object.entries(original))
      assert.equal(b[field], value);
  }
  const depth = sim.state.depositDepths[location],
    reserve = sim.state.deposits[location];
  assert.equal(execute(sim, { type: "move", id: b.id, x: 6, y: 29 }).ok, true);
  assert.equal(
    sim.state.depositDepths[location],
    depth,
    "depth stays with deposit, not building",
  );
  assert.equal(sim.state.deposits[location], reserve);
  assert.equal(sim.state.depositDepths["6,32"] ?? 0, 0);
});

test("unaffordable and duplicate excavation commands are atomic; malformed depths are rejected", () => {
  const sim = new Simulation(),
    b = sim.state.buildings.find((b) => b.kind === "mine");
  sim.state.money = 0;
  const before = sim.snapshot();
  assert.equal(execute(sim, { type: "deepen", id: b.id }).ok, false);
  assert.deepEqual(sim.snapshot(), before);
  sim.state.money = 100000;
  for (const w of sim.state.buildings.filter((b) => b.kind === "warehouse"))
    Object.assign(w.inventory, { planks: 1000, metal: 1000 });
  const command = {
    id: "excavate-once",
    actorId: "test",
    expectedRevision: sim.state.revision,
    command: { type: "deepen", id: b.id },
  };
  assert.equal(sim.execute(command).ok, true);
  const gold = sim.state.money;
  assert.equal(sim.execute(command).ok, true);
  assert.equal(sim.state.money, gold);
  assert.equal(execute(sim, { type: "deepen", id: b.id }).ok, false);
  for (const depth of [-1, 0.5, "1", Infinity]) {
    const bad = sim.snapshot();
    bad.depositDepths[key(b)] = depth;
    assert.throws(() => parseSave(JSON.stringify(bad)), /depth/);
  }
  const bad = sim.snapshot();
  bad.buildings.find((c) => c.id === b.id).construction.deeperTo = 8;
  assert.throws(() => parseSave(JSON.stringify(bad)), /building/);
});

test("daylight is continuous, repeats daily and night production slows without changing inventory", () => {
  assert.equal(daylight(0).hour, 8);
  assert.deepEqual(daylight(240 * 4), { ...daylight(0), day: 2 });
  assert.equal(daylight(150 * 4).night, true);
  assert.equal(daylight(150 * 4).workRate, 0.25);
  for (let tick = 0; tick < DAY_TICKS; tick += 0.25)
    assert.ok(
      Math.abs(daylight(tick).light - daylight(tick + 0.25).light) < 0.03,
    );
  const sim = new Simulation(),
    b = sim.state.buildings.find((b) => b.kind === "mill");
  b.progress = 0;
  b.inventory.grain = 3;
  sim.state.tick = 0;
  sim.step();
  assert.equal(b.progress, STEP);
  sim.state.tick = 600;
  sim.step();
  assert.equal(b.progress, STEP * 1.25);
  assert.equal(b.inventory.grain, 3);
  assert.equal(warmEmission(40, 85, 60, 255), 0, "green roof stays dark");
  assert.equal(warmEmission(180, 180, 170, 255), 0, "stone stays dark");
  assert.ok(warmEmission(255, 200, 50, 255) > 0.5, "warm window emits");
});

test("night keeps most residents at home while journeys already in progress continue", () => {
  const sim = new Simulation();
  const person = sim.state.agents.find(
    (a) => a.kind === "person" && a.resident % 4 !== 0,
  );
  person.active = false;
  person.wait = 0;
  sim.state.tick = 600;
  sim.step();
  assert.ok(person.wait > 0);
  assert.equal(person.segment, 0);
  sim.state.tick = 0;
  for (let i = 0; i < 20; i++) sim.step();
  assert.ok(
    person.segment + person.progress > 0,
    "resident leaves again in daylight",
  );
});

test("leisure coverage follows roads, capacity and reach rather than straight-line proximity", () => {
  const sim = new Simulation(),
    park = sim.state.buildings.find((b) => b.kind === "park");
  const first = serviceCoverage(sim, park);
  assert.ok(first.residents > 0 && first.residents <= 12);
  assert.ok(
    first.homes.every(
      (h) => h.tiles <= 10 && h.seconds === h.tiles / AGENT_SPEED.person,
    ),
  );
  park.level = 3;
  const upgraded = serviceCoverage(sim, park);
  assert.ok(upgraded.residents >= first.residents);
  assert.equal(upgraded.range, first.range);
  const old = sim.route.bind(sim);
  sim.route = (a, b) =>
    b.kind === "house"
      ? Array.from({ length: 30 }, (_, x) => ({ x, y: 0 }))
      : old(a, b);
  assert.equal(
    serviceCoverage(sim, park).residents,
    0,
    "nearby walls do not overcome a long road detour",
  );
  sim.route = () => null;
  assert.equal(serviceCoverage(sim, park).connected, false);
  assert.equal(serviceOpen("tavern", 19), true);
  assert.equal(serviceOpen("tavern", 1), true);
  assert.equal(serviceOpen("tavern", 10), false);
});

test("tavern visits improve leisure only on arrival during opening hours", () => {
  const sim = new Simulation();
  const tavern = sim.state.buildings.find((b) => b.kind === "park");
  tavern.kind = "tavern";
  tavern.rotation = [0, 1, 2, 3].find((r) =>
    frontage(tavern.kind, tavern.x, tavern.y, r, tavern.plot).some((p) =>
      sim.roads.has(key(p)),
    ),
  );
  sim.state.tick = 400;
  for (const r of sim.state.residents) r.leisure = 0;
  sim.reconnect();
  assert.equal(tavern.workers, 2);
  const guest = sim.state.agents.find(
    (a) =>
      a.target === tavern.id &&
      sim.state.residents.find((r) => r.id === a.resident).job !== tavern.id,
  );
  assert.ok(guest, "a covered home sends an evening guest");
  const r = sim.state.residents.find((r) => r.id === guest.resident);
  sim.step();
  assert.equal(r.leisure, 0, "coverage alone does not grant leisure");
  guest.segment = guest.path.length - 2;
  guest.progress = 1;
  guest.wait = 0;
  guest.active = true;
  sim.step();
  assert.equal(r.leisure, 45, "visit completed at the tavern");
  assert.equal(guest.returning, true);
  const saved = parseSave(JSON.stringify(sim.snapshot()));
  assert.equal(saved.residents.find((p) => p.id === r.id).leisure, 45);
});

test("industry and leisure upgrades take builders, persist and improve capacity without changing plots", () => {
  for (const kind of ["farm", "tavern", "warehouse"]) {
    const sim = new Simulation();
    const b = sim.state.buildings.find(
      (b) => b.kind === (kind === "tavern" ? "park" : kind),
    );
    b.kind = kind;
    b.rotation = [0, 1, 2, 3].find((r) =>
      frontage(b.kind, b.x, b.y, r, b.plot).some((p) => sim.roads.has(key(p))),
    );
    sim.reconnect();
    sim.state.money = 100000;
    for (const w of sim.state.buildings.filter((b) => b.kind === "warehouse"))
      Object.assign(w.inventory, { planks: 1000, stone: 1000, metal: 1000 });
    const before = {
      id: b.id,
      x: b.x,
      y: b.y,
      rotation: b.rotation,
      plot: b.plot,
    };
    const inventory = structuredClone(b.inventory),
      next = nextUpgrade(b);
    assert.equal(execute(sim, { type: "upgrade", id: b.id }).ok, true);
    assert.equal(b.construction.upgradeLevel, 2);
    assert.equal(b.construction.required, next.labour);
    if (kind !== "warehouse") assert.deepEqual(b.inventory, inventory);
    const saved = parseSave(JSON.stringify(sim.snapshot()));
    assert.equal(
      saved.buildings.find((c) => c.id === b.id).construction.upgradeLevel,
      2,
    );
    if (kind === "warehouse")
      assert.ok(
        sim.state.buildings
          .filter((b) => b.kind === "house")
          .every((b) => b.connected),
        "warehouse road network stays open during upgrades",
      );
    finishConstruction(sim, b);
    assert.equal(b.level, 2);
    for (const [k, v] of Object.entries(before)) assert.deepEqual(b[k], v);
    assert.equal(outputCapacity(b), 40);
    assert.equal(productionRate(b), 1.35);
    assert.equal(
      parseSave(JSON.stringify(sim.snapshot())).buildings.find(
        (c) => c.id === b.id,
      ).level,
      2,
    );
  }
});

test("workers choose nearby jobs and do not commute across the entire expanded map", () => {
  const sim = new Simulation();
  const far = {
    ...sim.state.buildings.find((b) => b.kind === "farm"),
    id: sim.state.nextId++,
    x: 58,
    y: 53,
    rotation: 0,
  };
  sim.state.buildings.push(far);
  for (let y = 3; y <= 55; y++) sim.state.roads.push(`6,${y}`);
  for (let x = 6; x <= 60; x++) sim.state.roads.push(`${x},55`);
  sim.state.roads = [...new Set(sim.state.roads)];
  sim.reconnect();
  assert.equal(far.connected, true);
  assert.equal(far.workers, 0, "remote workplace needs nearby homes");
  for (const r of sim.state.residents.filter((r) => r.job))
    assert.ok(
      sim.route(sim.building(r.home), sim.building(r.job)).length - 1 <=
        MAX_COMMUTE,
    );
});

test("upgrade help explains warehouse shortfalls without recommending duplicate suppliers or ignoring deliveries", () => {
  const sim = new Simulation();
  const warehouse = sim.state.buildings.find((b) => b.kind === "warehouse");
  const sawmill = sim.state.buildings.find((b) => b.kind === "sawmill");
  for (const b of sim.state.buildings.filter((b) => b.kind === "warehouse"))
    b.inventory.planks = 0;
  sawmill.inventory.planks = 30;
  let help = materialGuidance(sim, 180, { planks: 16 });
  assert.match(help.join(" "), /Need 16 more planks \(0 of 16 in warehouses\)/);
  assert.match(help.join(" "), /Check the sawmill/);
  assert.doesNotMatch(help.join(" "), /Build and connect/);
  sim.state.agents.push({
    id: 9999,
    kind: "truck",
    source: sawmill.id,
    target: warehouse.id,
    cargo: "planks",
    amount: 16,
    resident: null,
    path: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    segment: 0,
    progress: 0,
    wait: 0,
    returning: false,
  });
  help = materialGuidance(sim, 180, { planks: 16 });
  assert.match(help.join(" "), /already on the way/);
  warehouse.inventory.planks = 16;
  assert.deepEqual(materialGuidance(sim, 180, { planks: 16 }), []);
  sim.state.money = 140;
  assert.match(
    materialGuidance(sim, 180, { planks: 16 }).join(" "),
    /Earn 40 more gold/,
  );
});


test("road lamps share a tile on separate curbs, survive saving, and remove independently",async()=>{
  const {roadEdges,lampPoint}=await import("../.test-dist/streetlights.js");
  const sim=new Simulation();
  const p=sim.state.roads.map(k=>{const[x,y]=k.split(',').map(Number);return{x,y};}).find(p=>roadEdges(sim.roads,p).length===2);
  const edges=roadEdges(sim.roads,p),money=sim.state.money;
  for(const rotation of edges)assert.equal(execute(sim,{type:"place",kind:"streetlight",...p,rotation}).ok,true);
  const lamps=sim.state.decorations.filter(d=>d.edge!==undefined&&key(d)===key(p));
  assert.equal(lamps.length,2);assert.equal(sim.state.money,money-40);
  assert.equal(execute(sim,{type:"place",kind:"streetlight",...p,rotation:edges[0]}).ok,false);
  assert.equal(lampPoint(lamps[0]).x===lampPoint(lamps[1]).x&&lampPoint(lamps[0]).y===lampPoint(lamps[1]).y,false);
  assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
  assert.equal(execute(sim,{type:"removeDecoration",id:lamps[1].id}).ok,true);
  assert.ok(sim.roads.has(key(p)));assert.ok(sim.state.decorations.some(d=>d.id===lamps[0].id));
});
test("road widening moves lamps onto free curbs and clears posts trapped inside intersections",async()=>{
  const {reconcileRoadLamps}=await import("../.test-dist/streetlights.js");
  const lamps=[{id:1,kind:"streetlight",x:3,y:3,natural:false,edge:0},{id:2,kind:"streetlight",x:3,y:3,natural:false,edge:2}];
  let kept=reconcileRoadLamps(lamps,new Set(['3,3','4,3','3,4','3,2']));
  assert.equal(kept.length,1);assert.equal(kept[0].edge,2);
  assert.equal(reconcileRoadLamps(kept,new Set(['3,3','4,3','3,4','3,2','2,3'])).length,0);
});


test("pavements keep pedestrian access, block freight and save as footbridges",()=>{
  const sim=new Simulation(),depot=sim.state.buildings.find(b=>b.kind==="warehouse"),mill=sim.state.buildings.find(b=>b.kind==="sawmill");
  sim.state.roadTypes=Object.fromEntries(sim.state.roads.map(k=>[k,"pavement"]));sim.reconnect(true);
  assert.ok(sim.route(mill,depot,"person"));assert.equal(sim.route(mill,depot,"truck"),null);assert.equal(sim.route(mill,depot,"car"),null);
  assert.equal(sim.alert(mill).title,"No delivery road");
  const cargo=sim.state.agents.filter(a=>a.kind==="truck");assert.equal(cargo.length,0);
  advance(sim,15);assert.ok(sim.state.agents.length);assert.ok(sim.state.agents.every(a=>a.kind==="person"));
  assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
  const p=sim.adjacent(mill)[0];assert.equal(execute(sim,{type:"roadStroke",from:p,to:p,roadType:"stone"}).ok,true);
  assert.equal(roadTypeAt(sim.state.roadTypes,p),"stone");
});
test("cars take a longer vehicle route while pedestrians can use a pavement shortcut",()=>{
  const sim=new Simulation();sim.state.roads=['1,1','2,1','3,1','1,2','2,2','3,2'];sim.state.roadTypes={'2,1':'pavement'};sim.reconnect();
  assert.equal(sim.path({x:1,y:1},{x:3,y:1},"person").length,3);
  const route=sim.path({x:1,y:1},{x:3,y:1},"car");assert.equal(route.length,5);assert.ok(route.every(p=>key(p)!=='2,1'));
});


test("edge fences leave tiles usable, reject duplicate opposite sides and share corner posts",async()=>{
 const {fenceKey,fencePostMask,fenceEdgeSet,crossesFence}=await import('../.test-dist/fences.js');
 const sim=new Simulation();sim.state.decorations=sim.state.decorations.filter(d=>!(d.x>=1&&d.x<=4&&d.y>=1&&d.y<=4));
 assert.equal(execute(sim,{type:'place',kind:'fence',x:2,y:2,rotation:0}).ok,true);
 assert.equal(execute(sim,{type:'place',kind:'fence',x:2,y:2,rotation:1}).ok,true);
 assert.equal(execute(sim,{type:'place',kind:'fence',x:3,y:2,rotation:2}).ok,false);
 assert.equal(execute(sim,{type:'place',kind:'planter',x:2,y:2}).ok,true);
 const fences=sim.state.decorations.filter(d=>d.kind==='fence'&&d.x===2&&d.y===2);assert.equal(fences.length,2);
 assert.equal(fenceKey(fences[0],0),fenceKey({x:3,y:2},2));
 assert.equal(fences.reduce((n,d)=>n+(fencePostMask(d,fences)&1?1:0)+(fencePostMask(d,fences)&2?1:0),0),3);
 assert.equal(crossesFence({x:2,y:2},{x:3,y:2},fenceEdgeSet(fences)),true);
 assert.equal(crossesFence({x:2,y:2},{x:1,y:2},fenceEdgeSet(fences)),false);
 assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
 assert.equal(execute(sim,{type:'removeDecoration',id:fences[0].id}).ok,true);
 assert.ok(sim.state.decorations.some(d=>d.kind==='planter'&&d.x===2&&d.y===2));
});


test("both sides of the same fence edge have identical artwork anchors and front fences clear the building depth",async()=>{
 const {canonicalFence,fenceCenter}=await import('../.test-dist/fences.js');
 assert.deepEqual(canonicalFence({x:3,y:2,side:2}),canonicalFence({x:2,y:2,side:0}));
 assert.deepEqual(canonicalFence({x:2,y:3,side:3}),canonicalFence({x:2,y:2,side:1}));
 const plot={x:0,y:0,width:2,height:2,depth:76,left:-100,right:100,top:-200,bottom:100},bounds={left:-40,right:40,top:-40,bottom:40};
 assert.ok(travellerDepth(fenceCenter({x:1,y:0,side:0}),bounds,[plot])>plot.depth);
 assert.ok(travellerDepth(fenceCenter({x:0,y:0,side:2}),bounds,[plot])<plot.depth);
});


test("park visitors remain visible only during actual visits and alternate strolling with fountain watching",async()=>{
 const {parkVisitor,parkVisitDuration}=await import('../.test-dist/park-visitors.js');
 const sim=new Simulation(),park=sim.state.buildings.find(b=>b.kind==='park'),a={id:2,resident:1,parkSlot:0,returning:true,active:false,wait:parkVisitDuration(2)};
 const walking=parkVisitor(a,park);assert.ok(walking.walking);assert.ok(walking.x>=park.x-.5&&walking.x<=park.x+1.5);
 const watching=parkVisitor({...a,wait:a.wait-7},park);assert.equal(watching.walking,false);
 assert.equal(parkVisitor({...a,wait:0},park),null);assert.equal(parkVisitor({...a,returning:false},park),null);
 assert.equal(parkVisitor(a,{...park,construction:{required:10,completed:1}}),null);
});


test("a fence between staggered buildings stays behind the nearer wall even with conflicting whole-sprite depths",()=>{
 const bounds={left:-60,right:60,top:-80,bottom:80},base={width:2,height:2,depth:76,left:-100,right:100,top:-200,bottom:100};
 const plots=[{...base,x:0,y:0},{...base,x:2,y:-2}];
 const point={x:1.5,y:-1};
 assert.ok(travellerDepth(point,bounds,plots,true)<76);
});


test("brick roads and bridges consume warehouse bricks atomically and timber bridges upgrade in place",()=>{
 const sim=new Simulation(),w=sim.state.buildings.find(b=>b.kind==='warehouse');sim.state.terrain={'2,1':{kind:'water',height:0}};
 const command={type:'roadStroke',from:{x:1,y:1},to:{x:3,y:1},roadType:'brick'};
 const before=sim.snapshot();assert.equal(execute(sim,command).ok,false);assert.deepEqual(sim.snapshot(),before);
 w.inventory.bricks=12;const money=sim.state.money;assert.equal(execute(sim,command,'brick-stretch').ok,true);
 assert.equal(w.inventory.bricks,6);assert.equal(sim.state.money,money-123);assert.equal(roadTypeAt(sim.state.roadTypes,{x:2,y:1}),'brick');
 const after=sim.snapshot();execute(sim,command,'brick-stretch');assert.deepEqual(sim.snapshot(),after);assert.doesNotThrow(()=>parseSave(JSON.stringify(after)));
 const old=sim.snapshot();delete old.bridgeVersion;delete old.roadTypes;
 const restored=new Simulation(parseSave(JSON.stringify(old)));assert.equal(roadTypeAt(restored.state.roadTypes,{x:2,y:1}),'dirt');
 const cost=restored.state.money;assert.equal(execute(restored,{type:'roadStroke',from:{x:2,y:1},to:{x:2,y:1},roadType:'stone'}).ok,true);assert.equal(restored.state.money,cost-20);assert.equal(roadTypeAt(restored.state.roadTypes,{x:2,y:1}),'stone');
});
test("a small fountain admits at most four simultaneous visitors with unique places",()=>{
 const sim=new Simulation(),park=sim.state.buildings.find(b=>b.kind==='park');
 for(const a of sim.state.agents.filter(a=>a.resident!==null)){
  const home=sim.building(a.source),path=sim.route(home,park);if(!path)continue;
  a.kind='person';a.target=park.id;a.path=path;a.segment=path.length-1;a.progress=0;a.returning=false;a.wait=0;a.active=true;a.move=1;
 }
 sim.step();
 const visitors=sim.state.agents.filter(a=>a.target===park.id&&a.parkSlot!==undefined&&a.returning&&a.wait>0);
 assert.equal(visitors.length,4);assert.equal(new Set(visitors.map(a=>a.parkSlot)).size,4);
});

test("little cottages use one tile, retain residents during upgrades and restore capacity",()=>{
 const sim=new Simulation(),old=sim.state.buildings.find(b=>b.kind==='house'&&b.connected);
 const p=frontage(old.kind,old.x,old.y,old.rotation)[0];
 const x=p.x,y=p.y-1;
 assert.equal(execute(sim,{type:'demolish',x:old.x,y:old.y}).ok,true);
 assert.equal(execute(sim,{type:'place',kind:'cottage',x,y,rotation:0}).ok,true);
 const b=sim.buildingAt(x,y);assert.equal(footprint('cottage',x,y).length,1);
 assert.equal(houseCapacity(b),2);assert.equal(sim.state.residents.filter(r=>r.home===b.id).length,0);
 finishConstruction(sim,b);assert.equal(sim.state.residents.filter(r=>r.home===b.id).length,2);
 const ids=sim.state.residents.filter(r=>r.home===b.id).map(r=>r.id);
 assert.equal(execute(sim,{type:'upgrade',id:b.id}).ok,true);
 assert.deepEqual(sim.state.residents.filter(r=>r.home===b.id).map(r=>r.id),ids);
 const loaded=new Simulation(parseSave(JSON.stringify(sim.snapshot()))),home=loaded.building(b.id);
 assert.deepEqual(loaded.state.residents.filter(r=>r.home===b.id).map(r=>r.id),ids);
 finishConstruction(loaded,home);assert.equal(home.level,2);assert.equal(houseCapacity(home),3);
 assert.equal(loaded.state.residents.filter(r=>r.home===b.id).length,3);
 assert.equal(townNeeds(loaded).find(n=>n.id==='homes').have,loaded.state.buildings.filter(b=>b.connected&&(!b.construction||b.construction.upgradeTo||b.construction.upgradeLevel)).reduce((n,b)=>n+houseCapacity(b),0));
 for(let r=0;r<4;r++)assert.deepEqual(dimensions('cottage',r),[1,1]);
});

test("bridge lamps follow ramps and mount on masonry coping on both curbs",async()=>{
 const {lampPlacement}=await import('../.test-dist/streetlights.js');
 const sim=new Simulation();sim.state.buildings=[];sim.state.terrain=Object.fromEntries(['1,1','2,1','3,1','1,2','1,3'].map(k=>[k,{kind:'water',height:0}]));
 for(const reverse of [false,true])for(const kind of ['dirt','stone','brick']){
   const points=Array.from({length:5},(_,i)=>reverse?{x:1,y:i}:{x:i,y:1});
   sim.state.roads=points.map(key);sim.state.roadTypes=Object.fromEntries(points.map(p=>[key(p),kind]));sim.reconnect();
   for(const tile of points.slice(1,4))for(const edge of reverse?[0,2]:[1,3]){
     const p=lampPlacement(sim,{...tile,edge}),height=roadHeight(sim.roads,p.point.x,p.point.y,[],sim.state.terrain);
     assert.equal(p.elevation,height+(kind==='dirt'?0:9));
     assert.equal(p.screen.y,(p.point.x+p.point.y)*16-p.elevation);
     assert.equal(p.bridge,true);
   }
 }
});

function serviceTown(){
 const seed=new Simulation().snapshot(),template=seed.buildings.find(b=>b.kind==='house');
 seed.buildings=[['warehouse',0,3],['house',3,3],['house',5,3],['house',7,3],['house',9,3],['church',12,2],['garden',17,1]].map(([kind,x,y],i)=>({...template,id:100+i,kind,x,y,rotation:0,plot:dimensions(kind),houseTier:kind==='house'?1:undefined,inventory:kind==='warehouse'?{wood:1000,stone:1000,planks:1000,metal:1000,bread:1000}:{},construction:undefined}));
 seed.terrain=Object.fromEntries(Array.from({length:23*7},(_,i)=>[key({x:i%23,y:Math.floor(i/23)}),{kind:'land',height:0}]));seed.roads=Array.from({length:22},(_,x)=>key({x,y:5}));seed.roadTypes={};seed.agents=[];seed.residents=[];seed.decorations=[];seed.nextId=10000;seed.money=10000;
 return new Simulation(seed);
}
test("religion requires a staffed nearby church and improves on actual arrival",()=>{
 const sim=serviceTown(),church=sim.state.buildings.find(b=>b.kind==='church');
 assert.equal(church.workers,2);assert.equal(church.connected,true);
 assert.equal(townNeeds(sim).find(n=>n.id==='religion').have,12);
 for(const r of sim.state.residents){r.faith=10;r.leisure=95;}
 sim.step();assert.ok(sim.state.residents.every(r=>r.faith<=10),'coverage alone does not satisfy religion');
 advance(sim,32);assert.ok(sim.state.residents.some(r=>r.faith>50),'visitors reach the church');
 assert.equal(serviceOpen('church',7),false);assert.equal(serviceOpen('church',8),true);assert.equal(serviceOpen('church',20),false);
 assert.equal(execute(sim,{type:'toggle',id:church.id}).ok,true);
 for(const r of sim.state.residents)r.faith=10;
 advance(sim,12);assert.ok(sim.state.residents.every(r=>r.faith<=10));
 assert.equal(townNeeds(sim).find(n=>n.id==='religion').have,0);
 assert.equal(sim.alert(church).kind,'paused');
 const restored=new Simulation(parseSave(JSON.stringify(sim.snapshot())));
 assert.deepEqual(restored.state.residents.map(r=>r.faith),sim.state.residents.map(r=>r.faith));
 assert.equal(buildingNeeds(restored,restored.building(101)).find(n=>n.label==='Religion').ok,false);
});
test("church rotation keeps a six-tile plot and the large park admits eight spaced visitors",async()=>{
 const {parkVisitor,parkVisitorLimit}=await import('../.test-dist/park-visitors.js');
 for(let r=0;r<4;r++){assert.equal(footprint('church',10,10,r).length,6);assert.deepEqual([...dimensions('church',r)].sort(),[2,3]);assert.equal(footprint('garden',10,10,r).length,16);assert.equal(frontage('garden',10,10,r).length,16);assert.equal(plazaLayout(r,4).filter(p=>p.kind==='bench').length,4);}
 const sim=serviceTown(),park=sim.state.buildings.find(b=>b.kind==='garden');
 assert.equal(parkVisitorLimit(park),8);assert.equal(serviceCoverage(sim,park).capacity,40);assert.equal(serviceCoverage(sim,park).range,18);
 for(const a of sim.state.agents.filter(a=>a.resident!==null)){
  const path=sim.route(sim.building(a.source),park);if(!path)continue;
  Object.assign(a,{kind:'person',target:park.id,path,segment:path.length-1,progress:0,returning:false,wait:0,active:true,move:1});
 }
 sim.step();const visitors=sim.state.agents.filter(a=>a.target===park.id&&a.parkSlot!==undefined&&a.returning&&a.wait>0);
 assert.equal(visitors.length,8);assert.equal(new Set(visitors.map(a=>a.parkSlot)).size,8);
 for(const a of visitors){const p=parkVisitor(a,park);assert.ok(p.x>=park.x-.5&&p.x<=park.x+3.5&&p.y>=park.y-.5&&p.y<=park.y+3.5);}
 assert.equal(townNeeds(sim).find(n=>n.id==='parks').have,12);
 const saved=parseSave(JSON.stringify(sim.snapshot()));assert.deepEqual(saved.buildings.find(b=>b.kind==='garden').plot,[4,4]);
});

test("mixed-size buildings sort cottages in front of the entire near edge, independent of insertion order",async()=>{
 const {buildingDepths}=await import('../.test-dist/rendering.js');
 const plot=(id,x,y,width,height)=>({id,x,y,width,height,depth:(x+y+width+height-2)*32+12,left:-500,right:500,top:-500,bottom:500});
 for(const size of [2,4])for(const axis of ['x','y']){
  const back=plot(1,4,4,size,size),front=plot(2,axis==='x'?4+size:4,axis==='y'?4+size:4,1,1),further=plot(3,front.x+(axis==='x'?1:0),front.y+(axis==='y'?1:0),1,1);
  for(const order of [[back,front,further],[further,front,back]]){const depths=buildingDepths(order);assert.ok(depths.get(2)>depths.get(1));assert.ok(depths.get(3)>depths.get(2));}
 }
 const unrelated=[plot(1,0,0,2,2),plot(2,6,0,1,1)];unrelated[1].left=600;unrelated[1].right=900;
 assert.deepEqual([...buildingDepths(unrelated).values()],unrelated.map(p=>p.depth));
});


test('weather transitions are deterministic, continuous, and bounded across save ticks', async()=>{
  const {weather,rainStrokes,smokePuffs}=await import('../.test-dist/weather.js');
  const kinds=new Set();
  for(let tick=0;tick<6000;tick++){
    const w=weather(tick);kinds.add(w.kind);
    for(const field of ['cloud','rain','mist']){assert.ok(w[field]>=0&&w[field]<=1);assert.ok(Math.abs(w[field]-weather(tick+.01)[field])<.001);}
  }
  assert.equal(kinds.size,4);
  assert.deepEqual(weather(1240),weather(JSON.parse('1240')));
  assert.equal(rainStrokes(10000,10000,2,1).length,180);
  assert.equal(rainStrokes(1200,800,2,0).length,0);
  assert.deepEqual(smokePuffs(20,3,true,1),smokePuffs(20,3,true,1));
  assert.notDeepEqual(smokePuffs(20,3,true,1),smokePuffs(21,3,true,1));
});

test('income records real earnings separately from refunds and expires after a game day', async()=>{
 const {incomeSummary}=await import('../.test-dist/economy.js');const sim=new Simulation(),start=sim.state.money;
 sim.earn(30,'tax');sim.earn(70,'exports');sim.state.money+=20;
 assert.equal(sim.state.money,start+120);assert.deepEqual(incomeSummary(sim.state.tick,sim.state.income),{tax:30,exports:70,market:0,total:100});
 assert.deepEqual(incomeSummary(sim.state.tick,parseSave(JSON.stringify(sim.state)).income),incomeSummary(sim.state.tick,sim.state.income));
 assert.equal(incomeSummary(sim.state.tick+960,sim.state.income).total,0);
});
test('rain and mist retain their world coordinates when the camera pans',async()=>{
 const {worldRain,mistPatch}=await import('../.test-dist/weather.js');const a=worldRain({x:-100,y:200,width:400,height:300},20,1),b=worldRain({x:0,y:200,width:400,height:300},20,1);
 const shared=a.filter(p=>p.x>60&&p.x<240);assert.ok(shared.length>0);
 for(const p of shared)assert.ok(b.some(q=>q.x===p.x&&q.y===p.y));
 assert.deepEqual(mistPatch(5,20),mistPatch(5,20));
});

test('pedestrians remain on the correct side of fences and bridge rails along the whole span',async()=>{
 const {edgeDepth}=await import('../.test-dist/edge-occlusion.js');
 const bounds={left:-100,right:100,top:-100,bottom:100};
 for(const axis of ['x','y'])for(const along of [-.45,-.2,.2,.45]){
  const edge={a:axis==='x'?{x:.5,y:-.5}:{x:-.5,y:.5},b:{x:.5,y:.5},depth:32,...bounds};
  const near=axis==='x'?{x:.7,y:along}:{x:along,y:.7},far=axis==='x'?{x:.3,y:along}:{x:along,y:.3};
  assert.ok(edgeDepth(near,bounds,(near.x+near.y)*32+16,[edge])>32);
  assert.ok(edgeDepth(far,bounds,(far.x+far.y)*32+16,[edge])<32);
 }
 const distant={a:{x:9,y:9},b:{x:10,y:9},depth:600,left:1000,right:1100,top:900,bottom:1000};
 assert.equal(edgeDepth({x:0,y:0},bounds,16,[distant]),16);
});

test('demolishing a workshop preserves builders already working on other sites, including at night',()=>{
 const sim=new Simulation();sim.state.money=100000;for(const w of sim.state.buildings.filter(b=>b.kind==='warehouse'))Object.assign(w.inventory,{wood:1000,planks:1000,stone:1000,metal:1000});
 const command=c=>{const r=sim.execute({id:'demolition-'+sim.state.revision,actorId:'test',expectedRevision:sim.state.revision,command:c});assert.equal(r.ok,true,r.message);};
 for(const b of sim.state.buildings.filter(b=>b.kind==='house').slice(0,4))command({type:'upgrade',id:b.id});
 for(let i=0;i<400;i++)sim.step();
 const crews=sim.state.agents.filter(a=>a.onsite&&sim.building(a.onsite)?.construction).map(a=>({id:a.id,site:a.onsite,resident:a.resident}));assert.ok(crews.length>=4);
 sim.state.tick=600;const works=sim.state.buildings.find(b=>b.kind==='workshop');command({type:'demolish',x:works.x,y:works.y});
 for(const crew of crews){const a=sim.state.agents.find(a=>a.id===crew.id);assert.equal(a?.onsite,crew.site);assert.equal(sim.state.residents.find(r=>r.id===crew.resident)?.job,crew.site);}
 const site=sim.building(crews[0].site),work=site.construction.completed;sim.step();assert.ok(site.construction.completed>work);
 const loaded=new Simulation(parseSave(JSON.stringify(sim.state)));assert.equal(loaded.state.agents.filter(a=>a.onsite&&loaded.building(a.onsite)?.construction).length,sim.state.agents.filter(a=>a.onsite&&sim.building(a.onsite)?.construction).length);
});

test('the last finished warehouse is protected while its replacement is under construction',()=>{
 const sim=new Simulation(),working=sim.state.buildings.find(b=>b.kind==='warehouse');
 const replacement={...structuredClone(working),id:sim.state.nextId++,x:23,y:11,inventory:{},construction:{required:240,completed:20}};
 sim.state.buildings.push(replacement);sim.reconnect(true);
 for(const command of [{type:'demolish',x:working.x,y:working.y},{type:'removeStroke',from:{x:working.x,y:working.y},to:{x:working.x,y:working.y}}]){
  const before=sim.snapshot(),result=sim.execute({id:'warehouse-guard',actorId:'test',expectedRevision:sim.state.revision,command});
  assert.equal(result.ok,false);assert.match(result.message,/finished warehouse/i);assert.deepEqual(sim.snapshot(),before);
 }
 delete replacement.construction;sim.reconnect(true);
 const result=sim.execute({id:'replacement-ready',actorId:'test',expectedRevision:sim.state.revision,command:{type:'demolish',x:working.x,y:working.y}});
 assert.equal(result.ok,true,result.message);
});

test('a stranded save opens one replacement warehouse and resumes people and construction without losing stock',()=>{
 const sim=new Simulation(),warehouse=sim.state.buildings.find(b=>b.kind==='warehouse');
 warehouse.construction={required:240,completed:36};
 const home=sim.state.buildings.find(b=>b.kind==='house');home.construction={required:300,completed:20,upgradeTo:2};
 sim.reconnect();assert.equal(sim.state.agents.length,0);
 const inventory=structuredClone(warehouse.inventory),money=sim.state.money;
 const repaired=new Simulation(parseSave(JSON.stringify(sim.snapshot()))),depot=repaired.building(warehouse.id);
 assert.equal(depot.construction,undefined);assert.equal(depot.connected,true);assert.deepEqual(depot.inventory,inventory);assert.equal(repaired.state.money,money);
 assert.ok(repaired.state.agents.length>0);assert.ok(repaired.building(home.id).workers>0);
 for(let i=0;i<300;i++)repaired.step();
 assert.ok(repaired.building(home.id).construction.completed>20);
 const reloaded=new Simulation(parseSave(JSON.stringify(repaired.snapshot())));
 assert.equal(reloaded.state.buildings.filter(b=>b.kind==='warehouse').length,1);
 assert.equal(reloaded.state.history.filter(h=>h.includes('replacement warehouse has opened')).length,1);
});
