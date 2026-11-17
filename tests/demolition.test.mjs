import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {buildingInvestment} from '../.test-dist/catalog.js';
import {planRemoval} from '../.test-dist/removal.js';
const command=(s,c)=>s.execute({id:Math.random().toString(),expectedRevision:s.state.revision,command:c});
function town(){const s=new Simulation();for(const b of s.state.buildings)b.enabled=false;s.earn=()=>{};s.reconnect(true);return s;}
test('demolition waits for real arriving workers, keeps its footprint and returns stock and gold once',()=>{
 const s=town(),b=s.state.buildings.find(b=>b.kind==='workshop'),id=b.id;b.inventory={tools:42};const before=s.stored('tools'),gold=s.state.money,refund=Math.floor(buildingInvestment(b)/2);
 assert.ok(command(s,{type:'demolish',x:b.x,y:b.y}).ok);assert.ok(s.buildingAt(b.x,b.y));assert.equal(b.construction.completed,0);assert.equal(s.state.money,gold);assert.equal(s.stored('tools'),before);
 assert.match(s.canMove(id,30,30),/demolished/);assert.match(s.canPlace('cottage',b.x,b.y),/overlaps/);
 s.state.agents=[];for(let i=0;i<20;i++)s.step();assert.equal(b.construction.completed,0,'no onsite crew means no progress');
 s.reconnect();let sawTravel=false,sawWork=false;for(let i=0;i<1800&&s.building(id);i++){s.step();sawTravel ||= s.state.agents.some(a=>a.target===id&&a.active);sawWork ||= (b.construction?.completed??0)>0;}
 assert.ok(sawTravel);assert.ok(sawWork);assert.equal(s.building(id),undefined);assert.equal(s.buildingAt(b.x,b.y),undefined);assert.equal(s.stored('tools'),before+42);assert.equal(s.state.money,gold+refund);
 for(let i=0;i<20;i++)s.step();assert.equal(s.state.money,gold+refund);assert.equal(s.stored('tools'),before+42);
});
test('farm demolition survives reloading, duplicate removal and pausing without becoming an open farm',()=>{
 const s=town(),b=s.state.buildings.find(b=>b.kind==='farm');assert.ok(command(s,{type:'demolish',x:b.x,y:b.y}).ok);b.construction.completed=5;
 assert.ok(command(s,{type:'demolish',x:b.x,y:b.y}).ok);assert.equal(b.construction.completed,5);
 const loaded=new Simulation(parseSave(JSON.stringify(s.snapshot()))),restored=loaded.building(b.id);assert.equal(restored.construction.demolition,true);assert.equal(restored.construction.completed,5);
 command(loaded,{type:'toggle',id:b.id});for(let i=0;i<20;i++)loaded.step();assert.equal(restored.construction.completed,5);assert.match(loaded.alert(restored).title,/Demolishing/);
});
test('queued warehouse demolition cannot remove the last functioning depot',()=>{
 const s=new Simulation(),warehouses=s.state.buildings.filter(b=>b.kind==='warehouse');
 for(const w of warehouses.slice(0,-1))assert.ok(command(s,{type:'demolish',x:w.x,y:w.y}).ok);
 const last=warehouses.at(-1),result=command(s,{type:'demolish',x:last.x,y:last.y});assert.equal(result.ok,false);assert.match(result.message,/finished warehouse/);
});

test('clearing woodland past a gatherer hut never queues the hut for demolition',()=>{
 const s=town(),hut=s.state.buildings.find(b=>b.kind==='gatherer');
 hut.x=50;hut.y=3;s.reconnect(true);
 const from={x:hut.x,y:hut.y-1},to={x:hut.x,y:hut.y+1};
 const trees=[from,to].map(p=>({id:s.state.nextId++,kind:'pine',natural:true,...p}));s.state.decorations.push(...trees);
 const plan=planRemoval(s,from,to);
 assert.equal(plan.buildings.size,0);assert.equal(plan.roads.size,0);assert.ok(trees.every(t=>plan.decorations.has(t.id)));
 const before=structuredClone(hut);
 assert.equal(command(s,{type:'removeStroke',from,to}).ok,true);
 assert.deepEqual(hut,before);assert.ok(s.building(hut.id));assert.ok(trees.every(t=>!s.state.decorations.some(d=>d.id===t.id)));
});

test('road removal skips buildings and a directly clicked decoration never becomes a building target',()=>{
 const s=town(),hut=s.state.buildings.find(b=>b.kind==='gatherer'),from={x:hut.x-1,y:hut.y};
 assert.ok(s.roads.has(`${from.x},${from.y}`));
 const plan=planRemoval(s,from,hut);assert.equal(plan.buildings.size,0);assert.equal(plan.roads.size,1);
 assert.equal(command(s,{type:'removeStroke',from,to:hut}).ok,true);assert.ok(!hut.construction);
 const tree={id:s.state.nextId++,kind:'pine',natural:true,x:hut.x,y:hut.y};s.state.decorations.push(tree);
 assert.equal(planRemoval(s,hut,hut,'decorations').buildings.size,0);
 assert.equal(command(s,{type:'removeDecoration',id:tree.id}).ok,true);assert.ok(s.building(hut.id));assert.ok(!hut.construction);
});

test('deliberate building demolition names the hut in the town log',()=>{
 const s=town(),hut=s.state.buildings.find(b=>b.kind==='gatherer');
 const result=command(s,{type:'removeStroke',from:hut,to:hut});
 assert.ok(result.ok);assert.match(result.message,/Gatherer.*hut marked for demolition/);
 assert.ok(hut.construction.demolition);
});
