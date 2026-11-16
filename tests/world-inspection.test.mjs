import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../.test-dist/simulation.js';
import {worldDetails} from '../.test-dist/world-inspection.js';
import {depositTiles} from '../.test-dist/deposits.js';
import {REGROW_TICKS} from '../.test-dist/forestry.js';
import {STEP} from '../.test-dist/catalog.js';
const fact=(d,label)=>d.facts.find(([name])=>name===label)?.[1];

test('roads and bridges report their actual material, access and speed',()=>{
 const sim=new Simulation(),point={x:30,y:30},selection={kind:'road',point};
 sim.state.roads.push('30,30');sim.reconnect();
 sim.state.terrain['30,30']={kind:'water',height:0};
 for(const [type,title,speed] of [['brick','Brick bridge','135%'],['stone','Stone bridge','100%'],['dirt','Timber bridge','75%'],['pavement','Timber footbridge','100%']]){
  sim.state.roadTypes['30,30']=type;const d=worldDetails(sim,selection);
  assert.equal(d.title,title);assert.equal(fact(d,'Travel speed'),speed);
  assert.equal(fact(d,'Access'),type==='pavement'?'Pedestrians only':'People & vehicles');
  assert.equal(d.primary.roadType,type);
 }
 sim.roads.delete('30,30');assert.equal(worldDetails(sim,selection),null);
});
test('deposit details distinguish depletion, cleared surface and a missing workplace',()=>{
 const sim=new Simulation(),selection={kind:'deposit',id:'6,32'};
 sim.state.buildings=[];sim.state.decorations=[];sim.state.roads=[];sim.state.clearedDeposits=[];sim.reconnect();
 for(const p of depositTiles(selection.id))sim.state.terrain[`${p.x},${p.y}`]={kind:'land',height:0};
 let d=worldDetails(sim,selection);assert.equal(d.primary.tool,'quarry');assert.equal(d.status,'Needs a nearby workplace');
 sim.state.deposits[selection.id]=0;sim.state.depositDepths[selection.id]=2;
 d=worldDetails(sim,selection);assert.equal(d.status,'Layer depleted');assert.equal(fact(d,'Remaining'),'0');assert.equal(fact(d,'Layer'),'3');
 sim.state.deposits[selection.id]=900;
 sim.state.clearedDeposits=depositTiles(selection.id).map(p=>`${p.x},${p.y}`);
 d=worldDetails(sim,selection);assert.equal(d.status,'Surface cleared');assert.equal(fact(d,'Exposed tiles'),'0');assert.equal(fact(d,'Remaining'),'900');
});
test('deposits link to the matching workplace, and report blocked access honestly',()=>{
 const sim=new Simulation(),quarry=sim.state.buildings.find(b=>b.kind==='quarry');
 Object.assign(quarry,{x:6,y:29,rotation:0,plot:undefined,construction:undefined});
 sim.state.buildings=[quarry];sim.state.decorations=[];sim.state.roads=[];sim.state.clearedDeposits=[];
 for(let y=20;y<40;y++)for(let x=0;x<16;x++)sim.state.terrain[`${x},${y}`]={kind:'land',height:0};
 sim.state.revision++;sim.reconnect();
 const selection={kind:'deposit',id:'6,32'};let d=worldDetails(sim,selection);
 assert.equal(fact(d,'Workplaces in reach'),'1 / 1');assert.equal(d.primary.id,quarry.id);
 for(let y=28;y<=31;y++)for(let x=5;x<=8;x++)if(!sim.buildingAt(x,y))sim.state.decorations.push({id:80000+x+y*64,kind:'planter',x,y,natural:false});
 sim.state.revision++;sim.reconnect();d=worldDetails(sim,selection);
 assert.equal(fact(d,'Workplaces in reach'),'0 / 1');assert.equal(d.status,'No walking route to the rocks');assert.equal(d.primary.id,quarry.id);
});
test('wildlife details follow the real animal and disappear when it leaves the map',()=>{
 const sim=new Simulation();sim.state.buildings=[];
 const animal={id:99000,x:5,y:5,home:{x:5,y:5},progress:0,wait:5,heading:0};sim.state.wildlife=[animal];
 const selection={kind:'wildlife',id:animal.id};
 assert.equal(worldDetails(sim,selection).status,'Grazing & resting');
 animal.to={x:6,y:5};assert.equal(worldDetails(sim,selection).status,'Roaming the woodland');
 animal.respawnAt=1000;assert.equal(worldDetails(sim,selection),null);
});
test('tree regrowth uses simulation time and provides removal as a secondary action',()=>{
 const sim=new Simulation();sim.state.tick=200;sim.state.decorations=[{id:99001,x:5,y:5,kind:'pine',natural:true,cutAt:100}];
 const d=worldDetails(sim,{kind:'decoration',id:99001});
 assert.equal(d.status,'Regrowing stump');assert.equal(fact(d,'Mature in'),`${Math.ceil((REGROW_TICKS-100)*STEP)} seconds`);
 assert.notEqual(d.primary.type,'remove-decoration');assert.equal(d.more[0].type,'remove-decoration');
});
