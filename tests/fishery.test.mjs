import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, parseSave, key } from "./legacy-town.mjs";
import { BUILDINGS, frontage } from "../.test-dist/catalog.js";
import { fisheryCells, fisheryLayout } from "../.test-dist/shoreline.js";
import { builderPosition } from "../.test-dist/construction.js";
import { canSupply, productionConnections } from "../.test-dist/logistics.js";
import {BoatWake,WAKE_LIFETIME} from '../.test-dist/boat-wake.js';
import {
  fishingRoute,
  boatPose,
  stepFishing,
  boatBerths,
} from "../.test-dist/fishing.js";

const execute = (sim, command) =>
  sim.execute({
    id: `fishery-${sim.state.revision}`,
    actorId: "test",
    expectedRevision: sim.state.revision,
    command,
  });

test('boat wakes follow travelled water, keep their trail through turns, and fade after stopping',()=>{
 const wake=new BoatWake();wake.update({x:10,y:10},0,true);
 for(let t=.05;t<=2;t+=.05)wake.update({x:10+t*.55,y:10},t,true);
 assert.ok(wake.marks.length>5);assert.ok(wake.marks.every(p=>p.x<11.1&&p.y===10));
 const existing=wake.marks.map(p=>({...p}));
 wake.update({x:11.1,y:10.1},2.2,true);
 for(const mark of existing)assert.ok(wake.marks.some(p=>p.x===mark.x&&p.y===mark.y&&p.born===mark.born),'Old foam stays in place at corners');
 const paused=structuredClone(wake.marks);wake.update({x:11.1,y:10.1},2.2,true);assert.deepEqual(wake.marks,paused);
 for(let t=2.4;t<2.3+WAKE_LIFETIME;t+=.2)wake.update({x:11.1,y:10.1},t,false);
 assert.equal(wake.marks.length,0);assert.equal(wake.moving,false);
});

