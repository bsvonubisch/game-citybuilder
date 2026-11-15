import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave,key} from '../.test-dist/simulation.js';
import {footprint,SIZE} from '../.test-dist/catalog.js';
import {roadTypeAt} from '../.test-dist/roads.js';
import {roadVisualState,stepRoadWorks,queueRoadWork} from '../.test-dist/roadworks.js';
import {roadWorkSites,roadWorkCrew} from '../.test-dist/roadwork-sites.js';

const execute=(sim,command)=>sim.execute({id:`work-${sim.state.revision}`,expectedRevision:sim.state.revision,command});
function town(){
 const saved=new Simulation().snapshot(),warehouse=saved.buildings.find(b=>b.kind==='warehouse');
 Object.assign(warehouse,{x:2,y:2,rotation:0,inventory:{wood:1000,stone:1000,bricks:1000},enabled:true});
 const homes=[2,4,6].map((y,i)=>({...saved.buildings.find(b=>b.kind==='cottage'),id:100+i,x:6,y,rotation:0,inventory:{}}));
 saved.buildings=[warehouse,...homes];saved.residents=[];saved.agents=[];saved.decorations=[];saved.roadWorks=[];saved.nextId=20000;
 saved.terrain=Object.fromEntries(Array.from({length:SIZE*SIZE},(_,i)=>[`${i%SIZE},${Math.floor(i/SIZE)}`,{kind:'land',height:0}]));
 saved.roads=[];saved.roadTypes={};saved.money=100000;saved.tick=960;
 const occupied=new Set(saved.buildings.flatMap(b=>footprint(b.kind,b.x,b.y,b.rotation,b.plot).map(key)));
 for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(!occupied.has(`${x},${y}`))saved.roads.push(`${x},${y}`);
 return new Simulation(saved);
}
function finish(sim,max=1800){for(let i=0;i<max&&sim.state.roadWorks?.length;i++)sim.step();assert.equal(sim.state.roadWorks?.length,0,'all road jobs finish with actual travelling residents');}
test('roads reserve materials and plots, need arriving workers, then open for traffic',()=>{
 const sim=town(),p={x:9,y:7},money=sim.state.money;
 assert.equal(execute(sim,{type:'roadStroke',from:p,to:{x:11,y:7},roadType:'brick'}).ok,true);
 assert.equal(sim.state.money,money-72);assert.equal(sim.roads.has(key(p)),false);assert.equal(sim.state.roadWorks.length,3);
 assert.equal(roadVisualState(sim).roads.has(key(p)),true);assert.equal(roadTypeAt(roadVisualState(sim).state.roadTypes,p),'brick');
 assert.match(sim.canPlace('cottage',p.x,p.y),/workers/);
 assert.equal(execute(sim,{type:'terrain',mode:'raise',x:p.x,y:p.y,size:1,steps:1}).ok,false);
 const before=sim.state.money;assert.equal(execute(sim,{type:'roadStroke',from:p,to:p,roadType:'brick'}).ok,false);assert.equal(sim.state.money,before);
 sim.step();assert.ok(sim.state.roadWorks.every(w=>w.completed===0));
 let walking=false,working=false;
 for(let i=0;i<400&&sim.state.roadWorks.length;i++){sim.step();walking||=sim.state.agents.some(a=>a.roadWork!==undefined&&a.wait===0);working||=sim.state.agents.some(a=>a.roadWork!==undefined&&a.wait>0);}
 assert.ok(walking&&working,'real visible workers walk and work');finish(sim);
 for(let x=9;x<=11;x++){assert.ok(sim.roads.has(`${x},7`));assert.equal(roadTypeAt(sim.state.roadTypes,{x,y:7}),'brick');}
 assert.ok(sim.state.events.some(e=>e.message==='Brick road completed.'));
});
test('road removal and upgrades keep the old network until labour is complete, refund once',()=>{
 const sim=town(),p={x:8,y:7};
 assert.equal(execute(sim,{type:'roadStroke',from:p,to:p,roadType:'brick'}).ok,true);assert.equal(roadTypeAt(sim.state.roadTypes,p),'stone');finish(sim);assert.equal(roadTypeAt(sim.state.roadTypes,p),'brick');
 const gold=sim.state.money;
 assert.equal(execute(sim,{type:'removeStroke',from:p,to:p}).ok,true);assert.ok(sim.roads.has(key(p)));assert.equal(sim.state.money,gold);
 for(let i=0;i<4;i++)sim.step();const progress=sim.state.roadWorks[0].completed;
 execute(sim,{type:'demolish',...p});assert.equal(sim.state.roadWorks[0].completed,progress,'repeated removal does not reset work');
 finish(sim);assert.ok(!sim.roads.has(key(p)));assert.equal(sim.state.money,gold+12);
 const refunded=sim.state.money;for(let i=0;i<8;i++)sim.step();assert.equal(sim.state.money,refunded);
});
test('road progress survives reload and invalid works cannot overwrite buildings',()=>{
 let sim=town();execute(sim,{type:'roadStroke',from:{x:9,y:7},to:{x:10,y:7},roadType:'stone'});
 for(let i=0;i<120&&!sim.state.roadWorks.some(w=>w.completed>0);i++)sim.step();
 const progress=sim.state.roadWorks.map(w=>({...w}));assert.ok(progress.some(w=>w.completed>0));
 sim=new Simulation(parseSave(JSON.stringify(sim.snapshot())));assert.deepEqual(sim.state.roadWorks,progress);finish(sim);
 const bad=sim.snapshot();bad.roadWorks=[{id:bad.nextId+1,x:2,y:2,type:'stone',operation:'build',required:7,completed:0}];assert.throws(()=>parseSave(JSON.stringify(bad)),/road work/);
});
test('bridge crews extend from completed banks and decks without walking across unfinished water',()=>{
 const sim=town();sim.state.terrain['9,7']={kind:'water',height:0};sim.state.terrain['10,7']={kind:'water',height:0};sim.state.terrain['11,7']={kind:'water',height:0};
 // Water around the span: only the western bank is accessible.
 for(let y=0;y<SIZE;y++)for(let x=9;x<16;x++)sim.state.terrain[`${x},${y}`]={kind:'water',height:0};
 execute(sim,{type:'roadStroke',from:{x:9,y:7},to:{x:11,y:7},roadType:'dirt'});
 let observed=false;
 for(let i=0;i<1400&&sim.state.roadWorks.length;i++){
   sim.step();
   for(const a of sim.state.agents.filter(a=>a.roadWork!==undefined)){
     const w=sim.state.roadWorks.find(w=>w.id===a.roadWork);observed=true;
     for(const p of a.path.slice(0,-1))assert.ok(p.x<9||sim.roads.has(key(p)),`worker crosses unfinished water before ${key(w)}`);
   }
 }
 assert.ok(observed);finish(sim);assert.ok(sim.roads.has('11,7'));
 execute(sim,{type:'removeStroke',from:{x:9,y:7},to:{x:11,y:7}});
 let partlyCleared=false;
 for(let i=0;i<1200&&sim.state.roadWorks.length;i++){
   sim.step();
   if(sim.state.roadWorks.some(w=>w.completed>=w.required)){
     partlyCleared=true;assert.ok(['9,7','10,7','11,7'].every(k=>sim.roads.has(k)),'do not strand crews by removing their access before the stroke is cleared');
   }
 }
 assert.ok(partlyCleared);finish(sim);assert.ok(['9,7','10,7','11,7'].every(k=>!sim.roads.has(k)));
});
test('without available residents road work waits instead of instantly completing',()=>{
 const sim=town();sim.state.buildings=sim.state.buildings.filter(b=>b.kind==='warehouse');sim.reconnect();
 execute(sim,{type:'roadStroke',from:{x:9,y:7},to:{x:10,y:7},roadType:'dirt'});
 for(let i=0;i<100;i++)sim.step();assert.equal(sim.state.agents.filter(a=>a.roadWork!==undefined).length,0);assert.ok(sim.state.roadWorks.every(w=>w.completed===0));
});
test('road sites group connected work and expose its actual assigned crew',()=>{
 const sim=town();execute(sim,{type:'roadStroke',from:{x:9,y:7},to:{x:11,y:7},roadType:'stone'});
 execute(sim,{type:'roadStroke',from:{x:9,y:4},to:{x:10,y:4},roadType:'stone'});
 const sites=roadWorkSites(sim.state);assert.equal(sites.length,2);assert.deepEqual(sites.map(s=>s.works.length).sort(),[2,3]);
 for(let i=0;i<12;i++)sim.step();
 const ids=sites[0].works.map(w=>w.id),crew=roadWorkCrew(sim.state,ids);
 assert.ok(crew.length);assert.ok(crew.every(c=>ids.includes(c.agent.roadWork)&&c.resident.id===c.agent.resident));
 assert.ok(crew.every(c=>['Working on the road','Walking to the work'].includes(c.status)));
});
test('cars keep travelling on the original surface throughout road upgrades',()=>{
 const sim=town(),p={x:8,y:7};
 execute(sim,{type:'roadStroke',from:p,to:p,roadType:'brick'});
 assert.ok(sim.path({x:8,y:6},{x:8,y:8}));
 assert.equal(roadTypeAt(roadVisualState(sim).state.roadTypes,p),'stone','original art stays in place until work is finished');
 const home=sim.state.buildings.find(b=>b.kind==='cottage');
 const car={id:sim.state.nextId++,kind:'car',resident:null,source:home.id,target:home.id,path:[{x:8,y:6},p,{x:8,y:8}],segment:0,progress:0,wait:0,active:true,returning:false,cargo:null,amount:0};sim.state.agents.push(car);
 sim.step();sim.step();assert.ok(car.segment+car.progress>0,'car advances through an active upgrade');
 assert.ok(sim.state.roadWorks.length);assert.equal(roadTypeAt(sim.state.roadTypes,p),'stone');
});

