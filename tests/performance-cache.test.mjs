import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../.test-dist/simulation.js';
import {RoadPathCache} from '../.test-dist/road-path-cache.js';
import {roadHeight,RoadHeightCache} from '../.test-dist/bridges.js';
import {ViewWorld} from '../.test-dist/view-world.js';

test('route reuse preserves paths and isolates callers while bounding memory',()=>{
 const cache=new RoadPathCache();let searches=0;
 const search=()=>{searches++;return [{x:0,y:0},{x:1,y:0}];};
 const first=cache.find('a',search);first.reverse();first[0].x=100;
 assert.deepEqual(cache.find('a',search),[{x:0,y:0},{x:1,y:0}]);assert.equal(searches,1);
 for(let i=0;i<1100;i++)cache.find('missing'+i,()=>null);
 assert.ok(cache.entries.size<=1024);cache.find('a',search);assert.equal(searches,2);
 for(let i=0;i<300;i++)cache.find('long'+i,()=>Array.from({length:100},(_,x)=>({x,y:i})));
 assert.ok(cache.points<=20000);assert.ok(cache.entries.size<=1024);
 cache.clear();assert.equal(cache.points,0);assert.equal(cache.entries.size,0);
});

test('road edits, height changes and pedestrian-only roads invalidate cached routes',()=>{
 const sim=new Simulation();sim.state.roads=['1,1','2,1','3,1','1,2','2,2','3,2'];sim.state.roadTypes={};sim.state.terrain={};sim.reconnect();
 const from={x:1,y:1},to={x:3,y:1};assert.equal(sim.path(from,to,'truck').length,3);
 sim.state.roadTypes['2,1']='pavement';sim.reconnect(true);
 assert.equal(sim.path(from,to,'truck').length,5);assert.equal(sim.path(from,to,'person').length,3);
 sim.state.roads=sim.state.roads.filter(k=>k!=='2,2');sim.reconnect(true);
 assert.equal(sim.path(from,to,'truck'),null);
 sim.state.roadTypes['2,1']='stone';sim.state.revision++;
 assert.equal(sim.path(from,to,'truck').length,3);
 sim.state.terrain['2,1']={kind:'land',height:3};sim.reconnect(true);
 assert.equal(sim.path(from,to,'person'),null);
 sim.state.terrain['2,1']={kind:'land',height:0};sim.state.revision++;
 assert.equal(sim.path(from,to,'person').length,3);
});

test('road height cache exactly matches existing ramps, slopes and all rotated views',()=>{
 const sim=new Simulation(),view=new ViewWorld(sim),cache=new RoadHeightCache();
 // Include varying land heights, a bridge with multiple landings and real fishery banks.
 sim.state.roads.push('40,40','41,40','42,40','41,39','41,41');
 for(const [k,kind,height] of [['40,40','land',0],['41,40','water',0],['42,40','land',2],['41,39','land',0],['41,41','land',1]])sim.state.terrain[k]={kind,height};
 sim.reconnect();
 for(let turn=0;turn<4;turn++){
  view.setTurn(turn);const v=view.simulation;
  for(const key of v.state.roads){const [x,y]=key.split(',').map(Number);
   for(const dx of [-.49,-.25,0,.23,.49])for(const dy of [-.49,0,.49]){
    const expected=roadHeight(v.roads,x+dx,y+dy,v.state.buildings,v.state.terrain);
    assert.equal(cache.height(v,x+dx,y+dy),expected,`${turn}:${key}:${dx},${dy}`);
   }
  }
 }
 const before=cache.height(sim,42,40);sim.state.terrain['42,40'].height=3;sim.state.revision++;
 assert.equal(cache.height(sim,42,40),roadHeight(sim.roads,42,40,sim.state.buildings,sim.state.terrain));assert.notEqual(cache.height(sim,42,40),before);
});

test('cached road searches leave the simulation outcome unchanged',()=>{
 const a=new Simulation(),b=new Simulation(a.snapshot());
 b.path=(...args)=>b.findRoadPath(...args);
 // Use the same canonical starting state; fresh reconnect starts travel differently from restore.
 const baseline=new Simulation(b.snapshot()),cached=new Simulation(b.snapshot());baseline.path=(s,e,k='person')=>baseline.findRoadPath(s,e,k);
 for(let i=0;i<160;i++){baseline.step();cached.step();}
 assert.deepEqual(cached.snapshot(),baseline.snapshot());
});
