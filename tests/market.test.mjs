import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {marketLayout,marketPrice,validMarketPlot} from '../.test-dist/market-layout.js';
import {marketVendors,buyAtMarket} from '../.test-dist/market.js';
import {buildingJobs,footprint} from '../.test-dist/catalog.js';
function fixture(){const sim=new Simulation();sim.state.money=100000;Object.assign(sim.state.buildings.find(b=>b.kind==='warehouse').inventory,{wood:1000,stone:1000,planks:1000,bread:100,fish:100});return sim;}
const command=(sim,c)=>sim.execute({id:'market-'+sim.state.revision,actorId:'test',expectedRevision:sim.state.revision,command:c});
test('all 1–5 market dimensions keep stalls, vendors and customers within their rotated footprint',()=>{
 for(let w=1;w<=5;w++)for(let h=1;h<=5;h++)for(let rotation=0;rotation<4;rotation++){
  const b={x:10,y:10,rotation,plot:[w,h]},layout=marketLayout(b);
  assert.ok(layout.length);for(const slot of layout)for(const p of [slot.stall,slot.vendor,slot.customer])assert.ok(p.x>=9.5&&p.x<10+w-.5&&p.y>=9.5&&p.y<10+h-.5,JSON.stringify({w,h,rotation,p}));
 }
 assert.equal(marketLayout({x:0,y:0,rotation:0,plot:[1,1]}).length,1);assert.equal(marketLayout({x:0,y:0,rotation:0,plot:[5,5]}).length,12);
 assert.equal(validMarketPlot([0,2]),false);assert.equal(validMarketPlot([6,5]),false);assert.equal(validMarketPlot([2.5,3]),false);
});
test('configured market placement pays matching materials, builds every tile, saves and rotates without losing stock',()=>{
 const sim=fixture(),before=sim.stored('stone'),gold=sim.state.money,plot=[3,2],price=marketPrice(plot);
 const result=command(sim,{type:'place',kind:'market',x:7,y:21,plot});assert.equal(result.ok,true,result.message);
 const market=sim.state.buildings.find(b=>b.kind==='market');assert.deepEqual(market.plot,plot);assert.equal(sim.stored('stone'),before-price.materials.stone);assert.equal(sim.state.money,gold-price.cost);assert.equal(footprint('market',7,21,0,plot).length,6);
 assert.deepEqual(parseSave(JSON.stringify(sim.snapshot())).buildings.find(b=>b.kind==='market').plot,plot);
 assert.equal(command(sim,{type:'place',kind:'market',x:30,y:4,plot:[6,1]}).ok,false);
 delete market.construction;market.inventory.bread=8;sim.reconnect(true);
 const moved=command(sim,{type:'move',id:market.id,x:7,y:21,rotation:1});assert.equal(moved.ok,true,moved.message);assert.deepEqual(market.plot,[2,3]);assert.equal(market.inventory.bread,8);
});
test('real vendors arrive, shoppers buy delivered stock, and purchases create income and meals',()=>{
 const sim=fixture();assert.equal(command(sim,{type:'place',kind:'market',x:7,y:21,plot:[2,2]}).ok,true);
 const market=sim.state.buildings.find(b=>b.kind==='market');delete market.construction;sim.reconnect(true);
 let sawVendor=false,sawCustomer=false,sawDelivery=false;
 for(let i=0;i<1600;i++){sim.step();sawVendor||=marketVendors(sim,market).length>0;sawCustomer||=sim.state.agents.some(a=>a.marketSlot!==undefined);sawDelivery||=sim.state.agents.some(a=>a.kind==='truck'&&a.target===market.id);}
 assert.equal(buildingJobs(market),2);assert.ok(sawVendor);assert.ok(sawCustomer);assert.ok(sawDelivery);assert.ok(market.produced>0);assert.ok(sim.state.income.some(e=>e.source==='market'));assert.doesNotThrow(()=>new Simulation(parseSave(JSON.stringify(sim.snapshot()))));
});
test('unstaffed, closed, or empty markets cannot invent purchases',()=>{
 const sim=fixture();command(sim,{type:'place',kind:'market',x:7,y:21,plot:[1,1]});const b=sim.state.buildings.find(b=>b.kind==='market');delete b.construction;b.inventory={bread:4};sim.reconnect(true);sim.state.tick=100;
 const r=sim.state.residents.find(r=>r.job!==b.id),a=sim.state.agents.find(a=>a.resident===r.id),money=sim.state.money;
 assert.equal(buyAtMarket(sim,a,b,r),false);assert.equal(b.inventory.bread,4);assert.equal(sim.state.money,money);
});
