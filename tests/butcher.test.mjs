import test from 'node:test';import assert from 'node:assert/strict';import {Simulation,parseSave} from './legacy-town.mjs';import {canSupply} from '../.test-dist/logistics.js';import {BUILDINGS} from '../.test-dist/catalog.js';import {outputCapacity} from '../.test-dist/upgrades.js';
test('butcher receives real warehouse meat and delivers edible sausages',()=>{
 const sim=new Simulation(),warehouse=sim.state.buildings.find(b=>b.kind==='warehouse');Object.assign(warehouse.inventory,{wood:100,stone:100,metal:100,meat:60});const result=sim.execute({id:'butcher-test',expectedRevision:sim.state.revision,command:{type:'place',kind:'butcher',x:7,y:21,rotation:3}});assert.equal(result.ok,true,result.message);const b=sim.buildingAt(7,21);delete b.construction;b.inventory.tools=2;sim.reconnect(true);assert.ok(canSupply(warehouse,b));assert.ok(canSupply(b,warehouse));let inbound=false,outbound=false;
 for(let i=0;i<700;i++){sim.step();inbound||=sim.state.agents.some(a=>a.target===b.id&&a.cargo==='meat');outbound||=sim.state.agents.some(a=>a.source===b.id&&a.cargo==='sausages');}
 assert.ok(inbound);assert.ok(outbound);assert.ok(b.produced>0);assert.ok(sim.stored('sausages')>0);assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
 b.enabled=false;const before=b.produced;for(let i=0;i<100;i++)sim.step();assert.equal(b.produced,before);
});
test('a mixed batch waits for every product to fit, then consumes meat once and stores all cuts',()=>{
 const sim=new Simulation(),b={id:900,kind:'butcher',x:7,y:21,rotation:3,inventory:{meat:20,steaks:999,tools:2},workers:2,enabled:true,connected:true,progress:BUILDINGS.butcher.recipe.seconds-.25,produced:0};
 sim.state.buildings.push(b);sim.dispatch=()=>{};
 b.inventory.steaks=outputCapacity(b);const progress=b.progress;sim.step();assert.equal(b.inventory.meat,20);assert.equal(b.progress,progress);assert.match(sim.alert(b).message,/steaks/);
 b.inventory.steaks=0;sim.step();assert.equal(b.inventory.meat,13);assert.equal(b.inventory.sausages,4);assert.equal(b.inventory.steaks,3);assert.equal(b.inventory.roasts,4);assert.equal(b.produced,11);
 b.progress=43.75;b.inventory.meat=6;sim.step();assert.equal(b.inventory.meat,6);assert.equal(b.produced,11);
});
