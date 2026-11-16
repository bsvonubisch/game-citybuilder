import {BUILDINGS, DECORATIONS, RESOURCE_NAMES, STEP, buildingName, type Tool} from './catalog.js';
import {DEPOSITS, depositTiles, exposedDeposit, nearbyDeposits} from './deposits.js';
import {forestCenter, forestInside, harvestable, REGROW_TICKS, treeStage} from './forestry.js';
import {animalPosition, HUNT_RADIUS, MEAT_PER_HUNT} from './hunting.js';
import {miningTargets} from './mining.js';
import {BRIDGE_TYPES, ROAD_TYPES, roadTypeAt, type RoadType} from './roads.js';
import {terrainCell} from './terrain.js';
import type {Point, Simulation} from './simulation.js';

/** Store map selections in canonical coordinates so rotating the view keeps the same object. */
export type WorldSelection =
  | {kind:'road'; point:Point}
  | {kind:'deposit'; id:string}
  | {kind:'wildlife'|'decoration'; id:number};
export type WorldAction = {label:string} & (
  | {type:'place'; tool:Tool; roadType?:RoadType; rotation?:number}
  | {type:'building'; id:number}
  | {type:'remove-decoration'; id:number}
);
export interface WorldDetails {
  title:string; category:string; icon:string; status:string; warning?:boolean;
  facts:[string,string][]; guidance:string; primary:WorldAction; more:WorldAction[];
}
export function roadName(sim:Simulation,p:Point){
  const type=roadTypeAt(sim.state.roadTypes,p),bridge=terrainCell(p.x,p.y,sim.state.terrain).kind==='water';
  return bridge?(type==='pavement'?'Timber footbridge':`${BRIDGE_TYPES[type].name} bridge`):type==='pavement'?'Pavement':`${ROAD_TYPES[type].name} road`;
}
export function worldDetails(sim:Simulation,selection:WorldSelection):WorldDetails|null{
  const world=sim.state;
  if(selection.kind==='road'){
    const p=selection.point;if(!sim.roads.has(`${p.x},${p.y}`))return null;
    const type=roadTypeAt(world.roadTypes,p),surface=ROAD_TYPES[type],bridge=terrainCell(p.x,p.y,world.terrain).kind==='water';
    const links=[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,y])=>sim.roads.has(`${p.x+x},${p.y+y}`)).length;
    return {title:roadName(sim,p),category:'STREETS & JOURNEYS',icon:bridge?'bridge':'road',
      status:links?'Open to travellers':'Isolated road',warning:!links,
      facts:[['Access',type==='pavement'?'Pedestrians only':'People & vehicles'],['Travel speed',`${Math.round(surface.speed*100)}%`],['Connections',`${links} adjoining tiles`]],
      guidance:links?'Extend this route or choose another surface. Traffic keeps moving during upgrades.':'Join this tile to another road so travellers can reach it.',
      primary:{type:'place',tool:'road',roadType:type,label:'Extend this road'},
      more:[{type:'place',tool:'road',label:'Change road surface',roadType:type},{type:'place',tool:'bulldoze',label:'Remove roads'}]};
  }
  if(selection.kind==='deposit'){
    const resource=DEPOSITS[selection.id];if(!resource)return null;
    const reserve=world.deposits[selection.id]??0,layer=(world.depositDepths?.[selection.id]??0)+1;
    const exposed=depositTiles(selection.id).filter(p=>exposedDeposit(world,p)&&!sim.roads.has(`${p.x},${p.y}`)&&!sim.buildingAt(p.x,p.y)&&terrainCell(p.x,p.y,world.terrain).kind==='land');
    const kind=resource==='stone'?'quarry':'mine';
    const nearby=world.buildings.filter(b=>b.kind===kind&&nearbyDeposits(b).includes(selection.id));
    const reachable=nearby.filter(b=>miningTargets(sim,b).some(t=>t.deposit===selection.id));
    const best=reachable.find(b=>!b.construction&&b.enabled&&b.connected)??reachable[0]??nearby[0];
    const active=world.buildings.flatMap(b=>b.mining??[]).filter(t=>t.deposit===selection.id&&t.phase==='mining').length;
    const status=!reserve?'Layer depleted':!exposed.length?'Surface cleared':active?`${active} ${active===1?'miner':'miners'} working`:!nearby.length?'Needs a nearby workplace':!reachable.length?'No walking route to the rocks':'Ready for extraction';
    return {title:`${RESOURCE_NAMES[resource]} deposit`,category:'NATURAL RESOURCES',icon:resource,status,
      warning:!reserve||!exposed.length||!reachable.length,
      facts:[['Remaining',reserve.toLocaleString()],['Layer',String(layer)],['Exposed tiles',String(exposed.length)],['Workplaces in reach',`${reachable.length} / ${nearby.length}`]],
      guidance:!exposed.length?'The surface rocks have been cleared. The underground deposit remains here.':!reserve?'Open a nearby workplace to check its deposit and dig a deeper layer.':!nearby.length?`Build a ${BUILDINGS[kind].name.toLowerCase()} beside this deposit and connect its entrance to a road.`:!reachable.length?'Leave a walkable route from the workplace to the rocks. Buildings, fences and steep ground can block miners.':'Workers collect from exposed rocks and carry the material back to their workplace.',
      primary:best?{type:'building',id:best.id,label:`Inspect ${buildingName(best)}`}:{type:'place',tool:kind,label:`Build ${BUILDINGS[kind].name}`},
      more:best?[{type:'place',tool:kind,label:`Build another ${BUILDINGS[kind].name.toLowerCase()}`}]:[]};
  }
  if(selection.kind==='wildlife'){
    const animal=world.wildlife?.find(a=>a.id===selection.id);if(!animal||animal.respawnAt!==undefined)return null;
    const p=animalPosition(animal),lodges=world.buildings.filter(b=>b.kind==='hunter'&&Math.hypot(forestCenter(b).x-p.x,forestCenter(b).y-p.y)<=HUNT_RADIUS);
    const hunter=world.buildings.find(b=>b.hunting?.some(t=>t.animal===animal.id&&t.phase!=='returning'));
    const lodge=hunter??lodges[0];
    return {title:'Wild deer',category:'WILDLIFE',icon:'leaf',status:hunter?'Being hunted':animal.to?'Roaming the woodland':'Grazing & resting',
      facts:[['Habitat','Woodland'],['Lodges in range',String(lodges.length)],['Meat per hunt',String(MEAT_PER_HUNT)]],
      guidance:'Deer stay in the wild, away from buildings and roads. Hunters need a clear walking route to reach them.',
      primary:lodge?{type:'building',id:lodge.id,label:"Inspect hunter’s lodge"}:{type:'place',tool:'hunter',label:"Build hunter’s lodge"},more:[]};
  }
  const d=world.decorations.find(d=>d.id===selection.id);if(!d)return null;
  const tree=['oak','pine','birch','blossom'].includes(d.kind),stage=treeStage(d,world.tick),regrowing=tree&&stage!=='mature';
  const forester=harvestable(d)?world.buildings.find(b=>b.kind==='forester'&&forestInside(b,d)):undefined;
  const status=regrowing?stage==='stump'?'Regrowing stump':'Young tree':tree?'Mature tree':d.kind==='streetlight'?'Lights up after dusk':'Placed';
  return {title:DECORATIONS[d.kind].name,category:tree?'TREES & WOODLAND':'GARDENS & STREETS',icon:tree?'tree':'leaf',status,
    facts:tree?[['Origin',d.natural?'Natural woodland':'Planted'],['Forestry',harvestable(d)?'Can be harvested':'Decorative'],...(regrowing?[['Mature in',`${Math.ceil(Math.max(0,REGROW_TICKS-(world.tick-d.cutAt!))*STEP)} seconds`] as [string,string]]:[])]:[['Position',`${d.x}, ${d.y}`]],
    guidance:regrowing?'Leave the stump to grow back. Removing it clears the tree permanently.':harvestable(d)?'Foresters chop woodland trees and leave stumps to regrow.':tree?'A planted tree adds greenery to the town.':d.kind==='fence'?'Fence sections join along tile edges. Keep entrances and walking routes clear.':d.kind==='planter'?'Adjacent flower beds join together. Place more beside this one to extend the garden.':d.kind==='streetlight'?'Lanterns illuminate nearby roads and gardens after dusk.':'A place for residents to sit and enjoy the town.',
    primary:forester?{type:'building',id:forester.id,label:'Inspect forester lodge'}:{type:'place',tool:d.kind,rotation:d.side??d.edge,label:`Place another ${tree?'tree':d.kind}`},
    more:[{type:'remove-decoration',id:d.id,label:regrowing?'Remove stump permanently':`Remove ${tree?'tree':'decoration'}`} ]};
}
