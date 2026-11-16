import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeProfile} from '../.test-dist/bridge-profile.js';
import {turnPoint,markView,sourcePoint} from '../.test-dist/view-space.js';
const make=()=>{const roads=new Set(),terrain={},roadTypes={};for(let x=8;x<=15;x++){const k=`${x},10`;roads.add(k);terrain[k]={kind:x===8||x===15?'land':'water',height:0};roadTypes[k]='stone';}return{roads,state:{terrain,roadTypes}};};
test('two bridge tiles share one arch, including reversed rail direction',()=>{
 const sim=make(),sample=x=>bridgeProfile(sim,{x,y:10},{x:x-.5,y:10.5},{x:x+.5,y:10.5});
 assert.deepEqual(sample(9),{from:0,to:.5});assert.deepEqual(sample(10),{from:.5,to:1});assert.deepEqual(sample(11),{from:0,to:.5});
 assert.deepEqual(bridgeProfile(sim,{x:10,y:10},{x:10.5,y:10.5},{x:9.5,y:10.5}),{from:1,to:.5});
 sim.state.roadTypes['10,10']='brick';assert.deepEqual(sample(11),{from:0,to:.5},'a new material starts a new arch repeat');
});
test('camera turns keep the same arch piers on physical map coordinates',()=>{
 const sim=make(),tile={x:10,y:10},a={x:9.5,y:10.5},b={x:10.5,y:10.5};
 for(let turn=0;turn<4;turn++){
  const view=markView({},sim.state,turn),project=p=>sourcePoint(view,turnPoint(p,turn));
  assert.deepEqual(bridgeProfile(sim,project(tile),project(a),project(b)),{from:.5,to:1});
 }
});

test('short and odd-length bridges close their arch at both shore ramps in every view',()=>{
 for(const axis of ['x','y'])for(let length=1;length<=9;length++){
  const roads=new Set(),terrain={},roadTypes={},point=n=>axis==='x'?{x:n,y:10}:{x:10,y:n};
  for(let n=7;n<=8+length;n++){const p=point(n),k=`${p.x},${p.y}`;roads.add(k);terrain[k]={kind:n===7||n===8+length?'land':'water',height:0};roadTypes[k]='brick';}
  const sim={roads,state:{terrain,roadTypes}};
  for(let turn=0;turn<4;turn++){
   const view=markView({},sim.state,turn),project=p=>sourcePoint(view,turnPoint(p,turn));
   let previous=1;
   for(let n=8;n<8+length;n++){
    const tile=point(n),a=point(n-.5),b=point(n+.5),profile=bridgeProfile(sim,project(tile),project(a),project(b));
    assert.ok(profile.from>=0&&profile.to<=1,'never sample outside the complete painted arch');
    assert.equal(profile.from,previous===1?0:previous,'neighboring pieces share their exact arch edge');
    assert.deepEqual(bridgeProfile(sim,project(tile),project(b),project(a)),{from:profile.to,to:profile.from});
    previous=profile.to;
   }
   assert.equal(previous,1,'the final shore has a full pier, never a severed half arch');
  }
 }
});
