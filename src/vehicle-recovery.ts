import {STEP} from './catalog.js';
import type {Agent} from './simulation.js';

export const VEHICLE_RECOVERY_SECONDS=10;
/** Actual motion, not queue age: crawling traffic and deliberate visits are safe. */
export class StoppedVehicles {
  private samples=new Map<number,{path:Agent['path'];distance:number;seconds:number}>();
  update(agents:readonly Agent[]) {
    const visible=new Set<number>();let candidate:Agent|undefined,oldest=VEHICLE_RECOVERY_SECONDS;
    for(const a of agents) {
      if(a.kind==='person'||a.active!==true||a.wait>0||a.onsite!==undefined||a.path.length<2)continue;
      visible.add(a.id);const distance=a.segment+a.progress,previous=this.samples.get(a.id);
      const seconds=previous&&previous.path===a.path&&Math.abs(distance-previous.distance)<.0001?previous.seconds+STEP:0;
      this.samples.set(a.id,{path:a.path,distance,seconds});
      if(seconds>oldest){candidate=a;oldest=seconds;}
    }
    for(const id of this.samples.keys())if(!visible.has(id))this.samples.delete(id);
    // Recover one offender per tick, allowing its neighbours to start moving.
    if(candidate)this.samples.delete(candidate.id);
    return candidate;
  }
}
