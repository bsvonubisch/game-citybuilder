import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,parseSave} from './legacy-town.mjs';
import {wildOpen,stepWildlife,huntTargets,stepHunting,landHunt} from '../.test-dist/hunting.js';
import {footprint} from '../.test-dist/catalog.js';
function fixture(){const sim=new Simulation();sim.state.money=50000;Object.assign(sim.state.buildings.find(b=>b.kind==='warehouse').inventory,{wood:500,stone:500,metal:100});const result=sim.execute({id:'hunt-test',expectedRevision:sim.state.revision,command:{type:'place',kind:'hunter',x:7,y:21,rotation:3}});assert.equal(result.ok,true,result.message);const lodge=sim.buildingAt(7,21);delete lodge.construction;sim.reconnect(true);return{sim,lodge};}
test('wildlife roams natural woodland, outside buildings and road buffers',()=>{
 const sim=new Simulation();assert.equal(sim.state.wildlife.length,44);
 for(let t=0;t<400;t++){sim.state.tick++;stepWildlife(sim);for(const a of sim.state.wildlife.filter(a=>a.respawnAt===undefined)){assert.ok(wildOpen(sim,a));if(a.to)assert.ok(wildOpen(sim,a.to));for(const b of sim.state.buildings)for(const p of footprint(b.kind,b.x,b.y,b.rotation,b.plot))assert.ok(Math.hypot(p.x-a.x,p.y-a.y)>3);}}
 const a=sim.state.wildlife[0],house=sim.state.buildings.find(b=>b.kind==='house');house.x=a.x;house.y=a.y;sim.state.revision++;stepWildlife(sim);assert.ok(a.respawnAt!==undefined||wildOpen(sim,a),'town expansion displaces wildlife');
});
test('real hunters track, aim and return with meat before it enters stock',()=>{
 const{sim,lodge}=fixture(),seen=new Set();assert.ok(huntTargets(sim,lodge).length);
 for(let i=0;i<2200;i++){sim.step();const trips=lodge.hunting??[];const reserved=trips.filter(t=>t.phase!=='returning').map(t=>t.animal);assert.equal(new Set(reserved).size,reserved.length);for(const t of trips){seen.add(t.phase);assert.ok(sim.state.agents.some(a=>a.resident===t.resident&&a.onsite===lodge.id));if(t.phase==='returning'&&t.cargo)assert.ok(sim.state.wildlife.find(a=>a.id===t.animal).respawnAt>sim.state.tick);}}
 assert.deepEqual([...seen].sort(),['aiming','outbound','returning']);assert.ok(lodge.produced>=6);assert.ok(sim.stored('meat')>0);assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
});
test('hunting needs present workers and keeps carried meat through saving',()=>{
 const{sim,lodge}=fixture();sim.state.agents=[];for(let i=0;i<50;i++){sim.state.tick++;stepHunting(sim,lodge);}assert.equal(lodge.produced,0);assert.equal(lodge.hunting.length,0);
 const ready=fixture();for(let i=0;i<1200&&!ready.lodge.hunting?.some(t=>t.cargo);i++)ready.sim.step();const cargo=ready.lodge.hunting.reduce((n,t)=>n+t.cargo,0);assert.ok(cargo>0);const stock=ready.lodge.inventory.meat??0;const restored=parseSave(JSON.stringify(ready.sim.snapshot())).buildings.find(b=>b.id===ready.lodge.id);assert.equal(restored.inventory.meat,stock+cargo);landHunt(ready.lodge);assert.equal(ready.lodge.inventory.meat,stock+cargo);landHunt(ready.lodge);assert.equal(ready.lodge.inventory.meat,stock+cargo);
});
test('invalid wildlife and hunting saves are rejected',()=>{
 const{sim,lodge}=fixture(),saved=sim.snapshot();saved.wildlife[0].progress=2;assert.throws(()=>parseSave(JSON.stringify(saved)),/animal/i);saved.wildlife[0].progress=0;saved.buildings.find(b=>b.id===lodge.id).hunting=[{resident:1,animal:1,path:[{x:7,y:23}],distance:0,phase:'returning',work:0,cargo:500}];assert.throws(()=>parseSave(JSON.stringify(saved)),/hunt/i);
});

