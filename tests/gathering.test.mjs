import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {berryRipe,BERRY_REGROW_TICKS,seedBerryBushes} from '../.test-dist/gathering.js';
import {forestTargets,stepForestry,validForestTrip,landTimber} from '../.test-dist/forestry.js';
import {terrainCell} from '../.test-dist/terrain.js';
import {depositAt} from '../.test-dist/deposits.js';
import {worldDetails} from '../.test-dist/world-inspection.js';
import {canSupply} from '../.test-dist/logistics.js';
import {collectHouseholdSupplies,foodStock,stepHouseholds} from '../.test-dist/supplies.js';
import {DAY_TICKS} from '../.test-dist/daylight.js';

test('wild berries migrate into saved towns once, on empty land, without resetting town progress',()=>{
 const old=new Simulation().snapshot();delete old.berriesVersion;
 old.decorations=old.decorations.filter(d=>d.kind!=='berry');old.buildings=old.buildings.filter(b=>b.kind!=='gatherer');
 old.money=12345;old.tick=4567;const plans=structuredClone(old.buildings),roads=[...old.roads],trees=structuredClone(old.decorations);
 const sim=new Simulation(parseSave(JSON.stringify(old))),bushes=sim.state.decorations.filter(d=>d.kind==='berry');
 assert.ok(bushes.length>50);assert.equal(sim.state.money,12345);assert.equal(sim.state.tick,4567);
 assert.deepEqual(sim.state.buildings.map(b=>[b.id,b.kind,b.x,b.y,b.inventory,b.produced]),plans.map(b=>[b.id,b.kind,b.x,b.y,b.inventory,b.produced]));
 assert.deepEqual(sim.state.roads,roads);assert.deepEqual(sim.state.decorations.filter(d=>d.kind!=='berry'),trees);
 for(const d of bushes){assert.equal(terrainCell(d.x,d.y,sim.state.terrain).kind,'land');assert.ok(!sim.roads.has(`${d.x},${d.y}`)&&!sim.buildingAt(d.x,d.y)&&!depositAt(d));assert.ok(!trees.some(t=>t.x===d.x&&t.y===d.y));}
 bushes[0].ripeAt=sim.state.tick+BERRY_REGROW_TICKS;sim.state.decorations=sim.state.decorations.filter(d=>d.id!==bushes[1].id);
 const restored=new Simulation(parseSave(JSON.stringify(sim.snapshot())));assert.deepEqual(restored.state.decorations,sim.state.decorations);
 const next=restored.state.nextId;seedBerryBushes(restored.state);assert.equal(restored.state.nextId,next);
});