test('wake emission is frame-rate independent, bounded, and cannot streak across a relocated boat',()=>{
 const run=hz=>{const wake=new BoatWake();for(let i=0;i<=hz*10;i++)wake.update({x:10+i/hz*.55,y:10},i/hz,true);return wake;};
 const a=run(20),b=run(60);assert.equal(a.marks.length,b.marks.length);assert.ok(a.marks.length<=24);
 a.marks.forEach((p,i)=>assert.ok(Math.hypot(p.x-b.marks[i].x,p.y-b.marks[i].y)<1e-6));
 a.update({x:40,y:40},10.1,true);assert.equal(a.marks.length,0);
 a.update({x:40.1,y:40},10.3,true);a.update({x:40.1,y:40},9,true);assert.equal(a.marks.length,0);
});
function shore(sim, x, y, rotation) {
  sim.state.terrain ??= {};
  for (const p of fisheryCells(x, y, rotation))
    sim.state.terrain[key(p)] = { kind: p.kind, height: 0 };
}
function fixture() {
  const seed = new Simulation().snapshot();
  const house = {
    ...seed.buildings.find((b) => b.kind === "house"),
    x: 4,
    y: 8,
    rotation: 0,
  };
  const warehouse = {
    ...seed.buildings.find((b) => b.kind === "warehouse"),
    x: 8,
    y: 8,
    rotation: 0,
    inventory: {metal:100, wood: 100, planks: 100, stone: 100 },
  };
  seed.buildings = [house, warehouse];
  seed.roadTypes = {};
  seed.roads = Array.from({ length: 10 }, (_, i) => `${4 + i},10`);
  seed.agents = [];
  seed.residents = [];
  seed.decorations = [];
  seed.money = 10000;
  seed.tick = 0;
  return new Simulation(seed);
}
function sea(sim) {
  sim.state.terrain ??= {};
  for (let x = 7; x <= 16; x++)
    for (let y = 13; y <= 18; y++)
      sim.state.terrain[`${x},${y}`] = { kind: "water", height: 0 };
}
function workingFishery() {
  const sim = fixture();
  shore(sim, 8, 11, 2);
  sea(sim);
  assert.equal(
    execute(sim, { type: "place", kind: "fishery", x: 8, y: 11, rotation: 2 })
      .ok,
    true,
  );
  const b = sim.buildingAt(8, 11);
  delete b.construction;
  sim.reconnect();
  return { sim, b };
}
test("shoreline placement requires the correct land/water half in every rotation and charges once", () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const sim = fixture(),
      x = 1,
      y = 2;
    shore(sim, x, y, rotation);
    const cells = fisheryCells(x, y, rotation);
    assert.equal(cells.filter((p) => p.kind === "water").length, 2);
    assert.equal(cells.filter((p) => p.kind === "land").length, 2);
    assert.equal(sim.canPlace("fishery", x, y, rotation), null);
    assert.match(sim.canPlace("fishery", x, y, (rotation + 2) % 4), /two land/);
    assert.match(sim.canPlace("house", x, y, rotation), /dry land/);
    const dry = cells.find((p) => p.kind === "land");
    sim.state.terrain[key(dry)].height = 1;
    assert.match(sim.canPlace("fishery", x, y, rotation), /water level/);
    sim.state.terrain[key(dry)].height = 0;
    const money = sim.state.money,
      wood = sim.stored("wood");
    assert.equal(
      execute(sim, { type: "place", kind: "fishery", x, y, rotation }).ok,
      true,
    );
    const b = sim.buildingAt(x, y);
    assert.ok(b.construction);
    assert.equal(sim.state.money, money - BUILDINGS.fishery.cost);
    assert.equal(sim.stored("wood"), wood - BUILDINGS.fishery.materials.wood);
    for (const p of cells) assert.equal(sim.buildingAt(p.x, p.y).id, b.id);
    assert.match(sim.canPlace("road", cells[0].x, cells[0].y), /overlaps/);
    assert.equal(
      execute(sim, {
        type: "terrain",
        mode: "land",
        x: cells.find((p) => p.kind === "water").x,
        y: cells.find((p) => p.kind === "water").y,
        size: 1,
      }).ok,
      false,
    );
    const land = fisheryLayout(rotation).land;
    for (let slot = 0; slot < 2; slot++) {
      const p = builderPosition(b, slot);
      assert.ok(p.x > x + land.x - 0.5 && p.x < x + land.x + land.width - 0.5);
      assert.ok(p.y > y + land.y - 0.5 && p.y < y + land.y + land.height - 0.5);
    }
    assert.equal(
      parseSave(JSON.stringify(sim.snapshot())).buildings.find(
        (q) => q.id === b.id,
      ).kind,
      "fishery",
    );
  }
});
test("fishery move keeps stock and construction; wrong shore and invalid saves are rejected", () => {
  const sim = fixture();
  shore(sim, 1, 2, 0);
  shore(sim, 12, 12, 3);
  assert.equal(
    execute(sim, { type: "place", kind: "fishery", x: 1, y: 2, rotation: 0 })
      .ok,
    true,
  );
  const b = sim.buildingAt(1, 2);
  b.inventory.fish = 7;
  b.progress = 3;
  b.produced = 11;
  b.construction.completed = 15;
  const before = structuredClone(b),
    money = sim.state.money;
  assert.equal(
    execute(sim, { type: "move", id: b.id, x: 12, y: 12, rotation: 0 }).ok,
    false,
  );
  assert.deepEqual(b, before);
  assert.equal(
    execute(sim, { type: "move", id: b.id, x: 12, y: 12, rotation: 3 }).ok,
    true,
  );
  assert.equal(b.id, before.id);
  assert.deepEqual(b.inventory, before.inventory);
  assert.deepEqual(b.construction, before.construction);
  assert.equal(b.progress, 3);
  assert.equal(sim.state.money, money);
  const saved = sim.snapshot(),
    water = fisheryCells(12, 12, 3).find((p) => p.kind === "water");
  saved.terrain[key(water)] = { kind: "land", height: 0 };
  assert.throws(() => parseSave(JSON.stringify(saved)), /fishery shoreline/);
});
test("builders finish a shoreline fishery, workers catch fish and trucks feed citizens through a warehouse", () => {
  const sim = fixture();
  shore(sim, 8, 11, 2);
  sea(sim);
  assert.equal(
    execute(sim, { type: "place", kind: "fishery", x: 8, y: 11, rotation: 2 })
      .ok,
    true,
  );
  const b = sim.buildingAt(8, 11),
    warehouse = sim.state.buildings.find((b) => b.kind === "warehouse");
  assert.equal(b.connected, true);
  assert.equal(b.workers, 2);
  assert.deepEqual(frontage("fishery", 8, 11, 2), [
    { x: 8, y: 10 },
    { x: 9, y: 10 },
  ]);
  for (let i = 0; i < 3000 && b.construction; i++) sim.step();
  assert.equal(b.construction, undefined);
  assert.ok(canSupply(b, warehouse));
  assert.ok(
    productionConnections(sim, b.id).outputs.some(
      (c) => c.target === warehouse.id && c.resource === "fish" && c.path,
    ),
  );
  let fishTruck = false;
  for (let i = 0; i < 960; i++) {
    sim.step();
    fishTruck ||= sim.state.agents.some(
      (a) => a.cargo === "fish" && a.amount > 0,
    );
  }
  assert.ok(b.produced > 0);
  assert.ok(fishTruck);
  assert.ok(sim.stored("fish") > 0);
  assert.equal(sim.state.food, 100);
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.deepEqual(restored.totals(), sim.totals());
});
test("food demand consumes bread and fish without double charging and reports shortages", () => {
  for (const [bread, fish, expected, remaining] of [
    [1, 2, 100, 2],
    [0, 2, 100, 1],
    [0, 0, 0, 0],
  ]) {
    const sim = fixture(),
      w = sim.state.buildings.find((b) => b.kind === "warehouse");
    w.inventory.bread = bread;
    w.inventory.fish = fish;
    sim.state.tick = 959;
    sim.step();
    assert.equal(sim.state.food, expected);
    assert.equal((w.inventory.bread ?? 0) + (w.inventory.fish ?? 0), remaining);
  }
});

