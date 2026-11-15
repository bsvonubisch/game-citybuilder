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
 const forester=s.state.buildings.find(b=>b.kind==='forester');assert.ok(forestTargets(s,forester).length>=20,'forester has reachable woodland');
 for(const b of s.state.buildings.filter(b=>b.kind==='quarry'||b.kind==='mine'))assert.ok(miningTargets(s,b).length,b.kind+' reachable deposits');
 const restored=new Simulation(parseSave(JSON.stringify(s.snapshot())));
 assert.deepEqual(restored.state.buildings.map(b=>[b.kind,b.x,b.y,b.plot]),s.state.buildings.map(b=>[b.kind,b.x,b.y,b.plot]));
});

test('an established starter town has sufficient leisure and religion without duplicating every service',()=>{
 const s=new Simulation(),needs=townNeeds(s);
 for(const id of ['parks','religion']){const n=needs.find(n=>n.id===id);assert.equal(n.have,n.need,id+' covers the whole starting community');}
 assert.ok(!needs.some(n=>n.id==='nightlife'));
 assert.ok(serviceOpen('church',21),'workers can visit after their shift');
 assert.ok(100-FAITH_DECAY*DAY_TICKS*5>=60,'worship lasts several days');
 assert.ok(100-LEISURE_DECAY*DAY_TICKS*3>=60,'leisure lasts several days');
 const church=s.state.buildings.find(b=>b.kind==='church');church.enabled=false;s.reconnect();
 assert.equal(townNeeds(s).find(n=>n.id==='religion').have,0,'a closed church is still an actual unmet need');
});
