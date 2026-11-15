import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {DEPOSITS,depositTiles,depositAt,buildingDeposit,INITIAL_RESERVE,exposedDeposit} from '../.test-dist/deposits.js';
import {miningTargets} from '../.test-dist/mining.js';
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
      assert.ok(trip.path.every(p=>!sim.buildingAt(p.x,p.y)));
    }
    assert.equal(b.produced+trips.reduce((n,t)=>n+t.cargo,0),INITIAL_RESERVE-sim.state.deposits[anchor]);
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
  assert.equal(sim.canPlace('road',6,32),null);
});

test('save rejects forged mining cargo and invalid clearing cells',()=>{
  const sim=new Simulation(),saved=sim.snapshot(),b=saved.buildings.find(b=>b.kind==='mine');
  b.mining=[{resident:1,deposit:b.deposit,rock:{x:19,y:6},path:[{x:20,y:6}],distance:0,phase:'returning',work:6,cargo:1000}];
  assert.throws(()=>parseSave(JSON.stringify(saved)),/mining/);
  delete b.mining;saved.clearedDeposits=['1,1'];
  assert.throws(()=>parseSave(JSON.stringify(saved)),/cleared/);
});
