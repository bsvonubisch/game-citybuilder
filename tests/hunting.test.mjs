import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,parseSave} from './legacy-town.mjs';
import {wildOpen,stepWildlife,huntTargets,stepHunting,landHunt,huntingArea,WILDLIFE_TARGET,WILDLIFE_RECOVERY_TICKS} from '../.test-dist/hunting.js';
import {Simulation as StarterSimulation} from '../.test-dist/simulation.js';
import {DAY_TICKS} from '../.test-dist/daylight.js';
import {buildingGuidance} from '../.test-dist/building-guidance.js';
import {footprint} from '../.test-dist/catalog.js';
function fixture(){const sim=new Simulation();sim.state.money=50000;Object.assign(sim.state.buildings.find(b=>b.kind==='warehouse').inventory,{wood:500,stone:500,metal:100});const result=sim.execute({id:'hunt-test',expectedRevision:sim.state.revision,command:{type:'place',kind:'hunter',x:7,y:21,rotation:3}});assert.equal(result.ok,true,result.message);const lodge=sim.buildingAt(7,21);delete lodge.construction;sim.reconnect(true);return{sim,lodge};}
test('wildlife roams natural woodland, outside buildings and road buffers',()=>{
 const sim=new Simulation();assert.equal(sim.state.wildlife.length,WILDLIFE_TARGET);
 for(let t=0;t<400;t++){sim.state.tick++;stepWildlife(sim);for(const a of sim.state.wildlife.filter(a=>a.respawnAt===undefined)){assert.ok(wildOpen(sim,a));if(a.to)assert.ok(wildOpen(sim,a.to));for(const b of sim.state.buildings)for(const p of footprint(b.kind,b.x,b.y,b.rotation,b.plot))assert.ok(Math.hypot(p.x-a.x,p.y-a.y)>3);}}
 const a=sim.state.wildlife[0],house=sim.state.buildings.find(b=>b.kind==='house');house.x=a.x;house.y=a.y;sim.state.revision++;stepWildlife(sim);assert.ok(a.respawnAt!==undefined||wildOpen(sim,a),'town expansion displaces wildlife');
});
test('real hunters track, aim and return with meat before it enters stock',()=>{
 const{sim,lodge}=fixture(),seen=new Set();let delivered=false;assert.ok(huntTargets(sim,lodge).length);
 for(let i=0;i<2200;i++){sim.step();delivered ||= sim.state.agents.some(a=>a.source===lodge.id&&a.cargo==='meat');const trips=lodge.hunting??[];const reserved=trips.filter(t=>t.phase!=='returning').map(t=>t.animal);assert.equal(new Set(reserved).size,reserved.length);for(const t of trips){seen.add(t.phase);assert.ok(sim.state.agents.some(a=>a.resident===t.resident&&a.onsite===lodge.id));if(t.phase==='returning'&&t.cargo)assert.ok(sim.state.wildlife.find(a=>a.id===t.animal).respawnAt>sim.state.tick);}}
 assert.deepEqual([...seen].sort(),['aiming','outbound','returning']);assert.ok(lodge.produced>=6);assert.ok(delivered,'Harvested meat is hauled to local consumers');assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
});
test('hunting needs present workers and keeps carried meat through saving',()=>{
 const{sim,lodge}=fixture();sim.state.agents=[];for(let i=0;i<50;i++){sim.state.tick++;stepHunting(sim,lodge);}assert.equal(lodge.produced,0);assert.equal(lodge.hunting.length,0);
 const ready=fixture();for(let i=0;i<1200&&!ready.lodge.hunting?.some(t=>t.cargo);i++)ready.sim.step();const cargo=ready.lodge.hunting.reduce((n,t)=>n+t.cargo,0);assert.ok(cargo>0);const stock=ready.lodge.inventory.meat??0;const restored=parseSave(JSON.stringify(ready.sim.snapshot())).buildings.find(b=>b.id===ready.lodge.id);assert.equal(restored.inventory.meat,stock+cargo);landHunt(ready.lodge);assert.equal(ready.lodge.inventory.meat,stock+cargo);landHunt(ready.lodge);assert.equal(ready.lodge.inventory.meat,stock+cargo);
});
test('invalid wildlife and hunting saves are rejected',()=>{
 const{sim,lodge}=fixture(),saved=sim.snapshot();saved.wildlife[0].progress=2;assert.throws(()=>parseSave(JSON.stringify(saved)),/animal/i);saved.wildlife[0].progress=0;saved.buildings.find(b=>b.id===lodge.id).hunting=[{resident:1,animal:1,path:[{x:7,y:23}],distance:0,phase:'returning',work:0,cargo:500}];assert.throws(()=>parseSave(JSON.stringify(saved)),/hunt/i);
});

