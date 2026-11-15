import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {ViewWorld} from '../.test-dist/view-world.js';
import {turnPoint,turnBox} from '../.test-dist/view-space.js';
import {dimensions,footprint,frontage} from '../.test-dist/catalog.js';
import {terrainCell,planTerrain} from '../.test-dist/terrain.js';
import {planRoad} from '../.test-dist/road-stroke.js';
import {lanePose} from '../.test-dist/traffic.js';
import {miningTargets} from '../.test-dist/mining.js';
import {servicePreview} from '../.test-dist/proximity.js';
import {lampPoint} from '../.test-dist/streetlights.js';
import {fenceNeighbour} from '../.test-dist/fences.js';
import {farmPatch} from '../.test-dist/farm-layout.js';

test('all four views preserve the authoritative town, entrances, rectangles and terrain',()=>{
 const sim=new Simulation(),v=new ViewWorld(sim),before=JSON.stringify(sim.snapshot());
 for(let turn=0;turn<4;turn++){
  v.setTurn(turn);const view=v.simulation;
  for(const b of sim.state.buildings){
   const drawn=view.building(b.id),cells=footprint(b.kind,b.x,b.y,b.rotation,b.plot).map(p=>v.to(p));
   assert.deepEqual(new Set(footprint(drawn.kind,drawn.x,drawn.y,drawn.rotation,drawn.plot).map(p=>`${p.x},${p.y}`)),new Set(cells.map(p=>`${p.x},${p.y}`)));
   assert.deepEqual(new Set(view.adjacent(drawn).map(p=>`${p.x},${p.y}`)),new Set(sim.adjacent(b).map(p=>v.to(p)).map(p=>`${p.x},${p.y}`)));
   assert.equal(view.buildingAt(drawn.x,drawn.y).id,b.id);
   for(const p of cells)assert.equal(terrainCell(p.x,p.y,view.state.terrain).kind,terrainCell(v.from(p).x,v.from(p).y,sim.state.terrain).kind);
  }
  for(let x=0;x<64;x+=7)for(let y=0;y<64;y+=7)assert.deepEqual(v.from(v.to({x,y})),{x,y});
 }
 assert.equal(JSON.stringify(sim.snapshot()),before);assert.doesNotThrow(()=>parseSave(before));
});
test('placement, moving and rectangular terrain brushes target exactly the previewed world tiles',()=>{
 const sim=new Simulation(),v=new ViewWorld(sim);
 for(let turn=0;turn<4;turn++){
  v.setTurn(turn);
  for(const kind of ['church','market','cattle','house']){
   const command={type:'place',kind,x:40,y:40,rotation:1,...(['market','cattle'].includes(kind)?{plot:[3,5]}:{})},world=v.command(command);
   const expected=footprint(kind,40,40,1,command.plot).map(p=>v.from(p));
   assert.deepEqual(new Set(footprint(kind,world.x,world.y,world.rotation,world.plot).map(p=>`${p.x},${p.y}`)),new Set(expected.map(p=>`${p.x},${p.y}`)));
   assert.equal(v.simulation.canPlace(kind,40,40,1,command.plot),sim.canPlace(kind,world.x,world.y,world.rotation,world.plot));
  }
  for(const size of [1,2,3,4,5]){
   const cmd={type:'terrain',x:40,y:40,size,mode:'land'},mapped=v.command(cmd),plan=planTerrain(v.simulation.state,cmd),actual=planTerrain(sim.state,mapped);
   assert.equal(plan.error,actual.error);assert.deepEqual(plan.changes.map(p=>({...p,...v.from(p)})),actual.changes);
  }
 }
});
test('road previews, mining reach and live traffic remain in the same physical locations',()=>{
 const sim=new Simulation(),v=new ViewWorld(sim);
 for(let turn=1;turn<4;turn++){
  v.setTurn(turn);const view=v.simulation;
  const from=v.to({x:35,y:10}),to=v.to({x:39,y:14}),a=planRoad(view,from,to),b=planRoad(sim,{x:35,y:10},{x:39,y:14});
  assert.deepEqual(a.tiles.map(p=>v.from(p)),b.tiles);assert.equal(a.cost,b.cost);
  for(const mine of sim.state.buildings.filter(b=>b.kind==='quarry'||b.kind==='mine'))assert.deepEqual(miningTargets(view,view.building(mine.id)).map(t=>v.from(t.rock)),miningTargets(sim,mine).map(t=>t.rock));
  for(const mine of sim.state.buildings.filter(b=>b.kind==='quarry'||b.kind==='mine')){
   const b=view.building(mine.id),preview=servicePreview(b.kind,b.x,b.y,b.rotation);
   assert.deepEqual(miningTargets(view,preview).map(t=>v.from(t.rock)),miningTargets(sim,servicePreview(mine.kind,mine.x,mine.y,mine.rotation)).map(t=>t.rock));
  }
  for(const original of sim.state.agents){const shown=view.state.agents.find(a=>a.id===original.id),a=lanePose(original),b=lanePose(shown),p=v.to(a);assert.ok(Math.hypot(p.x-b.x,p.y-b.y)<1e-8);}
 }
});
test('crop patches, road lanterns and fence sides keep their world positions in every view',()=>{
 const sim=new Simulation(),v=new ViewWorld(sim),farm=sim.state.buildings.find(b=>b.kind==='farm');
 sim.state.decorations.push({id:99001,kind:'streetlight',x:30,y:30,edge:0},{id:99002,kind:'fence',x:29,y:30,side:1});
 for(let turn=1;turn<4;turn++){
  v.setTurn(turn);const view=v.simulation,shown=view.building(farm.id);
  for(let i=0;i<farm.field.cells.length;i++){
   const p=farmPatch(i,farm.plot),world=v.to({x:farm.x+p.x,y:farm.y+p.y}),index=shown.field.cells.indexOf(farm.field.cells[i]),local=farmPatch(index,shown.plot);
   assert.deepEqual({x:shown.x+local.x,y:shown.y+local.y},world);
  }
  const lamp=sim.state.decorations.find(d=>d.id===99001),drawn=view.state.decorations.find(d=>d.id===lamp.id),p=v.to(lampPoint(lamp)),q=lampPoint(drawn);
  assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1e-9);
  const fence=sim.state.decorations.find(d=>d.id===99002),df=view.state.decorations.find(d=>d.id===fence.id);assert.deepEqual(v.to(fenceNeighbour(fence,fence.side)),fenceNeighbour(df,df.side));
 }
});
test('rotated placement and moving execute at the previewed footprint and preserve stored goods',()=>{
 for(let turn=1;turn<4;turn++){
  const sim=new Simulation(),v=new ViewWorld(sim);v.setTurn(turn);sim.state.money=100000;
  const warehouse=sim.state.buildings.find(b=>b.kind==='warehouse');for(const r of ['wood','stone','planks','metal'])warehouse.inventory[r]=10000;
  let p;for(let y=33;y<55&&!p;y++)for(let x=33;x<55&&!p;x++)if(!sim.canPlace('cattle',x,y,0,[3,5]))p={x,y};assert.ok(p);
  const box=turnBox(p,3,5,turn),cmd={type:'place',kind:'cattle',...box,rotation:turn},result=sim.execute({id:'view-place',expectedRevision:sim.state.revision,command:v.command(cmd)});assert.equal(result.ok,true,result.message);
  const b=sim.buildingAt(p.x,p.y);assert.deepEqual(b.plot,[3,5]);assert.equal(b.rotation,0);delete b.construction;b.inventory={grain:15,milk:9};b.herd={count:3,growth:10,fed:7};sim.state.revision++;
  const draw=v.simulation.building(b.id),rotation=(draw.rotation+2)%4,move={type:'move',id:b.id,x:draw.x,y:draw.y,rotation};assert.equal(v.simulation.canMove(b.id,draw.x,draw.y,rotation),null);
  const moved=sim.execute({id:'view-move',expectedRevision:sim.state.revision,command:v.command(move)});assert.equal(moved.ok,true,moved.message);assert.equal(b.rotation,2);assert.deepEqual(b.inventory,{grain:15,milk:9});assert.equal(b.herd.count,3);
 }
});
test('view refresh retains object identity, updates crop state and never retains demolished buildings',()=>{
 const sim=new Simulation(),v=new ViewWorld(sim);v.setTurn(1);const view=v.simulation,b=sim.state.buildings.find(b=>b.kind==='farm'),drawn=view.building(b.id);
 for(let i=0;i<3;i++)view.step();assert.equal(view.building(b.id),drawn);assert.equal(drawn.field.cells.length,b.field.cells.length);
 const old=drawn.field.cells.filter(c=>c.sownAt!==undefined).length;assert.equal(old,b.field.cells.filter(c=>c.sownAt!==undefined).length);
 const id=sim.state.buildings.find(b=>b.kind==='cattle').id;sim.state.buildings=sim.state.buildings.filter(b=>b.id!==id);sim.state.revision++;v.refresh();assert.equal(view.building(id),undefined);
});
