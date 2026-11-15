import {SIZE} from './catalog.js';
import type {Point,World} from './simulation.js';

export const TOWN_EVENT_LIMIT=100;
export const EVENT_KINDS=['notice','arrival','departure','construction','upgrade','demolition','building','road','landscape','farm','shortage','recovery','leisure'] as const;
export type TownEventKind=typeof EVENT_KINDS[number];
export interface TownEvent {
  id:number;
  /** Older string-only history has no reliable event time. */
  tick?:number;
  kind:TownEventKind;
  message:string;
  buildingId?:number;
  tile?:Point;
  topic?:string;
  state?:string;
}
type EventWorld=Pick<World,'tick'|'events'|'history'>;
export function recordTownEvent(world:EventWorld,kind:TownEventKind,message:string,target?:{buildingId?:number;tile?:Point}) {
  const event:TownEvent={id:(world.events?.[0]?.id??0)+1,tick:world.tick,kind,message:message.slice(0,240)};
  if(target?.buildingId!==undefined)event.buildingId=target.buildingId;
  if(target?.tile)event.tile={x:target.tile.x,y:target.tile.y};
  world.events=[event,...world.events??[]].slice(0,TOWN_EVENT_LIMIT);
  return event;
}
/** Logs are nonessential metadata: discard damaged entries without losing a town. */
export function restoreTownEvents(world:EventWorld) {
  if(world.events===undefined){
    const history=world.history.filter(s=>typeof s==='string'&&s.trim()).slice(0,20);
    world.events=history.map((message,i)=>({id:history.length-i,kind:'notice',message:message.slice(0,240)}));
    return;
  }
  const ids=new Set<number>();
  world.events=(Array.isArray(world.events)?world.events:[]).slice(0,TOWN_EVENT_LIMIT).flatMap((e:TownEvent)=>{
    if(!e||!Number.isSafeInteger(e.id)||e.id<1||ids.has(e.id)||!EVENT_KINDS.includes(e.kind)||typeof e.message!=='string'||!e.message.trim()||e.message.length>240)return [];
    if(e.tick!==undefined&&(!Number.isSafeInteger(e.tick)||e.tick<0||e.tick>world.tick))return [];
    ids.add(e.id);const clean:TownEvent={id:e.id,kind:e.kind,message:e.message};
    if(e.tick!==undefined)clean.tick=e.tick;
    if(Number.isSafeInteger(e.buildingId)&&e.buildingId!>0)clean.buildingId=e.buildingId;
    if(typeof e.topic==='string'&&e.topic.length<80&&typeof e.state==='string'&&e.state.length<120){clean.topic=e.topic;clean.state=e.state;}
    if(e.tile&&[e.tile.x,e.tile.y].every(n=>Number.isFinite(n)&&n>=0&&n<SIZE))clean.tile={x:e.tile.x,y:e.tile.y};
    return [clean];
  }).sort((a,b)=>b.id-a.id);
}
