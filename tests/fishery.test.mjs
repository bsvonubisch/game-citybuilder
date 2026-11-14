import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, parseSave, key } from "../.test-dist/simulation.js";
import { BUILDINGS, frontage } from "../.test-dist/catalog.js";
import { fisheryCells, fisheryLayout } from "../.test-dist/shoreline.js";
import { builderPosition } from "../.test-dist/construction.js";
import { canSupply, productionConnections } from "../.test-dist/logistics.js";

const execute = (sim, command) =>
  sim.execute({
    id: `fishery-${sim.state.revision}`,
    actorId: "test",
    expectedRevision: sim.state.revision,
    command,
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
    inventory: { wood: 100, planks: 100, stone: 100 },
  };
  seed.buildings = [house, warehouse];
  seed.roads = Array.from({ length: 10 }, (_, i) => `${4 + i},10`);
  seed.agents = [];
  seed.residents = [];
  seed.decorations = [];
  seed.money = 10000;
  seed.tick = 0;
  return new Simulation(seed);
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
    sim.state.tick = 239;
    sim.step();
    assert.equal(sim.state.food, expected);
    assert.equal((w.inventory.bread ?? 0) + (w.inventory.fish ?? 0), remaining);
  }
});
