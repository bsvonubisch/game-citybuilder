import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave} from './legacy-town.mjs';
import {DEPOSITS,depositTiles,depositAt,buildingDeposit,nearbyDeposits,INITIAL_RESERVE,exposedDeposit} from '../.test-dist/deposits.js';
import {miningTargets,stepMining,validMiningTrip} from '../.test-dist/mining.js';
import {footprint} from '../.test-dist/catalog.js';
let sequence=0;
const command=(sim,command)=>sim.execute({id:`mine-${sequence++}`,expectedRevision:sim.state.revision,command});

test('compact multi-tile geology has large reserves and workplaces fit beside it',()=>{
  const sim=new Simulation();
  for(const [anchor,resource] of Object.entries(DEPOSITS)) {
    const patch=depositTiles(anchor);
    assert.ok(patch.length>=2&&patch.length<=5);
    assert.equal(sim.state.deposits[anchor],60000);
    for(const p of patch)assert.equal(depositAt(p),anchor);
  }
  assert.ok(sim.canPlace('quarry',6,32));
  assert.equal(sim.canPlace('quarry',6,29),null);
  assert.equal(command(sim,{type:'place',kind:'quarry',x:6,y:29}).ok,true);
  const b=sim.buildingAt(6,29);
  assert.equal(buildingDeposit(b),'6,32');
  assert.ok(footprint(b.kind,b.x,b.y,b.rotation).every(p=>!depositAt(p)));
  assert.ok(sim.canPlace('mine',28,55),'wrong resource / outside reach');
});

test('actual miners reserve faces, extract once, and carry ore back before production counts it',()=>{
  const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='mine');
  const anchor=buildingDeposit(b),seen=new Set();
  assert.ok(miningTargets(sim,b).length>=2);
  for(let i=0;i<1600;i++) {
    sim.step();
    const trips=b.mining??[],faces=trips.filter(t=>t.phase!=='returning').map(t=>`${t.rock.x},${t.rock.y}`);
    assert.equal(new Set(faces).size,faces.length);
    for(const trip of trips) {
      seen.add(trip.phase);
      assert.ok(sim.state.agents.some(a=>a.resident===trip.resident&&a.onsite===b.id));
      assert.ok(trip.path.every(p=>!sim.buildingAt(Math.round(p.x),Math.round(p.y))));
    }
    assert.equal(b.produced+trips.reduce((n,t)=>n+t.cargo,0),nearbyDeposits(b).reduce((n,id)=>n+INITIAL_RESERVE-sim.state.deposits[id],0));
  }
  assert.deepEqual([...seen].sort(),['mining','outbound','returning']);
  assert.ok(b.produced>0);
});

test('mining cargo survives reload without extracting twice; old geology migrates once',()=>{
  const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='mine');
  for(let i=0;i<1000&&!b.mining?.some(t=>t.cargo);i++)sim.step();
  const cargo=b.mining.reduce((n,t)=>n+t.cargo,0);
  assert.ok(cargo>0);
  const saved=sim.snapshot(),reserve=saved.deposits[b.deposit];
  saved.agents=[];
  const restored=parseSave(JSON.stringify(saved)),mine=restored.buildings.find(c=>c.id===b.id);
  assert.equal(mine.inventory.metal,(b.inventory.metal??0)+cargo);
  assert.equal(mine.mining,undefined);
  assert.equal(restored.deposits[b.deposit],reserve);
  const old=new Simulation().snapshot();delete old.geologyVersion;
  old.deposits['19,4']=5943;old.deposits['19,7']=0;
  const migrated=parseSave(JSON.stringify(old));
  assert.equal(migrated.deposits['19,4'],59943);
  assert.equal(migrated.deposits['19,7'],0,'exhausted deposits still need deeper excavation');
  assert.deepEqual(parseSave(JSON.stringify(migrated)).deposits,migrated.deposits);
});

test('building on rocks queues real clearance labour, persists it and preserves underground reserves',()=>{
  const sim=new Simulation();
  assert.equal(command(sim,{type:'place',kind:'house',x:6,y:31}).ok,true);
  const site=sim.buildingAt(6,31),tiles=site.construction.clearance.tiles.map(p=>({...p}));
  const reserve=sim.state.deposits['6,32'];
  for(let i=0;i<30;i++)sim.step();
  assert.equal(site.construction.completed,0,'no road / no builders means no clearance');
  assert.ok(tiles.every(p=>exposedDeposit(sim.state,p)));
  const a=sim.state.agents.find(a=>a.resident),resident=sim.state.residents.find(r=>r.id===a.resident);
  resident.job=site.id;a.onsite=site.id;site.connected=true;site.workers=1;
  for(let i=0;i<400&&site.construction.clearance;i++)sim.step();
  assert.equal(site.construction.clearance,undefined);
  assert.ok(site.construction,'foundations still need construction work');
  assert.ok(tiles.every(p=>!exposedDeposit(sim.state,p)));
  assert.equal(sim.state.deposits['6,32'],reserve);
  const restored=parseSave(JSON.stringify(sim.snapshot()));
  assert.deepEqual(restored.clearedDeposits,sim.state.clearedDeposits);
  assert.equal(command(sim,{type:'demolish',x:6,y:31}).ok,true);
  assert.ok(tiles.every(p=>!exposedDeposit(sim.state,p)),'rocks stay cleared after demolition');
  assert.equal(site.construction.demolition,true);
  assert.match(sim.canPlace('road',6,32),/overlaps/, 'demolition occupies the footprint until its crew finishes');
});