function crew(){
 const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='gatherer');
 sim.state.tick=1050;b.inventory={tools:2};
 const residents=sim.state.residents.filter(r=>r.job===b.id);assert.equal(residents.length,2);
 sim.state.agents=residents.map((r,i)=>({id:sim.state.nextId++,resident:r.id,kind:'person',source:r.home,target:b.id,onsite:b.id,path:[{x:32,y:26},{x:32,y:27}],segment:0,progress:0,amount:0,wait:0,returning:false,cargo:null}));
 return {sim,b};
}
test('starter residents commute to the hut, work on site and supply local stores',()=>{
 const sim=new Simulation(),hut=sim.state.buildings.find(b=>b.kind==='gatherer');let sawPicking=false,sawCargo=false,sawDelivery=false,sawOnsite=false;
 for(let i=0;i<700;i++){sim.step();sawPicking||=hut.forestry?.some(t=>t.phase==='chopping');sawCargo||=hut.forestry?.some(t=>t.cargo>0);sawDelivery||=sim.state.agents.some(a=>a.source===hut.id&&a.cargo==='berries');sawOnsite||=sim.state.agents.some(a=>a.onsite===hut.id);}
 assert.ok(sawPicking&&sawCargo&&sawDelivery);assert.ok(hut.produced>=6);
 assert.equal(hut.workers,2);assert.ok(sawOnsite);
});
test('gatherers reserve bushes, visibly travel and pick, then land food exactly once',()=>{
 const {sim,b}=crew(),seen=new Set();assert.ok(forestTargets(sim,b).length>=6);
 let landed=0;
 for(let i=0;i<650;i++){
  sim.state.tick++;stepForestry(sim,b);
  const trips=b.forestry??[],reserved=trips.filter(t=>t.phase!=='returning').map(t=>t.tree);
  assert.equal(new Set(reserved).size,reserved.length);
  for(const t of trips){seen.add(t.phase);assert.ok(validForestTrip(t));assert.ok(sim.state.agents.some(a=>a.resident===t.resident&&a.onsite===b.id));}
  const picked=sim.state.decorations.filter(d=>d.ripeAt>sim.state.tick).length*6;
  assert.equal((b.inventory.berries??0)+trips.reduce((n,t)=>n+t.cargo,0),picked);
  if((b.inventory.berries??0)>0)landed=b.inventory.berries;
 }
 assert.deepEqual([...seen].sort(),['chopping','outbound','returning']);assert.ok(landed>=6);
 const bush=sim.state.decorations.find(d=>d.ripeAt);assert.ok(!berryRipe(bush,bush.ripeAt-1));assert.ok(berryRipe(bush,bush.ripeAt));
 const detail=worldDetails(sim,{kind:'decoration',id:bush.id});assert.match(detail.status,/regrowing/);assert.ok(detail.facts.some(([label])=>label==='Ripe in'));
});
test('carried berries survive saving and settling trips without being converted to wood',()=>{
 const {sim,b}=crew();for(let i=0;i<500&&!b.forestry?.some(t=>t.cargo);i++){sim.state.tick++;stepForestry(sim,b);}
 const cargo=b.forestry.reduce((n,t)=>n+t.cargo,0);assert.ok(cargo>0);
 const saved=parseSave(JSON.stringify(sim.snapshot())),hut=saved.buildings.find(c=>c.id===b.id);
 assert.equal(hut.inventory.berries,(b.inventory.berries??0)+cargo);assert.ok(!hut.inventory.wood);assert.equal(hut.forestry,undefined);
 const deadlines=sim.state.decorations.filter(d=>d.ripeAt).map(d=>[d.id,d.ripeAt]);assert.deepEqual(saved.decorations.filter(d=>d.ripeAt).map(d=>[d.id,d.ripeAt]),deadlines);
 landTimber(b);const stock=b.inventory.berries;landTimber(b);assert.equal(b.inventory.berries,stock);
});
test('no remote harvesting across water, no free output while paused, and full stores stop new trips',()=>{
 const {sim,b}=crew();b.enabled=false;for(let i=0;i<100;i++)stepForestry(sim,b);assert.equal(b.produced,0);assert.equal(b.forestry.length,0);
 b.enabled=true;b.inventory.berries=999;stepForestry(sim,b);assert.equal(b.forestry.length,0);
 b.inventory.berries=0;sim.state.terrain??={};for(const p of sim.adjacent(b))sim.state.terrain[`${p.x},${p.y}`]={kind:'water',height:0};sim.state.revision++;
 assert.equal(forestTargets(sim,b).length,0);stepForestry(sim,b);assert.equal(b.forestry.length,0);
});
test('berries are local food available from both warehouses and markets without household trucks',()=>{
 const sim=new Simulation(),hut=sim.state.buildings.find(b=>b.kind==='gatherer'),store=sim.state.buildings.find(b=>b.kind==='warehouse'),market=sim.state.buildings.find(b=>b.kind==='market'),home=sim.state.buildings.find(b=>b.kind==='house');
 assert.ok(canSupply(hut,store,'berries')&&canSupply(hut,market,'berries'));
 for(const b of sim.state.buildings)b.inventory={};sim.state.agents=[];store.inventory={berries:1000};
 const total=sim.totals().berries;collectHouseholdSupplies(sim);assert.ok(home.inventory.berries>0);assert.equal(sim.totals().berries,total);assert.equal(sim.state.agents.length,0);
 sim.state.residents=sim.state.residents.filter(r=>r.home===home.id);sim.state.residents.forEach(r=>r.lastMeal=0);sim.state.tick=DAY_TICKS;
 const before=foodStock(home);stepHouseholds(sim);assert.equal(foodStock(home),before-sim.state.residents.length);assert.equal(sim.state.food,100);
});
test('invalid berry timers and versions are rejected',()=>{
 for(const mutate of [s=>s.decorations.find(d=>d.kind==='berry').ripeAt=s.tick+BERRY_REGROW_TICKS+1,s=>s.decorations.find(d=>d.kind==='berry').ripeAt=-1,s=>s.decorations.find(d=>d.kind==='pine').ripeAt=100,s=>s.berriesVersion=99]){
  const saved=new Simulation().snapshot();mutate(saved);assert.throws(()=>parseSave(JSON.stringify(saved)));
 }
});
