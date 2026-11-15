import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {BUILDINGS,buildingRecipe,buildingJobs} from '../.test-dist/catalog.js';
import {ensureHerd,stepLivestock,livestockCapacity,livestockJobs,livestockPose,penRectangle,LIVESTOCK} from '../.test-dist/livestock.js';
import {canSupply,productionConnections} from '../.test-dist/logistics.js';

function setup(kind='cattle',plot=[3,3]){
 const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind===kind);b.plot=plot;b.workers=buildingJobs(b);b.inventory={grain:500};
 const workers=sim.state.residents.slice(0,b.workers);sim.state.agents=[];
 workers.forEach((r,i)=>{r.job=b.id;sim.state.agents.push({id:10000+i,resident:r.id,onsite:b.id,target:b.id});});
 return{sim,b};
}
test('new livestock pens start with a pair, then grow only with feed and farmers',()=>{
 for(const kind of Object.keys(LIVESTOCK)){
  const {sim,b}=setup(kind);assert.equal(ensureHerd(b).count,2);
  for(let i=0;i<LIVESTOCK[kind].birth*4+2;i++)stepLivestock(sim,b);
  assert.ok(b.herd.count>=2);assert.ok(b.herd.count>2||(b.inventory.meat??0)>0,kind+' reproduced');assert.ok(b.inventory.grain<500);
  for(const stop of ['feed','workers','paused','night','construction']){
   b.herd={count:2,growth:0,fed:0};b.enabled=true;delete b.construction;sim.state.tick=960;b.inventory.grain=500;
   const agents=sim.state.agents;
   if(stop==='feed')b.inventory.grain=0;if(stop==='workers')sim.state.agents=[];if(stop==='paused')b.enabled=false;if(stop==='night')sim.state.tick=640;if(stop==='construction')b.construction={required:10,completed:0};
   const produced=b.produced;for(let i=0;i<20;i++)stepLivestock(sim,b);
   assert.equal(b.herd.growth,0,stop);assert.equal(b.produced,produced,stop);sim.state.agents=agents;
  }
 }
});
test('full pens produce meat only on the next birth and retain their full herd',()=>{
 for(const kind of Object.keys(LIVESTOCK)){
  const {sim,b}=setup(kind,[2,2]);b.herd={count:livestockCapacity(kind,b.plot),growth:0,fed:0};
  const capacity=b.herd.count;
  for(let i=0;i<LIVESTOCK[kind].birth*4-1;i++)stepLivestock(sim,b);
  assert.equal(b.inventory.meat??0,0,'No animal is slaughtered before a new birth');
  assert.equal(b.herd.count,capacity);stepLivestock(sim,b);
  assert.equal(b.herd.count,capacity);assert.equal(b.inventory.meat,4);assert.equal(b.herd.growth,0);
  if(kind!=='pigs')assert.ok(b.inventory[BUILDINGS[kind].recipe.output]>0);
 }
});

