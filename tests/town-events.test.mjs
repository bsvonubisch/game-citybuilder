import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,parseSave} from '../.test-dist/simulation.js';
import {recordTownEvent,restoreTownEvents,TOWN_EVENT_LIMIT} from '../.test-dist/town-events.js';
const execute=(s,command,id=Math.random().toString())=>s.execute({id,expectedRevision:s.state.revision,command});
test('construction completion logs the real finished building and new residents only once',()=>{
 const s=new Simulation();for(const b of s.state.buildings)b.enabled=false;
 assert.ok(execute(s,{type:'place',kind:'cottage',x:12,y:24,rotation:1}).ok);const home=s.buildingAt(12,24);assert.ok(home.construction);assert.ok(s.state.events.some(e=>e.kind==='construction'&&e.buildingId===home.id));assert.ok(!s.state.events.some(e=>e.kind==='arrival'&&e.buildingId===home.id));
 for(let i=0;i<1600&&home.construction;i++)s.step();assert.equal(home.construction,undefined);
 const completed=s.state.events.filter(e=>e.message==='Little cottage construction completed.'&&e.buildingId===home.id);assert.equal(completed.length,1);assert.equal(completed[0].tick,s.state.tick);assert.deepEqual(completed[0].tile,{x:12,y:24});
 const arrivals=s.state.events.filter(e=>e.kind==='arrival'&&e.buildingId===home.id);assert.equal(arrivals.length,1);assert.match(arrivals[0].message,/2 residents moved into/);
 const before=s.state.events.length;s.reconnect(true);s.reconnect(true);assert.equal(s.state.events.length,before);
 const loaded=new Simulation(parseSave(JSON.stringify(s.snapshot())));assert.deepEqual(loaded.state.events,s.state.events,'reload does not invent new arrivals');
});
test('demolition records departure rather than death, only after the crew finishes',()=>{
 const s=new Simulation();for(const b of s.state.buildings)b.enabled=false;const home=s.state.buildings.find(b=>b.kind==='cottage');assert.ok(execute(s,{type:'demolish',x:home.x,y:home.y}).ok);assert.ok(!s.state.events.some(e=>e.kind==='departure'));
 for(let i=0;i<1600&&s.building(home.id);i++)s.step();assert.equal(s.building(home.id),undefined);assert.equal(s.state.events.filter(e=>e.kind==='departure').length,1);assert.match(s.state.events.find(e=>e.kind==='departure').message,/moved away/);assert.ok(s.state.events.some(e=>e.message.includes('demolished')&&e.tile.x===home.x));
});
test('events remain bounded, migrate older history and discard only malformed log metadata',()=>{
 const w={tick:90,history:['Old construction finished.','Welcome.']};restoreTownEvents(w);assert.equal(w.events.length,2);assert.equal(w.events[0].tick,undefined);
 for(let i=0;i<130;i++)recordTownEvent(w,'notice','Event '+i,{tile:{x:2,y:3}});assert.equal(w.events.length,TOWN_EVENT_LIMIT);assert.equal(w.events[0].message,'Event 129');assert.ok(w.events.every(e=>e.tick===90));
 w.events.unshift({id:999,kind:'notice',message:'<img src=x onerror=alert(1)>',tick:90,tile:{x:Infinity,y:1}});w.events.push({id:1,kind:'fake',message:2});restoreTownEvents(w);assert.equal(w.events[0].message,'<img src=x onerror=alert(1)>');assert.equal(w.events[0].tile,undefined);assert.ok(w.events.every(e=>e.kind==='notice'));
});
test('failed and duplicate commands do not add repeated journal entries',()=>{
 const s=new Simulation();const command={type:'toggle',id:s.state.buildings.find(b=>b.kind==='workshop').id};assert.ok(execute(s,command,'same-command').ok);const count=s.state.events.length;execute(s,command,'same-command');assert.equal(s.state.events.length,count);
 const b=s.state.buildings[0];assert.equal(execute(s,{type:'place',kind:'house',x:b.x,y:b.y}).ok,false);assert.equal(s.state.events.length,count);
});
