import test from 'node:test';import assert from 'node:assert/strict';
import {StoppedVehicles} from '../.test-dist/vehicle-recovery.js';import {Simulation} from '../.test-dist/simulation.js';
const car=()=>({id:1,kind:'car',path:[{x:0,y:0},{x:1,y:0}],segment:0,progress:.5,active:true,wait:0});
test('only a visible vehicle stopped longer than ten seconds is recovered',()=>{
 const tracker=new StoppedVehicles(),a=car();for(let i=0;i<=40;i++)assert.equal(tracker.update([a]),undefined);assert.equal(tracker.update([a]),a);
 for(const change of [{kind:'person'},{wait:20},{active:false},{onsite:8}]){const s=new StoppedVehicles(),b={...car(),...change};for(let i=0;i<80;i++)assert.equal(s.update([b]),undefined);}
 const slow=new StoppedVehicles(),b=car();for(let i=0;i<100;i++){b.progress+=.001;assert.equal(slow.update([b]),undefined);}
 const resumed=new StoppedVehicles(),c=car();for(let i=0;i<30;i++)resumed.update([c]);c.progress+=.1;for(let i=0;i<30;i++)assert.equal(resumed.update([c]),undefined);
});
test('a stuck truck retries from its source with the same cargo and delivers exactly once',()=>{
 const s=new Simulation();for(const b of s.state.buildings)b.enabled=false;
 const source=s.state.buildings.find(b=>b.kind==='warehouse'),target=s.state.buildings.find(b=>b.kind==='brickworks'),path=s.route(source,target,'truck');assert.ok(path.length>2);
 const a={id:s.state.nextId++,kind:'truck',path,segment:1,progress:.2,resident:null,source:source.id,target:target.id,cargo:'wood',amount:7,returning:false,wait:0,active:true,move:0};s.state.agents=[a];target.inventory.wood=0;
 const plan=s.traffic.plan.bind(s.traffic);s.traffic.plan=agents=>{plan(agents);a.move=0;a.active=a.wait<=0;};
 const deliveries=s.state.delivered;for(let i=0;i<42;i++)s.step();assert.equal(a.segment,0);assert.equal(a.progress,0);assert.equal(a.active,false);assert.ok(a.wait>0);assert.equal(a.amount,7);assert.equal(a.target,target.id);assert.equal(target.inventory.wood,0);assert.equal(s.state.delivered,deliveries);
 s.traffic.plan=plan;for(let i=0;i<300&&s.state.agents.includes(a);i++)s.step();assert.ok(!s.state.agents.includes(a));assert.equal(target.inventory.wood,7);assert.equal(s.state.delivered,deliveries+7);
});
test('returning cars retain their resident and correct return destination',()=>{
 const s=new Simulation(),a=s.state.agents.find(a=>a.kind==='car');assert.ok(a);a.returning=true;a.path=s.route(s.building(a.target),s.building(a.source),'car');const home=a.source,job=a.target,resident=a.resident;
 a.active=true;a.segment=1;a.progress=.3;s.recoverVehicle(a);assert.equal(a.source,home);assert.equal(a.target,job);assert.equal(a.resident,resident);assert.equal(a.returning,true);assert.deepEqual(a.path,s.route(s.building(job),s.building(home),'car'));assert.equal(a.active,false);
});
