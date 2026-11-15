import {stepRoadWorks} from '../.test-dist/roadworks.js';
/** Geometry, pricing and connectivity fixtures need finished roads without
 * advancing taxes, production or their captured travellers. Supply a crew at
 * the final labour step. Actual walking/labour is covered in roadworks.test. */
export function finishRoadFixture(sim){
 for(const w of sim.state.roadWorks??[]){
  const resident={id:sim.state.nextId++,name:'Fixture road crew',home:sim.state.buildings.find(b=>b.kind==='warehouse').id,job:null};
  sim.state.residents.push(resident);
  sim.state.agents.push({id:sim.state.nextId++,kind:'person',resident:resident.id,source:resident.home,target:resident.home,path:[{x:w.x,y:w.y}],segment:0,progress:0,wait:1,active:true,returning:false,cargo:null,amount:0,roadWork:w.id});
  w.completed=w.required;
 }
 if(sim.state.roadWorks?.length)stepRoadWorks(sim);
}
