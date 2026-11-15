import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,parseSave} from './legacy-town.mjs';
import {CROPS,farmRectangle,farmPatch,farmPrice,farmJobs,validFarmPlot} from '../.test-dist/farm-layout.js';
import {ensureField,stepFarm,cropStage,farmSummary,validateField,farmTravel,farmPosition} from '../.test-dist/farming.js';
import {buildingRecipe,buildingJobs,frontage,AGENT_SPEED,STEP} from '../.test-dist/catalog.js';
import {canSupply} from '../.test-dist/logistics.js';
import {townNeeds} from '../.test-dist/needs.js';
import {DAY_TICKS} from '../.test-dist/daylight.js';
const command=(s,c)=>s.execute({id:'field-'+s.state.revision,actorId:'test',expectedRevision:s.state.revision,command:c});
function fixture(){const s=new Simulation();s.state.money=100000;Object.assign(s.state.buildings.find(b=>b.kind==='warehouse').inventory,{wood:1000,stone:1000,planks:1000,metal:1000});return s;}

test('farmers walk at pedestrian speed regardless of path spacing, including short entrance steps',()=>{
  for(const x of [[0,.5,1,1.5,2],[0,.03,.06,.5,1,1.5,2]])for(const phase of ['walking','returning']){
    const t={path:x.map(x=>({x,y:0})),distance:0,phase};
    const start=farmPosition(t),interpolated=farmPosition(t,STEP/2);
    assert.ok(Math.abs(interpolated.x-start.x-AGENT_SPEED.person*STEP/2)<1e-9);
    for(let i=0;i<4;i++)t.distance=farmTravel(t,STEP).distance;
    assert.ok(Math.abs(farmPosition(t).x-AGENT_SPEED.person)<1e-9);
    assert.ok(Math.abs(farmPosition(t).travelled-AGENT_SPEED.person)<1e-9);
  }
  const corner={path:[{x:0,y:0},{x:.1,y:0},{x:.1,y:.5}],distance:0,phase:'walking'};
  assert.ok(Math.abs(farmPosition(corner,STEP).y-(STEP*AGENT_SPEED.person-.1))<1e-9,'A tick carries unused movement around a corner');
  assert.deepEqual(farmPosition({...corner,phase:'working'},1),farmPosition({...corner,phase:'working'}),'Working farmers stay planted');
  assert.equal(farmTravel(corner,10).distance,2,'Clamp at the destination');
  const old={path:[{x:0,y:0},{x:.5,y:0},{x:1,y:0}],distance:1.2,phase:'returning'};
  assert.ok(Math.abs(farmPosition(old).x-.6)<1e-9,'An existing saved farmer does not jump');
});

test('inclusive field drag works in all directions and caps each side at ten tiles',()=>{
  assert.deepEqual(farmRectangle({x:10,y:10},{x:10,y:10}),{x:10,y:10,plot:[1,1]});
  assert.deepEqual(farmRectangle({x:10,y:10},{x:13,y:11}),{x:10,y:10,plot:[4,2]});
  assert.deepEqual(farmRectangle({x:10,y:10},{x:1,y:30}),{x:1,y:10,plot:[10,10]});
  for(let w=1;w<=10;w++)for(let h=1;h<=10;h++){
    assert.ok(validFarmPlot([w,h]));assert.ok(farmJobs([w,h])<=12);
    for(let i=0;i<w*h*4;i++){const p=farmPatch(i,[w,h]);assert.ok(p.x>=-.5&&p.x<w-.5&&p.y>=-.5&&p.y<h-.5);}
  }
  for(const p of [[0,1],[11,1],[3.5,2],[1]])assert.equal(validFarmPlot(p),false);
});

test('cleared field placement scales costs, opens immediately and saves its rectangle',()=>{
  const s=fixture(),gold=s.state.money,wood=s.stored('wood'),plot=[3,2],price=farmPrice(plot);
  assert.equal(command(s,{type:'place',kind:'farm',x:7,y:19,plot,crop:'potatoes'}).ok,true);
  const b=s.buildingAt(7,19);assert.equal(s.state.money,gold-price.cost);assert.equal(s.stored('wood'),wood-price.materials.wood);
  assert.equal(b.construction,undefined);assert.equal(buildingJobs(b),2);
  const restored=parseSave(JSON.stringify(s.snapshot())).buildings.find(v=>v.id===b.id);
  assert.deepEqual(restored.plot,plot);assert.equal(restored.crop,'potatoes');assert.equal(restored.x,7);
  assert.equal(command(s,{type:'place',kind:'farm',x:32,y:20,plot:[11,1],crop:'wheat'}).ok,false);
  assert.equal(command(s,{type:'place',kind:'farm',x:32,y:20,plot:[1,1],crop:'gold'}).ok,false);
  assert.equal(frontage('farm',7,19,0,plot).length,10);
});