test('save rejects forged mining cargo and invalid clearing cells',()=>{
  const sim=new Simulation(),saved=sim.snapshot(),b=saved.buildings.find(b=>b.kind==='mine');
  b.mining=[{resident:1,deposit:b.deposit,rock:{x:19,y:6},path:[{x:20,y:6}],distance:0,phase:'returning',work:6,cargo:1000}];
  assert.throws(()=>parseSave(JSON.stringify(saved)),/mining/);
  delete b.mining;saved.clearedDeposits=['1,1'];
  assert.throws(()=>parseSave(JSON.stringify(saved)),/cleared/);
});

test('miners reach deposits through dense natural woodland, without walking through trunks',()=>{
  const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='mine');
  Object.assign(b,{x:34,y:16,rotation:0,deposit:'37,19',connected:true,inventory:{},mining:[]});
  sim.state.buildings=[b];sim.state.decorations=[];
  for(let y=14;y<=22;y++)for(let x=32;x<=40;x++)if(!sim.buildingAt(x,y)&&!depositAt({x,y}))sim.state.decorations.push({id:10000+y*64+x,kind:'pine',x,y,natural:true});
  sim.state.revision++;
  const targets=miningTargets(sim,b);
  assert.ok(targets.length>=4);
  for(const t of targets){
    assert.equal(t.deposit,'37,19');
    assert.ok(validMiningTrip({...t,resident:1,distance:0,phase:'outbound',work:0,cargo:0}));
    assert.ok(t.path.every(p=>sim.state.decorations.every(d=>Math.hypot(p.x-d.x,p.y-d.y)>.15)));
  }
  const agent=sim.state.agents.find(a=>a.resident),resident=sim.state.residents.find(r=>r.id===agent.resident);
  resident.job=b.id;agent.onsite=b.id;
  for(let i=0;i<600;i++)stepMining(sim,b);
  assert.ok(b.produced>0,'ore returns to the workplace');
  sim.state.terrain??={};for(let y=8;y<=26;y++)sim.state.terrain[`${36},${y}`]={kind:'water',height:0};
  sim.state.revision++;
  assert.equal(miningTargets(sim,b).length,0,'water still blocks the route');
});

test('a covered nearest seam does not hide other matching deposits within reach',()=>{
  const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='mine'),blocker=sim.state.buildings.find(b=>b.kind==='quarry');
  Object.assign(b,{x:22,y:2,rotation:3,deposit:'19,5'});
  sim.state.buildings=[b,blocker,sim.state.buildings.find(c=>c.kind==='warehouse')];sim.state.decorations=[];sim.state.residents=[];sim.state.agents=[];sim.state.revision++;
  const targets=miningTargets(sim,b);
  assert.ok(targets.length>0);
  assert.ok(targets.every(t=>t.deposit!=='19,5'&&DEPOSITS[t.deposit]==='metal'));
  const target=targets[0];
  b.mining=[{...target,resident:1,distance:0,phase:'returning',work:6,cargo:6}];
  const restored=parseSave(JSON.stringify(sim.snapshot())).buildings.find(c=>c.id===b.id);
  assert.equal(restored.inventory.metal,6,'cargo from a secondary seam survives reload');
});

test('surface clearance opens walking space but never becomes an invisible mining face',()=>{
  const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='mine');
  const targets=miningTargets(sim,b),target=targets[0];assert.ok(target);
  sim.state.clearedDeposits??=[];sim.state.clearedDeposits.push(`${target.rock.x},${target.rock.y}`);
  const after=miningTargets(sim,b);
  assert.ok(after.every(t=>t.rock.x!==target.rock.x||t.rock.y!==target.rock.y));
  assert.ok(after.length>0);
});

test('legacy quarry can work an exposed face directly beside its foundation',()=>{
  const sim=new Simulation(),b=sim.state.buildings.find(b=>b.kind==='quarry');
  const direct=miningTargets(sim,b).find(t=>t.path.length===1);
  assert.ok(direct,'an adjacent face needs no walk around the entire rock formation');
  assert.ok(!sim.buildingAt(Math.round(direct.path[0].x),Math.round(direct.path[0].y)));
});