for(const operation of ['build','upgrade','remove'])test(`${operation} crews continue to the nearest reachable tile from their last worksite`,()=>{
 const sim=town(),resident=sim.state.residents[0],home=sim.building(resident.home);
 const current={x:8,y:7},near={x:8,y:8},far={x:8,y:1};
 queueRoadWork(sim,current,'brick',operation);
 queueRoadWork(sim,far,'brick',operation); // Queue order must not win over distance.
 queueRoadWork(sim,near,'brick',operation);
 const [first,distant,nearest]=sim.state.roadWorks;first.completed=first.required-.01;
 const crew={id:sim.state.nextId++,resident:resident.id,kind:'person',source:home.id,target:home.id,path:[current],segment:0,progress:0,returning:false,wait:1,active:true,cargo:null,amount:0,roadWork:first.id};
 sim.state.agents=sim.state.agents.filter(a=>a.resident!==resident.id);sim.state.agents.push(crew);resident.job=null;
 sim.state.tick=961;stepRoadWorks(sim);
 const continued=sim.state.agents.find(a=>a.id===crew.id);
 assert.ok(continued,'same worker is retained');assert.equal(continued.roadWork,nearest.id);
 assert.deepEqual(continued.path,[current,near],'worker walks from their last worksite, not from home');
 assert.equal(distant.completed,0);assert.equal(nearest.completed,0,'no labour before arriving');
});

test('nearest road work is chosen by reachable walking route, not straight-line distance',()=>{
 const sim=town(),r=sim.state.residents[0],home=sim.building(r.home),p={x:8,y:7};
 queueRoadWork(sim,p,'brick','upgrade');queueRoadWork(sim,{x:10,y:7},'dirt','build');queueRoadWork(sim,{x:8,y:10},'dirt','build');
 const [first,blocked,reachable]=sim.state.roadWorks;first.completed=first.required-.01;
 for(const q of [{x:9,y:7},{x:11,y:7},{x:10,y:6},{x:10,y:8}])sim.state.terrain[key(q)]={kind:'water',height:0};
 const crew={id:sim.state.nextId++,resident:r.id,kind:'person',source:home.id,target:home.id,path:[p],segment:0,progress:0,returning:false,wait:1,active:true,cargo:null,amount:0,roadWork:first.id};
 sim.state.agents=sim.state.agents.filter(a=>a.resident!==r.id);sim.state.agents.push(crew);r.job=null;sim.state.tick=961;
 stepRoadWorks(sim);assert.equal(crew.roadWork,reachable.id);assert.equal(blocked.completed,0);
});