test('the birth that fills a pen grows the herd; a blocked surplus birth waits without losing animals',()=>{
 for(const kind of Object.keys(LIVESTOCK)){
  const {sim,b}=setup(kind,[2,2]),capacity=livestockCapacity(kind,b.plot);
  b.herd={count:capacity-1,growth:LIVESTOCK[kind].birth-.25,fed:40};stepLivestock(sim,b);
  assert.equal(b.herd.count,capacity);assert.equal(b.inventory.meat??0,0);assert.equal(b.herd.growth,0);
  b.inventory.meat=100;b.herd.growth=LIVESTOCK[kind].birth;
  for(let i=0;i<20;i++)stepLivestock(sim,b);
  assert.equal(b.herd.count,capacity);assert.equal(b.inventory.meat,100);assert.equal(b.herd.growth,LIVESTOCK[kind].birth);
  const restored=new Simulation(parseSave(JSON.stringify(sim.snapshot()))).building(b.id);
  assert.equal(restored.herd.growth,LIVESTOCK[kind].birth);assert.equal(restored.herd.count,capacity);
  b.inventory.meat=0;stepLivestock(sim,b);assert.equal(b.inventory.meat,4);assert.equal(b.herd.count,capacity);assert.equal(b.herd.growth,0);
 }
});
test('rectangular pens clamp 2–10 and animals remain inside every rotated footprint',()=>{
 assert.deepEqual(penRectangle({x:10,y:10},{x:10,y:10}),{x:10,y:10,plot:[2,2]});
 assert.deepEqual(penRectangle({x:10,y:10},{x:-20,y:50}),{x:1,y:10,plot:[10,10]});
 for(const kind of Object.keys(LIVESTOCK))for(const plot of [[2,2],[2,10],[10,2],[10,10]])for(let rotation=0;rotation<4;rotation++){
  const b={id:1,kind,x:10,y:10,plot,rotation};
  for(let i=0;i<livestockCapacity(kind,plot);i++)for(const t of [0,3,10,20,100]){const p=livestockPose(b,i,t);assert.ok(p.x>=9.5&&p.x<10+plot[0]-.5);assert.ok(p.y>=9.5&&p.y<10+plot[1]-.5);}
 }
});
test('larger pens hold more animals with only one to three farmers and no shared grazing patches',()=>{
 for(const kind of Object.keys(LIVESTOCK)){
  assert.equal(livestockJobs(kind,[3,3]),1);assert.equal(livestockJobs(kind,[6,6]),1);assert.equal(livestockJobs(kind,[8,8]),2);assert.equal(livestockJobs(kind,[10,10]),3);
  assert.ok(livestockCapacity(kind,[10,10])>48);
  for(const plot of [[2,2],[3,3],[2,10],[10,2],[10,10]]){
   const points=Array.from({length:livestockCapacity(kind,plot)},(_,i)=>livestockPose({id:1,kind,x:0,y:0,plot,rotation:0},i,0));
   for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>.15,'Distinct patches');
  }
 }
});
test('breeding has a steady slower interval, regardless of herd size or building upgrades',()=>{
 for(const kind of Object.keys(LIVESTOCK))for(const count of [2,8]){
  const {sim,b}=setup(kind,[10,10]);b.herd={count,growth:0,fed:1000};b.level=3;
  for(let i=0;i<LIVESTOCK[kind].birth*4-1;i++)stepLivestock(sim,b);
  assert.equal(b.herd.count,count,'No early birth');stepLivestock(sim,b);assert.equal(b.herd.count,count+1);assert.equal(b.herd.growth,0);
 }
});
test('custom pen costs, herd and stock survive moving, rotation and reload',()=>{
 const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='cattle');b.herd={count:3,growth:23,fed:12};b.inventory={grain:5,milk:9};
 const result=sim.execute({id:'move-pen',expectedRevision:sim.state.revision,command:{type:'move',id:b.id,x:b.x,y:b.y,rotation:2}});assert.equal(result.ok,true,result.message);
 const restored=new Simulation(parseSave(JSON.stringify(sim.snapshot()))).building(b.id);assert.deepEqual(restored.herd,b.herd);assert.deepEqual(restored.inventory,b.inventory);
 assert.equal(sim.canPlace('pigs',40,40,0,[1,1]),'Livestock pens must be between 2×2 and 10×10 tiles.');
});
test('milk, eggs and surplus meat have delivery routes; butcher keeps and delivers old cuts',()=>{
 const sim=new Simulation(),warehouse=sim.state.buildings.find(b=>b.kind==='warehouse'),butcher=sim.state.buildings.find(b=>b.kind==='butcher');
 for(const b of sim.state.buildings.filter(b=>Object.hasOwn(LIVESTOCK,b.kind))){
  assert.ok(canSupply(warehouse,b));assert.ok(canSupply(b,butcher,'meat'));assert.ok(canSupply(b,warehouse));
  assert.ok(productionConnections(sim,b.id).outputs.some(l=>l.resource==='meat'&&l.path));
 }
 butcher.inventory={meat:40,sausages:7};
 for(const cut of ['steaks','roasts']){
  const result=sim.execute({id:cut,expectedRevision:sim.state.revision,command:{type:'butcherCut',id:butcher.id,cut}});assert.equal(result.ok,true,result.message);assert.deepEqual(buildingRecipe(butcher).outputs,{sausages:4,steaks:3,roasts:4});
  assert.equal(butcher.inventory.sausages,7);assert.ok(canSupply(butcher,warehouse,'sausages'));
 }
 assert.equal(parseSave(JSON.stringify(sim.snapshot())).buildings.find(b=>b.id===butcher.id).cut,undefined);
 const recipe=JSON.stringify(BUILDINGS.butcher.recipe);sim.dispatch();assert.equal(JSON.stringify(BUILDINGS.butcher.recipe),recipe);
 assert.ok(sim.state.agents.some(a=>a.source===butcher.id&&a.cargo==='sausages'));
});
test('every butcher batch makes all cuts even when an old save had selected a single cut',()=>{
 for(const cut of ['steaks','roasts']){
  const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='butcher');
  b.cut=cut;b.inventory={meat:40};sim.dispatch=()=>{};
  const recipe=buildingRecipe(b);b.progress=recipe.seconds-.25;sim.step();
  for(const [resource,count] of Object.entries(recipe.outputs))assert.equal(b.inventory[resource],count);
  assert.equal(b.inventory.meat,40-recipe.amount);
 }
});
test('starter livestock receives real farmers and feed; dairy and poultry produce while the pig herd grows',()=>{
 const sim=new Simulation(),pens=sim.state.buildings.filter(b=>Object.hasOwn(LIVESTOCK,b.kind)),fed=new Set(),onsite=new Set();
 const productive=b=>b.kind==='pigs'?b.herd.count>2:b.produced>0;
 for(let i=0;i<6400&&!pens.every(b=>productive(b)&&fed.has(b.id)&&onsite.has(b.id));i++){
  sim.step();for(const a of sim.state.agents){if(a.cargo==='grain'&&pens.some(b=>b.id===a.target))fed.add(a.target);if(a.onsite)onsite.add(a.onsite);}
 }
 for(const b of pens){assert.ok(onsite.has(b.id),b.kind+' farmers arrived');assert.ok(fed.has(b.id),b.kind+' feed hauled');assert.ok(productive(b),b.kind+' output or herd growth');assert.ok(b.herd.count>=2);}
 assert.doesNotThrow(()=>parseSave(JSON.stringify(sim.snapshot())));
});
