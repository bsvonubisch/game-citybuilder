import {ROAD_TYPES,BRIDGE_TYPES} from './roads.js';
import {terrainCell} from './terrain.js';
import type {World,Point} from './simulation.js';
import type {RoadWork} from './roadworks.js';

export interface RoadWorkSite {id:number;works:RoadWork[];anchor:Point;label:string}
/** Connected work gets one badge, rather than a wall of icons on every tile. */
export function roadWorkSites(world:World):RoadWorkSite[]{
  const remaining=new Map((world.roadWorks??[]).map(w=>[`${w.x},${w.y}`,w])),sites:RoadWorkSite[]=[];
  const family=(w:RoadWork)=>`${w.operation==='remove'?`remove:${w.group??w.id}`:'pave'}:${w.type}`;
  while(remaining.size){
    const first=remaining.values().next().value!,works=[first];remaining.delete(`${first.x},${first.y}`);
    for(let i=0;i<works.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const k=`${works[i].x+dx},${works[i].y+dy}`,next=remaining.get(k);
      if(next&&family(next)===family(first)){remaining.delete(k);works.push(next);}
    }
    const x=works.reduce((n,w)=>n+w.x,0)/works.length,y=works.reduce((n,w)=>n+w.y,0)/works.length;
    const anchor=[...works].sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)||a.id-b.id)[0];
    sites.push({id:Math.min(...works.map(w=>w.id)),works,anchor:{x:anchor.x,y:anchor.y},label:roadWorkLabel(world,works)});
  }
  return sites;
}
export function roadWorkLabel(world:World,works:RoadWork[]){
  const w=works[0],bridge=works.every(p=>terrainCell(p.x,p.y,world.terrain).kind==='water');
  return `${bridge?BRIDGE_TYPES[w.type].name:ROAD_TYPES[w.type].name} ${bridge?'bridge':'road'} ${w.operation==='remove'?'removal':works.every(w=>w.operation==='upgrade')?'upgrade':'construction'}`;
}
export function roadWorkCrew(world:World,ids:readonly number[]){
  const jobs=new Set(ids);
  return world.agents.filter(a=>a.roadWork!==undefined&&jobs.has(a.roadWork)).flatMap(agent=>{
    const resident=world.residents.find(r=>r.id===agent.resident);if(!resident)return [];
    return [{agent,resident,working:agent.wait>0,status:agent.wait>0?'Working on the road':'Walking to the work'}];
  });
}
