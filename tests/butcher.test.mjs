import test from 'node:test';import assert from 'node:assert/strict';import {Simulation,parseSave} from '../.test-dist/simulation.js';import {canSupply} from '../.test-dist/logistics.js';
test('butcher receives real warehouse meat and delivers edible sausages',()=>{
 const sim=new Simulation(),warehouse=sim.state.buildings.find(b=>b.kind==='warehouse');Object.assign(warehouse.inventory,{wood:100,stone:100,metal:100,meat:60});const result=sim.execute({id:'butcher-test',expectedRevision:sim.state.revision,command:{type:'place',kind:'butcher',x:7,y:21,rotation:3}});assert.equal(result.ok,true,result.message);const b=sim.buildingAt(7,21);delete b.construction;sim.reconnect(true);assert.ok(canSupply(warehouse,b));assert.ok(canSupply(b,warehouse));let inbound=false,outbound=false;
 for(let i=0;i<700;i++){sim.step();inbound||=sim.state.agents.some(a=>a.target===b.id&&a.cargo==='meat');outbound||=sim.state.agents.some(a=>a.source===b.id&&a.cargo==='sausages');}
 assert.ok(inbound);assert.ok(outbound);assert.ok(b.produced>0);assert.ok(sim.stored('sausages')>0);assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
 b.enabled=false;const before=b.produced;for(let i=0;i<100;i++)sim.step();assert.equal(b.produced,before);
});
