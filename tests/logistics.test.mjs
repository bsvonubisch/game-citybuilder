import {finishRoadFixture} from './roadwork-fixture.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, key } from "./legacy-town.mjs";
import {deliveryCapacity} from "../.test-dist/warehouses.js";
import { BUILDINGS, DELIVERY_CAPACITY } from "../.test-dist/catalog.js";
import { Simulation as StarterSimulation } from "../.test-dist/simulation.js";
import { nearbyDeposits } from "../.test-dist/deposits.js";
import { buildingGuidance } from "../.test-dist/building-guidance.js";
import {
  canSupply,
  productionConnections,
  productionActivity,
  LogisticsCache,
} from "../.test-dist/logistics.js";

const building = (sim, kind) =>
  sim.state.buildings.find((b) => b.kind === kind);

test('delivery loads respect source level, stock and goods already en route',()=>{
  for(const [sourceKind,targetKind,cargo] of [['warehouse','cattle','grain'],['warehouse','workshop','metal'],['warehouse','butcher','meat'],['warehouse','market','bread'],['sawmill','warehouse','planks']]){
    const sim=new StarterSimulation(),source=building(sim,sourceKind),target=building(sim,targetKind);
    sim.state.agents=[];for(const b of sim.state.buildings){b.enabled=b===source||b===target;b.inventory={};}
    source.inventory[cargo]=30;sim.dispatch();
    const shipment=sim.state.agents.find(a=>a.source===source.id&&a.target===target.id&&a.cargo===cargo);
    assert.ok(shipment,`${cargo} shipment`);assert.equal(shipment.amount,deliveryCapacity(source));assert.equal(source.inventory[cargo],30-deliveryCapacity(source));
    assert.equal(sim.totals()[cargo],30,'Loading never creates or loses goods');
    sim.dispatch();assert.equal(sim.state.agents.filter(a=>a.source===source.id).length,1,'An existing trip is not duplicated');
    sim.state.agents=[];source.inventory[cargo]=3;sim.dispatch();assert.equal(sim.state.agents.find(a=>a.source===source.id)?.amount,3,'Partial loads use available stock');
  }
  const sim=new StarterSimulation(),source=building(sim,'warehouse'),target=building(sim,'butcher');
  sim.state.agents=[];for(const b of sim.state.buildings){b.enabled=b===source||b===target;b.inventory={};}
  source.inventory.meat=40;target.inventory.meat=21;sim.dispatch();assert.equal(sim.state.agents.find(a=>a.cargo==='meat')?.amount,3,'Do not overfill a nearly stocked destination');
});
const execute = (sim, command) => {
  const result = sim.execute({
    id: `logistics-${sim.state.revision}`,
    actorId: "test",
    expectedRevision: sim.state.revision,
    command,
  });
  assert.equal(result.ok, true, result.message);
};

