import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {BUILDINGS,footprint,buildingJobs,isHome} from '../.test-dist/catalog.js';
import {terrainCell} from '../.test-dist/terrain.js';
import {fisherySiteError} from '../.test-dist/shoreline.js';
import {miningTargets} from '../.test-dist/mining.js';
import {forestTargets} from '../.test-dist/forestry.js';
import {townNeeds} from '../.test-dist/needs.js';
import {serviceOpen,LEISURE_DECAY,FAITH_DECAY} from '../.test-dist/proximity.js';
import {DAY_TICKS} from '../.test-dist/daylight.js';
import {STARTER_LAYOUT} from '../.test-dist/starter-layout.js';
test('starter town contains every building, connected front doors and clear footprints',()=>{
 const s=new Simulation(),occupied=new Set();
 assert.deepEqual([...new Set(s.state.buildings.map(b=>b.kind))].sort(),Object.keys(BUILDINGS).sort());
 for(const b of s.state.buildings){
  assert.ok(b.connected,b.kind+' connected');
  assert.ok(s.adjacent(b).length,b.kind+' frontage');
  if(b.kind==='fishery')assert.equal(fisherySiteError(b.x,b.y,b.rotation,s.state.terrain),null);
  for(const p of footprint(b.kind,b.x,b.y,b.rotation,b.plot)){
   const k=p.x+','+p.y;assert.ok(!occupied.has(k),'overlap '+b.kind+' '+k);assert.ok(!s.roads.has(k),'road under '+b.kind+' '+k);occupied.add(k);
   if(b.kind!=='fishery')assert.equal(terrainCell(p.x,p.y,s.state.terrain).kind,'land',b.kind+' dry land');
  }
 }
 assert.ok(s.state.residents.length>s.state.buildings.reduce((n,b)=>n+buildingJobs(b),0),'spare builders');
 assert.ok(s.state.buildings.filter(b=>!isHome(b.kind)).every(b=>b.workers===buildingJobs(b)),'all jobs filled');
});
test('starter gathering workplaces can reach real resources and save without changing layout',()=>{
 const s=new Simulation();
 const foresters=s.state.buildings.filter(b=>b.kind==='forester');
 assert.ok(foresters.every(b=>forestTargets(s,b).length>0),'both relocated foresters can harvest');
 assert.ok(foresters.reduce((n,b)=>n+forestTargets(s,b).length,0)>=40,'eastern woodland supplies the larger town');
 for(const b of s.state.buildings.filter(b=>b.kind==='quarry'||b.kind==='mine'))assert.ok(miningTargets(s,b).length,b.kind+' reachable deposits');
 const restored=new Simulation(parseSave(JSON.stringify(s.snapshot())));
 assert.deepEqual(restored.state.buildings.map(b=>[b.kind,b.x,b.y,b.plot]),s.state.buildings.map(b=>[b.kind,b.x,b.y,b.plot]));
});

test('captured town keeps its actual service coverage and closed services stop contributing',()=>{
 const s=new Simulation(),needs=townNeeds(s);
 assert.equal(needs.find(n=>n.id==='parks').have,128);
 // The southern expansion has six residents beyond the captured churches.
 assert.equal(needs.find(n=>n.id==='religion').have,122);
 assert.ok(!needs.some(n=>n.id==='nightlife'));
 assert.ok(serviceOpen('church',21),'workers can visit after their shift');
 assert.ok(100-FAITH_DECAY*DAY_TICKS*5>=60,'worship lasts several days');
 assert.ok(100-LEISURE_DECAY*DAY_TICKS*3>=60,'leisure lasts several days');
 for(const church of s.state.buildings.filter(b=>b.kind==='church'))church.enabled=false;s.reconnect();
 assert.equal(townNeeds(s).find(n=>n.id==='religion').have,0,'a closed church is still an actual unmet need');
});

test('new games reproduce the captured layout with independent fresh state',()=>{
 const a=new Simulation(),b=new Simulation();
 assert.equal(a.state.buildings.length,73);
 assert.equal(a.state.roads.length,273);
 assert.equal(a.state.decorations.length,1593);
 assert.deepEqual(a.state.buildings.map(v=>Object.fromEntries(Object.keys(STARTER_LAYOUT.buildings[a.state.buildings.indexOf(v)]).map(k=>[k,v[k]]))),STARTER_LAYOUT.buildings);
 assert.deepEqual(a.state.roads,STARTER_LAYOUT.roads);
 assert.deepEqual(a.state.roadTypes,STARTER_LAYOUT.roadTypes);
 assert.deepEqual(a.state.terrain,STARTER_LAYOUT.terrain);
 assert.deepEqual(a.state.clearedDeposits,STARTER_LAYOUT.clearedDeposits);
 assert.deepEqual(a.state.decorations.map(({id,...d})=>d),STARTER_LAYOUT.decorations);
 assert.equal(a.state.money,5000);assert.equal(a.state.tick,960);
 assert.ok(a.state.buildings.every(v=>!v.construction&&v.produced===0));
 assert.ok(a.state.buildings.filter(v=>v.herd).every(v=>v.herd.count===2));
 const warehouse=a.state.buildings.find(v=>v.kind==='warehouse');
 assert.ok(warehouse.inventory.wood>=200&&warehouse.inventory.stone>=160&&warehouse.inventory.bread>=140);
 a.state.buildings[0].x=55;a.state.decorations[0].x=55;a.state.roads.pop();
 assert.notEqual(b.state.buildings[0].x,55);assert.notEqual(b.state.decorations[0].x,55);assert.equal(b.state.roads.length,273);
});

test('loading an existing town never inserts the new starter layout or resets its progress',()=>{
 const s=new Simulation();s.state.buildings=s.state.buildings.filter(b=>b.kind!=='garden');
 s.state.money=123456;s.state.tick=54321;s.state.decorations.pop();
 const saved=s.snapshot(),restored=new Simulation(parseSave(JSON.stringify(saved)));
 assert.equal(restored.state.money,123456);assert.equal(restored.state.tick,54321);
 assert.deepEqual(restored.state.buildings.map(b=>[b.kind,b.x,b.y,b.plot]),saved.buildings.map(b=>[b.kind,b.x,b.y,b.plot]));
 assert.deepEqual(restored.state.decorations,saved.decorations);
});