test('saved wildlife is topped up in woodland without moving existing animals or resetting recovery',()=>{
 const saved=new StarterSimulation().snapshot();saved.wildlife=saved.wildlife.slice(0,44);
 saved.wildlife[0].respawnAt=saved.tick+DAY_TICKS*2;saved.wildlife[1].respawnAt=saved.tick+120;
 const originals=structuredClone(saved.wildlife),sim=new StarterSimulation(parseSave(JSON.stringify(saved)));
 assert.equal(sim.state.wildlife.length,WILDLIFE_TARGET);
 for(const old of originals){const a=sim.state.wildlife.find(a=>a.id===old.id);assert.equal(a.x,old.x);assert.equal(a.y,old.y);assert.deepEqual(a.home,old.home);}
 assert.equal(sim.state.wildlife[0].respawnAt,sim.state.tick+WILDLIFE_RECOVERY_TICKS);
 assert.equal(sim.state.wildlife[1].respawnAt,sim.state.tick+120);
 for(const a of sim.state.wildlife.slice(44))assert.ok(wildOpen(sim,a));
 sim.state.tick+=20;const again=new StarterSimulation(parseSave(JSON.stringify(sim.snapshot())));
 assert.deepEqual(again.state.wildlife,sim.state.wildlife,'reload does not add more animals, move them or extend timers');
});

test('both starter lodges can hunt in dense natural woodland without clearing it first',()=>{
 const sim=new StarterSimulation(),lodges=sim.state.buildings.filter(b=>b.kind==='hunter');
 for(const b of lodges)assert.ok(huntTargets(sim,b).length>=2,`${b.x},${b.y} has a usable local population`);
 const tree=sim.state.decorations.find(d=>d.natural&&d.kind==='pine'&&!sim.buildingAt(d.x,d.y)&&wildOpen(sim,d,true));
 assert.ok(tree);assert.equal(wildOpen(sim,tree),false,'animals do not stand inside trunks');
 tree.natural=false;sim.state.revision++;assert.equal(wildOpen(sim,tree,true),false,'planted trees are obstacles');
});

test('depleted woodland recovers on schedule and gives waiting advice instead of requiring relocation',()=>{
 const{sim,lodge}=fixture();lodge.inventory={tools:3};lodge.hunting=[];
 for(const a of sim.state.wildlife)a.respawnAt=sim.state.tick+WILDLIFE_RECOVERY_TICKS;
 const area=huntingArea(sim,lodge);assert.equal(area.animals,0);assert.ok(area.recovering>0);
 assert.equal(area.nextReturn,240);assert.equal(sim.alert(lodge).title,'Wildlife recovering');
 assert.deepEqual(buildingGuidance(sim,lodge).action,{type:'inspect',id:lodge.id});
 sim.state.tick+=WILDLIFE_RECOVERY_TICKS-1;stepWildlife(sim);assert.equal(huntingArea(sim,lodge).animals,0);
 sim.state.tick++;stepWildlife(sim);assert.ok(huntingArea(sim,lodge).animals>0);assert.ok(huntTargets(sim,lodge).length);
 assert.notEqual(sim.alert(lodge)?.title,'Wildlife recovering');
});