test("production links follow recipe chains, local household supplies and front entrances", () => {
  const sim = new Simulation(),
    sawmill = building(sim, "sawmill"),
    forester = building(sim, "forester"),
    workshop = building(sim, "workshop"),
    warehouse = building(sim, "warehouse");
  const before = sim.snapshot();
  const view = productionConnections(sim, sawmill.id);
  assert.deepEqual(
    view.inputs.map((l) => [l.source, l.resource]),
    [[warehouse.id,"wood"],[warehouse.id,"tools"],[forester.id,"wood"],[workshop.id,"tools"]],
  );
  assert.deepEqual(
    new Set(view.outputs.map((l) => `${l.target}:${l.resource}`)),
    new Set([`${warehouse.id}:planks`]),
  );
  assert.equal(
    canSupply(sawmill, warehouse),
    true,
    "warehouses accept planks for construction and upgrades",
  );
  assert.equal(canSupply(forester, warehouse), true);
  const quarry = productionConnections(sim, building(sim, "quarry").id);
  assert.ok(quarry.inputs.every(l=>l.resource==='tools'));
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

test("sawmills deliver usable construction planks to warehouses while workshops keep producing", () => {
  const sim = new Simulation();
  for (let i = 0; i < 4800; i++) sim.step();
  assert.ok(
    sim.stored("planks") >= 16,
    "enough planks must reach storage for a grand house",
  );
  assert.ok(
    building(sim, "workshop").produced > 10,
    "metal deliveries must supply workshops independently of planks",
  );
  const house = building(sim, "house");
  building(sim,"warehouse").inventory.wood=100;
  execute(sim, { type: "upgrade", id: house.id });
  for (let i = 0; i < 5000 && house.construction; i++) sim.step();
  assert.equal(house.houseTier, 2);
  const before = sim.stored("planks");
  execute(sim, { type: "upgrade", id: house.id });
  assert.equal(sim.stored("planks"), before - 16);
  for (let i = 0; i < 5000 && house.construction; i++) sim.step();
  assert.equal(house.houseTier, 3);
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
  finishRoadFixture(sim);
  const broken = cache.get(sim, mill.id);
  assert.notStrictEqual(broken, first);
  assert.equal(broken.inputs.find((l) => l.source === farm.id).path, null);
  for (const p of front) execute(sim, { type: "place", kind: "road", ...p });
  finishRoadFixture(sim);
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
  assert.deepEqual(cache.get(sim, mill.id).inputs, []);
  assert.deepEqual(cache.get(sim, mill.id).outputs, []);
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
    if(sim.building(a.source).kind==='warehouse'){
      assert.ok(canSupply(sim.building(a.source),sim.building(a.target),a.cargo));
      const to=productionConnections(sim,a.target);
      if(to)assert.ok(productionActivity(sim,to).incoming.some(truck=>truck.id===a.id));
      continue;
    }
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

test("warning guidance checks existing suppliers before recommending construction", () => {
  const sim = new Simulation(),
    mill = building(sim, "mill"),
    farm = building(sim, "farm");
  let advice = buildingGuidance(sim, mill, productionConnections(sim, mill.id));
  assert.deepEqual(advice.action, { type: "inspect", id: farm.id });
  sim.state.buildings = sim.state.buildings.filter((b) => b.id !== farm.id);
  advice = buildingGuidance(sim, mill, productionConnections(sim, mill.id));
  assert.deepEqual(advice.action, { type: "build", kind: "farm" });
  farm.construction = { completed: 0, required: 200 };
  sim.state.buildings.push(farm);
  advice = buildingGuidance(sim, mill, productionConnections(sim, mill.id));
  assert.deepEqual(advice.action, { type: "inspect", id: farm.id });
});

test("guidance follows a delivery already on its way without changing the town", () => {
  const sim = new Simulation(),
    mill = building(sim, "mill"),
    farm = building(sim, "farm");
  sim.state.agents.push({
    id: 999,
    kind: "truck",
    path: sim.route(farm, mill),
    segment: 0,
    progress: 0,
    resident: null,
    source: farm.id,
    target: mill.id,
    cargo: "grain",
    amount: 3,
    returning: false,
    wait: 0,
  });
  const snapshot = sim.snapshot();
  assert.deepEqual(
    buildingGuidance(sim, mill, productionConnections(sim, mill.id)).action,
    { type: "agent", id: 999 },
  );
  assert.deepEqual(sim.snapshot(), snapshot);
});

test("road and paused warnings lead to their actual fixes", () => {
  const sim = new Simulation(),
    mill = building(sim, "mill");
  mill.connected = false;
  assert.deepEqual(buildingGuidance(sim, mill).action, {
    type: "build",
    kind: "road",
  });
  sim.state.buildings = sim.state.buildings.filter(
    (b) => b.kind !== "warehouse",
  );
  assert.deepEqual(buildingGuidance(sim, mill).action, {
    type: "build",
    kind: "warehouse",
  });
  mill.connected = true;
  mill.enabled = false;
  assert.deepEqual(buildingGuidance(sim, mill).action, { type: "toggle" });
  mill.construction = { completed: 10, required: 200 };
  assert.equal(buildingGuidance(sim, mill).label, "Resume construction");
});

test("output and exhausted deposits suggest useful destinations and deeper excavation", () => {
  const sim = new Simulation(),
    farm = building(sim, "farm"),
    mill = building(sim, "mill");
  farm.inventory.grain = 20;
  assert.deepEqual(
    buildingGuidance(sim, farm, productionConnections(sim, farm.id)).action,
    { type: "inspect", id: mill.id },
  );
  sim.state.buildings = sim.state.buildings.filter((b) => b.kind !== "mill");
  assert.deepEqual(
    buildingGuidance(sim, farm, productionConnections(sim, farm.id)).action,
    { type: "inspect", id: building(sim,"warehouse").id },
  );
  const quarry = building(sim, "quarry");
  for(const id of nearbyDeposits(quarry))sim.state.deposits[id] = 0;
  assert.deepEqual(buildingGuidance(sim, quarry).action, { type: "deepen" });
});

test("worker and construction advice accounts for available residents", () => {
  const sim = new Simulation(),
    mill = building(sim, "mill");
  mill.workers = 0;
  assert.deepEqual(buildingGuidance(sim, mill).action, {
    type: "build",
    kind: "house",
  });
  mill.construction = { completed: 0, required: 200 };
  const advice = buildingGuidance(sim, mill);
  assert.equal(advice.action.type, "inspect");
  assert.notEqual(advice.action.id, mill.id);
  assert.ok(sim.building(advice.action.id).workers > 0);
});


test("brickworks consumes stone, makes bricks, and sends them to warehouse stock",()=>{
 const sim=new Simulation(),works=building(sim,'workshop');
 for(const b of sim.state.buildings)if(BUILDINGS[b.kind].jobs)b.enabled=false;
 works.kind='brickworks';works.enabled=true;works.inventory={stone:12};works.produced=0;sim.reconnect();
 const initialStone=sim.totals().stone;
 for(let i=0;i<240;i++)sim.step();
 assert.ok(works.produced>=4);assert.equal(works.produced%4,0);
 assert.equal(initialStone-sim.totals().stone,works.produced/2);
 assert.ok(sim.stored('bricks')>0);assert.equal(canSupply(works,building(sim,'warehouse')),true);
});

test('tools require metal, leave planks untouched, and receive warehouse metal deliveries',()=>{
 const sim=new Simulation(),works=building(sim,'workshop');works.inventory={planks:9,metal:0};
 assert.equal(BUILDINGS.workshop.recipe.input,'metal');
 assert.equal(canSupply(building(sim,'sawmill'),works),false);
 assert.equal(canSupply(building(sim,'mine'),works),true);
 assert.equal(canSupply(building(sim,'warehouse'),works),true);
 for(let i=0;i<800;i++)sim.step();assert.ok(works.produced>0);assert.equal(works.inventory.planks,0);assert.ok(sim.stored('planks')>=9,'former plank input returns to construction stock');
});
