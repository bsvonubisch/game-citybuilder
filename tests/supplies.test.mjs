import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave} from './legacy-town.mjs';
import {DAY_TICKS} from '../.test-dist/daylight.js';
import {foodStock,stepHouseholds,toolEfficiency,wearTools,TOOL_LIFE_TICKS,dispatchSupplies,collectHouseholdSupplies} from '../.test-dist/supplies.js';
import {productionRate} from '../.test-dist/upgrades.js';
import {buildingNeeds} from '../.test-dist/needs.js';
import {buildingGuidance} from '../.test-dist/building-guidance.js';
import {TownStatusLog} from '../.test-dist/town-status-log.js';

test('residents eat household food once per day, burn wood for heating, and recover from shortages',()=>{
 const sim=new Simulation(),home=sim.state.buildings.find(b=>b.kind==='house');sim.state.residents=sim.state.residents.filter(r=>r.home===home.id);
 const count=sim.state.residents.length;home.inventory={bread:count,wood:1};home.warmUntil=DAY_TICKS;sim.state.residents.forEach(r=>r.lastMeal=0);sim.state.tick=DAY_TICKS;
 const depot=sim.state.buildings.find(b=>b.kind==='warehouse'),stock=structuredClone(depot.inventory);
 stepHouseholds(sim);assert.equal(foodStock(home),0);assert.equal(home.inventory.wood,0);assert.equal(sim.state.food,100);assert.equal(home.warmUntil,DAY_TICKS*2);assert.deepEqual(depot.inventory,stock);
 stepHouseholds(sim);assert.equal(foodStock(home),0,'No double meal');
 sim.state.tick=DAY_TICKS*2;stepHouseholds(sim);assert.equal(sim.state.food,0);assert.equal(sim.alert(home).kind,'food');assert.ok(buildingGuidance(sim,home));
 home.inventory.fish=count;home.inventory.wood=1;stepHouseholds(sim);assert.equal(sim.state.food,100);assert.equal(foodStock(home),0);assert.equal(home.warmUntil,DAY_TICKS*3);
});
test('work remains productive without tools, recovers smoothly, and tools wear only during real work',()=>{
 const b={kind:'sawmill',inventory:{tools:0},workers:2,level:1};
 assert.equal(productionRate(b),.5);b.inventory.tools=1;assert.equal(productionRate(b),.75);b.inventory.tools=2;assert.equal(productionRate(b),1);
 for(let i=0;i<TOOL_LIFE_TICKS/2-1;i++)wearTools(b,2);
 assert.equal(b.inventory.tools,2);wearTools(b,2);assert.ok(b.toolWear>.99||b.inventory.tools===1);wearTools(b,2);assert.equal(b.inventory.tools,1);
 const untouched=structuredClone(b);assert.equal(toolEfficiency(b),.75);assert.deepEqual(b,untouched,'Reading efficiency does not consume tools');
});
test('homes collect conserved food and firewood from connected warehouses without trucks',()=>{
 const sim=new Simulation(),home=sim.state.buildings.find(b=>b.kind==='house'),depot=sim.state.buildings.find(b=>b.kind==='warehouse');
 for(const b of sim.state.buildings)if(b!==depot)b.inventory={};depot.inventory={bread:1000,wood:1000,tools:1000};sim.state.agents=[];
 const before=sim.totals();collectHouseholdSupplies(sim);assert.deepEqual(sim.totals(),before);assert.equal(sim.state.agents.length,0);
 assert.equal(foodStock(home),sim.state.residents.filter(r=>r.home===home.id).length*2);assert.equal(home.inventory.wood,2);
 const stocked=sim.snapshot();collectHouseholdSupplies(sim);assert.deepEqual(sim.snapshot(),stocked);
 home.inventory={};home.connected=false;collectHouseholdSupplies(sim);assert.equal(foodStock(home),0);
 for(let i=0;i<20;i++)dispatchSupplies(sim);assert.ok(sim.state.agents.length<=2);assert.ok(sim.state.agents.every(a=>a.cargo==='tools'));
});
test('connected markets also supply homes, and unavailable or disconnected stores do not create goods',()=>{
 const sim=new Simulation(),home=sim.state.buildings.find(b=>b.kind==='house'),depot=sim.state.buildings.find(b=>b.kind==='warehouse');
 sim.state.buildings.forEach(b=>b.inventory={});const market={...structuredClone(depot),id:sim.state.nextId++,kind:'market',inventory:{fish:100,wood:100},plot:[2,2]};sim.state.buildings.push(market);sim.state.agents=[];
 const before=sim.totals();collectHouseholdSupplies(sim);assert.deepEqual(sim.totals(),before);assert.ok(foodStock(home)>0);assert.equal(home.inventory.wood,2);assert.equal(sim.state.agents.length,0);
 assert.ok(market.produced>0);home.inventory={};market.enabled=false;collectHouseholdSupplies(sim);assert.equal(foodStock(home),0);
});
test('hungry households may use meat reserved for a butcher, after other food',()=>{
 const sim=new Simulation(),home=sim.state.buildings.find(b=>b.kind==='house');
 const store=sim.state.buildings.find(b=>b.kind==='warehouse');
 for(const b of sim.state.buildings)b.inventory={};
 sim.state.residents=sim.state.residents.filter(r=>r.home===home.id);
 const people=sim.state.residents.length;
 sim.state.buildings.push({...home,id:sim.state.nextId++,kind:'butcher',enabled:true,connected:true});
 store.inventory={meat:12,carrots:1};sim.state.agents=[];
 collectHouseholdSupplies(sim);
 assert.equal(home.inventory.carrots,1);
 assert.equal(home.inventory.meat,people-1);
 assert.equal(store.inventory.meat,12-(people-1));
});