test("fishing voyages carry their catch home, pause safely, and survive save/reload mid-voyage", () => {
  const { sim, b } = workingFishery();
  const phases = new Set();
  for (let i = 0; i < 500; i++) {
    sim.step();
    if (b.fishing) phases.add(b.fishing.phase);
    if (b.fishing?.phase === "returning") break;
  }
  assert.deepEqual([...phases].sort(), ["fishing", "outbound", "returning"]);
  assert.equal(
    b.inventory.fish ?? 0,
    0,
    "catch stays aboard until the boat returns",
  );
  assert.equal(b.fishing.cargo, 3);
  assert.equal(sim.totals().fish, 3);
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  assert.deepEqual(restored.building(b.id).fishing, b.fishing);
  const trip = structuredClone(b.fishing);
  assert.equal(execute(sim, { type: "toggle", id: b.id }).ok, true);
  for (let i = 0; i < 40; i++) sim.step();
  assert.deepEqual(
    b.fishing,
    trip,
    "paused boats do not move or generate catches",
  );
  execute(sim, { type: "toggle", id: b.id });
  for (let i = 0; i < 500 && b.fishing; i++) sim.step();
  assert.equal(b.fishing, undefined);
  assert.equal(b.produced, 3);
  assert.equal(sim.totals().fish, 3);
  assert.equal(b.inventory.fish ?? 0, 3);
});
test("boats reserve separate corridors and cannot sail through bridges, land or other piers", () => {
  const { sim, b } = workingFishery();
  const house = sim.state.buildings.find((b) => b.kind === "house");
  house.houseTier = 2;
  shore(sim, 12, 11, 2);
  assert.equal(
    execute(sim, { type: "place", kind: "fishery", x: 12, y: 11, rotation: 2 })
      .ok,
    true,
  );
  const second = sim.buildingAt(12, 11);
  delete second.construction;
  sim.reconnect();
  for (let tick = 0; tick < 600; tick++) {
    sim.step();
    const routes = new Set();
    for (const f of [b, second])
      for (const p of f.fishing?.path ?? []) {
        assert.equal(routes.has(key(p)), false);
        routes.add(key(p));
        assert.equal(sim.roads.has(key(p)), false);
        assert.equal(sim.buildingAt(p.x, p.y), undefined);
        assert.equal(sim.state.terrain[key(p)].kind, "water");
      }
  }
  assert.ok(b.produced > 0 && second.produced > 0);
  // Night may now last longer than a completed fishing trip. Wait for an actual
  // boat departure before asserting that its reserved corridor is protected.
  for(let tick=0;tick<1200&&!b.fishing;tick++)sim.step();
  const p = b.fishing?.path[0];
  assert.ok(p);
  assert.equal(
    execute(sim, { type: "place", kind: "road", x: p.x, y: p.y }).ok,
    false,
  );
  assert.equal(
    execute(sim, { type: "terrain", mode: "land", size: 1, x: p.x, y: p.y }).ok,
    false,
  );
});
test("enclosed fisheries report blocked water and never create fish out of thin air", () => {
  const sim = fixture();
  shore(sim, 8, 11, 2);
  execute(sim, { type: "place", kind: "fishery", x: 8, y: 11, rotation: 2 });
  const b = sim.buildingAt(8, 11);
  delete b.construction;
  sim.reconnect();
  for (let i = 0; i < 400; i++) sim.step();
  assert.equal(b.fishing, undefined);
  assert.equal(b.produced, 0);
  assert.equal(sim.alert(b).title, "Waiting for clear water");
  sea(sim);
  const berths = boatBerths(b);
  for (const p of berths) sim.state.roads.push(key(p));
  sim.reconnect();
  assert.equal(fishingRoute(sim, b), null, "low bridges block launching");
});
test("moving or removing a fishery preserves catches aboard, and malformed boats are rejected", () => {
  const { sim, b } = workingFishery();
  for (let i = 0; i < 500 && b.fishing?.phase !== "returning"; i++) sim.step();
  assert.equal(b.fishing.cargo, 3);
  const snapshot = sim.snapshot();
  for (const edit of [
    (t) => (t.cargo = 300),
    (t) => (t.distance = NaN),
    (t) => (t.path[1] = { x: 27, y: 27 }),
    (t) => (t.phase = "flying"),
  ]) {
    const malformed = structuredClone(snapshot);
    edit(malformed.buildings.find((q) => q.id === b.id).fishing);
    assert.throws(() => parseSave(JSON.stringify(malformed)), /fishing/);
  }
  shore(sim, 12, 20, 2);
  const total = sim.totals().fish,
    produced = b.produced;
  assert.equal(
    execute(sim, { type: "move", id: b.id, x: 12, y: 20, rotation: 2 }).ok,
    true,
  );
  assert.equal(sim.totals().fish, total);
  assert.equal(b.produced, produced);
  assert.equal(b.fishing, undefined);
  assert.equal(execute(sim, { type: "demolish", x: b.x, y: b.y }).ok, true);
  assert.equal(b.construction.demolition,true);
  assert.equal(sim.totals().fish, total, "catch remains on the demolition site until recovered");
});
test("boat interpolation follows each water segment smoothly and turns to all four views", () => {
  const frames = new Set();
  for (const end of [
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ]) {
    const dx = end.x - 1,
      dy = end.y - 1;
    const trip = {
      path: [{ x: 1, y: 1 }, end, { x: end.x + dx, y: end.y + dy }],
      distance: 0.5,
      phase: "outbound",
      cargo: 0,
    };
    const a = boatPose(trip, 0),
      c = boatPose(trip, 0.1);
    frames.add(a.frame);
    assert.ok(Math.hypot(a.x - c.x, a.y - c.y) < 0.06);
    assert.equal(a.dx, dx);
    assert.equal(a.dy, dy);
    trip.phase = "returning";
    trip.cargo = 3;
    assert.equal(boatPose(trip).frame, (a.frame + 2) % 4);
  }
  assert.equal(frames.size, 4);
});