test('each crop is planted, grows, harvested and carried by real farmers before delivery',()=>{
  for(const crop of Object.keys(CROPS)){
    const s=fixture(),b=s.state.buildings.find(b=>b.kind==='farm');b.crop=crop;
    const seen=new Set(['soil']),actions=new Set();let cargo=false,delivery=false;
    for(let i=0;i<4000;i++){
      s.step();for(const cell of b.field.cells)seen.add(cropStage(cell,crop,s.state.tick));
      for(const task of b.field.tasks){actions.add(task.action);cargo||=task.cargo>0;assert.ok(s.state.agents.some(a=>a.resident===task.resident&&a.onsite===b.id));}
      const ids=b.field.tasks.map(t=>t.patch);assert.equal(ids.length,new Set(ids).size);validateField(b,s.state.tick);
      delivery||=s.state.agents.some(a=>a.source===b.id&&a.cargo===CROPS[crop].output);
    }
    assert.deepEqual([...seen].sort(),['growing','ripe','seeded','soil']);assert.deepEqual([...actions].sort(),['harvest','sow']);assert.ok(cargo);assert.ok(b.produced>0);assert.ok(delivery,crop+' reaches its supply chain');
    const warehouse=s.state.buildings.find(b=>b.kind==='warehouse');assert.equal(canSupply(b,warehouse),true,'grain also enters warehouse feed reserves');assert.equal(buildingRecipe(b).output,CROPS[crop].output);
  }
});

test('without onsite workers soil stays bare; growing crops do not produce food on their own',()=>{
  const s=fixture(),b=s.state.buildings.find(b=>b.kind==='farm');s.state.agents=[];
  for(let i=0;i<600;i++){s.state.tick++;stepFarm(s,b);}assert.equal(farmSummary(b,s.state.tick).soil,16);assert.equal(b.produced,0);
  ensureField(b).cells[0].sownAt=0;
  for(let i=0;i<1600;i++){s.state.tick++;stepFarm(s,b);}assert.equal(farmSummary(b,s.state.tick).ripe,1);assert.equal(b.produced,0);
});

test('new farms wait for a crop choice; selection and crop-change requests survive reload',()=>{
  const s=fixture();assert.ok(command(s,{type:'place',kind:'farm',x:7,y:19,plot:[3,2]}).ok);const b=s.buildingAt(7,19);
  assert.equal(b.crop,null);assert.equal(s.alert(b).kind,'crop');assert.equal(buildingJobs(b),0);assert.equal(buildingRecipe(b),undefined);
  for(let i=0;i<100;i++){s.state.tick++;stepFarm(s,b);}assert.equal(b.field.tasks.length,0);assert.equal(farmSummary(b,s.state.tick).soil,24);
  assert.equal(new Simulation(parseSave(JSON.stringify(s.snapshot()))).building(b.id).crop,null);
  assert.ok(command(s,{type:'crop',id:b.id,crop:'potatoes'}).ok);assert.equal(b.crop,'potatoes');assert.equal(buildingJobs(b),2);
  b.field.cells[0].sownAt=0;b.inventory.potatoes=4;
  assert.ok(command(s,{type:'crop',id:b.id,crop:'carrots'}).ok);assert.equal(b.crop,'potatoes');assert.equal(b.nextCrop,'carrots');assert.equal(b.field.cells[0].sownAt,0);
  const restored=new Simulation(parseSave(JSON.stringify(s.snapshot()))).building(b.id);assert.equal(restored.nextCrop,'carrots');assert.equal(restored.inventory.potatoes,4);
  b.field.cells.forEach(c=>delete c.sownAt);b.field.tasks=[];b.field.phase='harvesting';stepFarm(s,b);assert.equal(b.crop,'potatoes','old stock keeps its delivery route');
  b.inventory.potatoes=0;stepFarm(s,b);assert.equal(b.crop,'carrots');assert.equal(b.nextCrop,undefined);
  assert.equal(command(s,{type:'crop',id:b.id,crop:'gold'}).ok,false);
});

test('farm clearance has no extra construction wait and old pending fields retain only unfinished clearing',()=>{
  const s=fixture();command(s,{type:'place',kind:'farm',x:33,y:28,plot:[10,10]});const b=s.buildingAt(33,28),n=b.construction.clearance.tiles.length;
  assert.equal(b.construction.required,n*12);
  b.construction.required+=1220;b.construction.completed=27;b.construction.clearance.work=3;
  let restored=new Simulation(parseSave(JSON.stringify(s.snapshot()))).building(b.id);assert.equal(restored.construction.required,n*12);assert.equal(restored.construction.completed,3);
  delete b.construction.clearance;b.construction.required=1220;b.construction.completed=25;
  restored=new Simulation(parseSave(JSON.stringify(s.snapshot()))).building(b.id);assert.equal(restored.construction,undefined);
  b.construction={required:500,completed:100,upgradeLevel:2};restored=new Simulation(parseSave(JSON.stringify(s.snapshot()))).building(b.id);assert.equal(restored.construction.required,500,'equipment upgrades keep their own work');
});

