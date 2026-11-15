import {buildingName,buildingRecipe,isHome} from './catalog.js';
import {builderCapacity} from './construction.js';
import {isService} from './proximity.js';
import {recordTownEvent,type TownEventKind} from './town-events.js';
import type {Building,Simulation} from './simulation.js';

type Condition={state:string;message:string;kind:TownEventKind;b?:Building};
/** Require a sustained change so ordinary delivery gaps do not flood the log. */
export class TownStatusLog {
  private known=new Map<string,{state:string;candidate:string;since:number}>();
  private observe(sim:Simulation,topic:string,condition:Condition){
    let previous=this.known.get(topic);
    if(!previous){
      previous={state:sim.state.events?.find(e=>e.topic===topic)?.state??'',candidate:condition.state,since:sim.state.tick};
      this.known.set(topic,previous);
    }
    if(previous.candidate!==condition.state){previous.candidate=condition.state;previous.since=sim.state.tick;}
    if(previous.state===condition.state||sim.state.tick-previous.since<(condition.state?40:16))return;
    previous.state=condition.state;
    const event=recordTownEvent(sim.state,condition.kind,condition.message,condition.b?{buildingId:condition.b.id,tile:condition.b}:undefined);
    event.topic=topic;event.state=condition.state;
  }
  update(sim:Simulation){
    if(sim.state.tick%8!==0)return;
    const live=new Set<string>();
    for(const b of sim.state.buildings){
      if(isHome(b.kind)||(!buildingRecipe(b)&&!isService(b.kind)&&!b.construction))continue;
      const topic=`work:${b.id}`;live.add(topic);
      const name=buildingName(b),alert=sim.alert(b);
      let state='',message=b.construction?`${name}: construction can continue.`:isService(b.kind)?`${name} can welcome visitors again.`:`${name}: supplies and workers ready; work can resume.`;
      if(!b.enabled){state='paused';}
      else if(b.construction){
        if(!b.connected){state='road';message=`${name}: construction stopped. Connect its entrance to a warehouse road.`;}
        else if(!b.workers){state='workers';message=`${name}: waiting for builders. Free a resident from another job or add homes (${builderCapacity(b)} builders needed).`;}
      }else if(alert){state=alert.kind+':'+alert.title;message=`${name}: ${alert.title.toLowerCase()}. ${alert.message}`;}
      // Deliberate pause/resume already has a command entry.
      if(state==='paused'){this.known.delete(topic);continue;}
      this.observe(sim,topic,{state,message,kind:state?'shortage':'recovery',b});
    }
    for(const [need,field,advice] of [['leisure','leisure','Connect a park or tavern to their homes.'],['religion','faith','Connect a staffed church to their homes.']] as const){
      const affected=sim.state.residents.filter(r=>(r[field]??70)<25),b=sim.building(affected[0]?.home??-1);
      this.observe(sim,`town:${need}`,{state:affected.length?'low':'',kind:affected.length?'leisure':'recovery',b,message:affected.length?`${affected.length} residents need ${need}. ${advice}`:`Residents’ ${need} has recovered.`});
    }
    for(const topic of this.known.keys())if(topic.startsWith('work:')&&!live.has(topic))this.known.delete(topic);
  }
}
