import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave} from './legacy-town.mjs';
import {TREE_KINDS,TREE_FRAMES,nextTreeVariant,decorationArt,treeVariant} from '../.test-dist/trees.js';
import {ViewWorld} from '../.test-dist/view-world.js';
import {harvestable,treeStage,REGROW_TICKS} from '../.test-dist/forestry.js';
let serial=0;
const command=(sim,command)=>sim.execute({id:`tree-${serial++}`,actorId:'test',expectedRevision:sim.state.revision,command});
test('tree previews match placement and never repeat, including failed clicks, removal and reload',()=>{
 let sim=new Simulation();sim.state.money=100000;
 for(const kind of TREE_KINDS){
  let point;for(let y=0;y<30&&!point;y++)for(let x=0;x<30&&!point;x++)if(!sim.canPlace(kind,x,y))point={x,y};
  assert.ok(point);const seen=new Set();let last;
  for(let i=0;i<24;i++){
   const preview=nextTreeVariant(sim.state,kind);sim.state.tick++;
   assert.equal(nextTreeVariant(sim.state,kind),preview,'time does not reroll the ghost');
   assert.equal(command(sim,{type:'place',kind,...point}).ok,true);
   const tree=sim.decorationAt(point.x,point.y);assert.equal(tree.variant,preview);assert.notEqual(tree.variant,last);last=tree.variant;seen.add(last);
   const history=structuredClone(sim.state.treePlanting);
   assert.equal(command(sim,{type:'place',kind,...point}).ok,false);assert.deepEqual(sim.state.treePlanting,history);
   assert.equal(command(sim,{type:'removeDecoration',id:tree.id}).ok,true);
   if(i===10)sim=new Simulation(parseSave(JSON.stringify(sim.snapshot())));
  }
  assert.equal(seen.size,TREE_FRAMES[kind].length);
 }
});
test('saved trees retain artwork through view turns and regrowth; garden trees stay protected',()=>{
 const sim=new Simulation(),tree=sim.state.decorations.find(d=>d.natural&&d.kind==='oak');
 Object.assign(tree,{kind:'willow',variant:3,cutAt:sim.state.tick,regrowsAt:sim.state.tick+REGROW_TICKS});
 const restored=new Simulation(parseSave(JSON.stringify(sim.snapshot()))),saved=restored.state.decorations.find(d=>d.id===tree.id),art=decorationArt(saved);
 assert.equal(art.texture,'tree-variants');assert.equal(art.frame,15);assert.ok(harvestable(saved));
 assert.equal(treeStage(saved,restored.state.tick),'stump');assert.equal(treeStage(saved,restored.state.tick+REGROW_TICKS),'mature');
 const view=new ViewWorld(restored);
 for(let turn=0;turn<4;turn++){view.setTurn(turn);const rendered=view.simulation.state.decorations.find(d=>d.id===saved.id);assert.deepEqual(decorationArt(rendered),art);}
 assert.equal(harvestable({...saved,natural:false}),false);
 const original={kind:'oak',id:123,natural:false};assert.equal(decorationArt(original).texture,'garden');
 assert.equal(treeVariant({...original,natural:true}),treeVariant({...original,natural:true}));
});
test('invalid tree variants and planting histories are rejected without affecting old saves',()=>{
 const base=new Simulation().snapshot(),tree=base.decorations.find(d=>d.kind==='oak');
 assert.doesNotThrow(()=>parseSave(JSON.stringify(base)));
 for(const variant of [-1,3,1.5,'1']){const save=structuredClone(base);save.decorations.find(d=>d.id===tree.id).variant=variant;assert.throws(()=>parseSave(JSON.stringify(save)),/decoration/);}
 for(const history of [{count:-1,last:{}},{count:0,last:{oak:3}},{count:0,last:{bench:1}},{count:0,last:null}])assert.throws(()=>parseSave(JSON.stringify({...base,treePlanting:history})),/tree planting/);
});