test('a 10×10 farm fills every row before harvesting and does not replant during the harvest pass',()=>{
  const s=fixture();command(s,{type:'place',kind:'farm',x:33,y:28,plot:[10,10],crop:'wheat'});const b=s.buildingAt(33,28);delete b.construction;b.connected=true;
  ensureField(b);s.state.agents=[];
  for(const r of s.state.residents.slice(0,12)){r.job=b.id;s.state.agents.push({id:10000+r.id,resident:r.id,onsite:b.id,path:[{x:33,y:27}]});}
  let full=false,harvested=false;
  for(let i=0;i<5000;i++){
    s.state.tick++;stepFarm(s,b);validateField(b,s.state.tick);
    if(!full){assert.equal(b.produced,0);assert.ok(b.field.tasks.every(t=>t.action==='sow'));full=b.field.cells.every(c=>c.sownAt!==undefined);}
    else if(b.field.phase==='harvesting')assert.ok(b.field.tasks.every(t=>t.phase==='returning'||t.action==='harvest'));
    if(b.produced>0){harvested=true;break;}
  }
  assert.ok(full,'all 400 patches must be sown');assert.ok(harvested);assert.ok(b.field.cells.some(c=>c.sownAt===undefined));assert.equal(b.field.phase,'harvesting');
  assert.deepEqual(Object.values(CROPS).map(c=>c.grow),[375,475,325]);
  for(const [crop,old] of [['wheat',75],['potatoes',95],['carrots',65]]){assert.equal(cropStage({sownAt:0},crop,old*4),'growing');assert.equal(cropStage({sownAt:0},crop,old*5*4),'ripe');}
});

test('field movement, rotation and reload preserve growth, stock and harvested cargo once',()=>{
  const s=fixture();command(s,{type:'place',kind:'farm',x:7,y:19,plot:[3,2],crop:'carrots'});const b=s.buildingAt(7,19);delete b.construction;
  const f=ensureField(b);f.cells[0].sownAt=0;b.inventory.carrots=7;
  f.tasks=[{resident:1,patch:1,action:'harvest',phase:'returning',path:[{x:0,y:0}],distance:0,work:2,cargo:3}];
  const result=command(s,{type:'move',id:b.id,x:7,y:19,rotation:1});assert.ok(result.ok,result.message);
  assert.deepEqual(b.plot,[2,3]);assert.equal(b.inventory.carrots,10);assert.equal(b.field.cells.filter(c=>c.sownAt===0).length,1);
  const restored=new Simulation(parseSave(JSON.stringify(s.snapshot()))).building(b.id);
  assert.equal(restored.inventory.carrots,10);assert.deepEqual(restored.field.cells,b.field.cells);
  const forged=s.snapshot();forged.buildings.find(v=>v.id===b.id).field.cells[0].sownAt=forged.tick+1;assert.throws(()=>parseSave(JSON.stringify(forged)),/farm/);
});

test('vegetables count as town food and are consumed from warehouse stock each day',()=>{
  const s=fixture();s.state.buildings=s.state.buildings.filter(b=>b.kind==='warehouse'||b.kind==='house');s.reconnect();
  const warehouse=s.state.buildings.find(b=>b.kind==='warehouse');warehouse.inventory={potatoes:100,carrots:100};
  assert.equal(townNeeds(s).find(n=>n.id==='food').have,200);
  s.state.tick=DAY_TICKS-1;s.step();assert.ok(s.stored('potatoes')+s.stored('carrots')<200);assert.equal(s.state.food,100);
});

test('old wheat farms retain inventory and become empty fields ready for planting',()=>{
  const old=fixture().snapshot(),b=old.buildings.find(b=>b.kind==='farm');delete b.crop;delete b.field;b.inventory.grain=13;
  const s=new Simulation(parseSave(JSON.stringify(old))),field=s.building(b.id);assert.equal(field.inventory.grain,13);assert.equal(field.field.cells.length,16);assert.equal(field.crop??'wheat','wheat');
});

test('field clearing follows the chosen rectangle and remains reloadable in woodland',()=>{
  for(const plot of [[1,1],[10,10]]){
    const s=fixture(),inside=d=>d.x>=33&&d.x<33+plot[0]&&d.y>=28&&d.y<28+plot[1];
    const outside=s.state.decorations.filter(d=>!inside(d)).map(d=>d.id);
    assert.ok(command(s,{type:'place',kind:'farm',x:33,y:28,plot,crop:'wheat'}).ok);
    assert.equal(s.state.decorations.filter(inside).length,0);
    assert.deepEqual(s.state.decorations.map(d=>d.id),outside);
    const restored=new Simulation(parseSave(JSON.stringify(s.snapshot()))).buildingAt(33,28);
    assert.deepEqual(restored.plot,plot);assert.equal(restored.field.cells.length,plot[0]*plot[1]*4);
  }
});