test('arriving tools remain in storage and never generate export income',()=>{
 const sim=new Simulation(),depot=sim.state.buildings.find(b=>b.kind==='warehouse'),source=sim.state.buildings.find(b=>b.kind==='workshop');sim.dispatch=()=>{};
 const path=sim.route(source,depot,'truck');assert.ok(path);sim.state.agents=[{id:99999,kind:'truck',source:source.id,target:depot.id,path,segment:path.length-2,progress:.99,resident:null,cargo:'tools',amount:50,returning:false,wait:0}];
 const stock=depot.inventory.tools??0,exports=sim.state.exported,money=sim.state.money;
 sim.step();assert.equal(depot.inventory.tools,stock+50);assert.equal(sim.state.exported,exports);assert.equal(sim.state.money,money);
 const restored=new Simulation(parseSave(JSON.stringify(sim.snapshot())));assert.equal(restored.building(depot.id).inventory.tools,stock+50);
});
test('household and tool shortages have actionable badges, compact details and deduplicated recovery logs',()=>{
 const sim=new Simulation(),home=sim.state.buildings.find(b=>b.kind==='house'),works=sim.state.buildings.find(b=>b.kind==='sawmill');home.inventory={};works.inventory={wood:9,tools:0};
 assert.equal(sim.alert(home).kind,'food');assert.equal(sim.alert(works).kind,'tools');assert.match(buildingGuidance(sim,works).message,/50%/);
 assert.ok(buildingNeeds(sim,home).some(r=>r.label==='Firewood'&&!r.ok));assert.ok(buildingNeeds(sim,works).some(r=>r.label==='Tool efficiency'&&r.have==='50%'));
 const log=new TownStatusLog(),topic=`home:${home.id}:food`;
 for(let i=0;i<24;i++){sim.state.tick+=8;log.update(sim);}
 assert.equal(sim.state.events.filter(e=>e.topic===topic).length,1);
 home.inventory={bread:20,wood:2};works.inventory.tools=2;
 for(let i=0;i<4;i++){sim.state.tick+=8;log.update(sim);}
 assert.equal(sim.state.events.filter(e=>e.topic===topic).length,2);assert.equal(sim.state.events.find(e=>e.topic===topic).kind,'recovery');
 const saved=new Simulation(parseSave(JSON.stringify(sim.snapshot())));assert.deepEqual(saved.building(home.id).inventory,home.inventory);assert.deepEqual(saved.state.treePlanting,sim.state.treePlanting);
});
