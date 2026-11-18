import {FOOD_RESOURCES,DELIVERY_CAPACITY,buildingJobs,buildingRecipe,isHome,type Resource} from './catalog.js';
import {isLivestock,herdFeed} from './livestock.js';
import {DAY_TICKS} from './daylight.js';
import {builderCapacity} from './construction.js';
import {warehouseReady,deliveryCapacity} from './warehouses.js';
import type {Building,Simulation} from './simulation.js';

export const TOOL_LIFE_TICKS=DAY_TICKS*4;
const householdGoods:Resource[]=[...FOOD_RESOURCES.filter(r=>r!=='meat'),'meat','wood'];
export const foodStock=(b:Building)=>FOOD_RESOURCES.reduce((n,r)=>n+(b.inventory[r]??0),0);
export const householdStore=(b:Building)=>b.connected && b.enabled && (warehouseReady(b) || b.kind==='market' && !b.construction);
export const toolRequirement=(b:Building)=>b.construction?builderCapacity(b):buildingRecipe(b)?buildingJobs(b):0;
export function toolEfficiency(b:Building,needed=toolRequirement(b)){return needed ? .5+.5*Math.min(1,(b.inventory.tools??0)/needed) : 1;}
/** One tool lasts four full working days. Walking and paused work cause no wear. */
export function wearTools(b:Building,workers:number,rate=1,needed=toolRequirement(b)){
 if(!needed||!workers)return;
 b.toolWear=(b.toolWear??0)+workers*Math.min(1,(b.inventory.tools??0)/needed)*rate/TOOL_LIFE_TICKS;
 const broken=Math.min(b.inventory.tools??0,Math.floor(b.toolWear));
 if(broken){b.inventory.tools!-=broken;b.toolWear-=broken;}
}
export const homeResidents=(sim:Simulation,b:Building)=>sim.state.residents.filter(r=>r.home===b.id);
export const firewoodNeed=(sim:Simulation)=>sim.state.buildings.filter(b=>isHome(b.kind)&&homeResidents(sim,b).length).length;
export function availableSupply(b:Building,resource:Resource){return Math.max(0,(b.inventory[resource]??0)-(resource==='tools'?toolRequirement(b):0));}
export function initializeSupplies(sim:Simulation){
 if(sim.state.suppliesVersion===1)return;
 const depots=sim.state.buildings.filter(b=>warehouseReady(b)&&b.enabled&&b.connected);
 // One-time conversion of existing communal stores, not newly created goods.
 for(const b of sim.state.buildings){
  if(isHome(b.kind)){
   const residents=homeResidents(sim,b);b.warmUntil=sim.state.tick+DAY_TICKS;
   residents.forEach(r=>r.lastMeal=Math.max(0,sim.state.tick-(r.id*97)%DAY_TICKS));
   for(const depot of depots){if(!sim.route(depot,b,'truck'))continue;
    for(const resource of FOOD_RESOURCES){const n=Math.min(Math.max(0,residents.length-foodStock(b)),depot.inventory[resource]??0);if(n){depot.inventory[resource]!-=n;b.inventory[resource]=(b.inventory[resource]??0)+n;}}
    const wood=Math.min(residents.length?1:0,depot.inventory.wood??0);if(wood&&!(b.inventory.wood??0)){depot.inventory.wood!-=wood;b.inventory.wood=wood;}
   }
  }
  const need=toolRequirement(b);
  for(const depot of depots){if(!need||!sim.route(depot,b,'truck'))continue;const n=Math.min(Math.max(0,need-(b.inventory.tools??0)),depot.inventory.tools??0);if(n){depot.inventory.tools!-=n;b.inventory.tools=(b.inventory.tools??0)+n;}}
 }
 // Legacy market meals were already paid for; preserve them as household food.
 let meals=sim.state.marketMeals??0;
 const homes=sim.state.buildings.filter(b=>isHome(b.kind)&&homeResidents(sim,b).length);
 for(let i=0;meals>0&&homes.length;i++,meals--){const b=homes[i%homes.length];b.inventory.bread=(b.inventory.bread??0)+1;}
 if(!homes.length&&depots[0])depots[0].inventory.bread=(depots[0].inventory.bread??0)+meals;
 sim.state.marketMeals=0;sim.state.suppliesVersion=1;
}
export function stepHouseholds(sim:Simulation){
 const tick=sim.state.tick,homes=new Map(sim.state.buildings.filter(b=>isHome(b.kind)).map(b=>[b.id,b]));
 let fed=0;const occupied=new Set<number>();
 for(const r of sim.state.residents){const home=homes.get(r.home);if(!home)continue;occupied.add(home.id);r.lastMeal??=tick;
  if(tick-r.lastMeal>=DAY_TICKS){const food=FOOD_RESOURCES.find(f=>(home.inventory[f]??0)>0);if(food){home.inventory[food]!--;r.lastMeal=tick;}}
  if(tick-r.lastMeal<DAY_TICKS)fed++;
 }
 for(const id of occupied){const b=homes.get(id)!;b.warmUntil??=tick+DAY_TICKS/2;
  if(b.warmUntil<=tick&&(b.inventory.wood??0)>0){b.inventory.wood!--;b.warmUntil=tick+DAY_TICKS;}
 }
 sim.state.food=sim.state.residents.length?Math.round(fed/sim.state.residents.length*100):100;
}
export function supplyRoom(sim:Simulation,b:Building,resource:Resource){
 const incoming=(resources:readonly Resource[])=>sim.state.agents.filter(a=>a.kind==='truck'&&a.target===b.id&&a.cargo&&resources.includes(a.cargo)).reduce((n,a)=>n+a.amount,0);
 if(isHome(b.kind)){
  const residents=homeResidents(sim,b).length;
  if(FOOD_RESOURCES.includes(resource))return foodStock(b)>=residents?0:Math.max(0,residents*2-foodStock(b)-incoming(FOOD_RESOURCES));
  if(resource==='wood')return (b.inventory.wood??0)>0?0:Math.max(0,(residents?2:0)-incoming(['wood']));
 }
 if(resource==='tools'){
  const roadCrew=isHome(b.kind)?sim.state.agents.filter(a=>a.source===b.id&&a.roadWork!==undefined).length:0;
  const need=toolRequirement(b)+roadCrew;
  return (b.inventory.tools??0)>=need?0:Math.max(0,(need?need+1:0)-(b.inventory.tools??0)-incoming(['tools']));
 }
 return 0;
}
/** Household stock is collected locally from a connected store. It does not
 * create a truck for every food/firewood refill. Actual stock is transferred. */
export function collectHouseholdSupplies(sim:Simulation){
 const stores=sim.state.buildings.filter(householdStore);
 const households=sim.state.buildings.filter(b=>isHome(b.kind)&&b.connected&&b.enabled)
   .map(home=>({home,residents:homeResidents(sim,home).length})).filter(h=>h.residents>0);
 households.sort((a,b)=>foodStock(a.home)/a.residents-foodStock(b.home)/b.residents);
 const butcherReserve=sim.state.buildings.filter(b=>b.kind==='butcher'&&!b.construction&&b.enabled&&b.connected).length*14;
 for(const {home,residents} of households){
  if(foodStock(home)>=residents && (home.inventory.wood??0)>0)continue;
  const sources=stores.map(b=>({b,path:sim.route(home,b,'person')})).filter(s=>s.path).sort((a,b)=>a.path!.length-b.path!.length||a.b.id-b.b.id);
  for(const {b:source} of sources){
   for(const resource of householdGoods){
    const stock=source.inventory[resource]??0;
    const nextMeals=Math.max(0,residents-foodStock(home));
    const available=resource==='meat'&&warehouseReady(source)
      ? Math.min(stock,Math.max(nextMeals,stock-butcherReserve)) : stock;
    const room=supplyRoom(sim,home,resource),amount=Math.min(room,available);if(!amount)continue;
    source.inventory[resource]!-=amount;home.inventory[resource]=(home.inventory[resource]??0)+amount;
    if(source.kind==='market'){source.produced+=amount;sim.earn(Math.round(amount*(resource==='wood'?3:resource==='sausages'?8:5)*(1+((source.level??1)-1)*.1)),'market');}
   }
  }
 }
}
/** Share warehouse departures fairly across factories and livestock, serving
 * the emptiest inputs first. Never let a fixed metal/feed loop starve meat. */
export function dispatchIndustry(sim:Simulation){
 const demands=sim.state.buildings.flatMap(b=>{
  const recipe=buildingRecipe(b),cargo=isLivestock(b.kind)?'grain':recipe?.input;
  if(!cargo||b.construction||!b.connected||!b.enabled)return [];
  const stocked=(b.inventory[cargo]??0)+sim.state.agents.filter(a=>a.target===b.id&&a.cargo===cargo).reduce((n,a)=>n+a.amount,0);
  const capacity=isLivestock(b.kind)?Math.max(DELIVERY_CAPACITY*2,herdFeed(b)*3):DELIVERY_CAPACITY*2;
  return stocked>=capacity?[]:[{b,cargo,stocked,capacity}];
 }).sort((a,b)=>a.stocked/a.capacity-b.stocked/b.capacity||a.b.id-b.b.id);
 for(const source of sim.state.buildings.filter(b=>warehouseReady(b)&&b.enabled&&b.connected)){
  if(sim.state.agents.filter(a=>a.kind==='truck'&&a.source===source.id).length>=2)continue;
  if(sim.state.agents.some(a=>a.kind==='truck'&&a.source===source.id&&!!sim.building(a.target)&&!isHome(sim.building(a.target)!.kind)))continue;
  for(const {b:target,cargo,capacity} of demands){
   if((source.inventory[cargo]??0)<=0||sim.state.agents.some(a=>a.source===source.id&&a.target===target.id&&a.cargo===cargo))continue;
   const path=sim.route(source,target,'truck');if(!path)continue;
   const stocked=(target.inventory[cargo]??0)+sim.state.agents.filter(a=>a.target===target.id&&a.cargo===cargo).reduce((n,a)=>n+a.amount,0);if(stocked>=capacity)continue;
   const amount=Math.min(deliveryCapacity(source),capacity-stocked,source.inventory[cargo]??0);source.inventory[cargo]!-=amount;
   sim.state.agents.push({id:sim.state.nextId++,kind:'truck',source:source.id,target:target.id,path,segment:0,progress:0,resident:null,cargo,amount,returning:false,wait:0});break;
  }
 }
}
/** Batch two days of household supplies and keep one spare tool per workplace.
 * Bounded outgoing shipments avoid flooding the road network. */
export function dispatchSupplies(sim:Simulation){
 const targets=sim.state.buildings.filter(b=>b.connected&&b.enabled&&(!b.construction||!b.construction.demolition));
 const sources=targets.filter(b=>warehouseReady(b)||(!b.construction&&(b.kind==='market'||!!buildingRecipe(b))));
 const demands=targets.flatMap(b=>{
  const rows:{b:Building;resources:Resource[];priority:number}[]=[];
  if(supplyRoom(sim,b,'tools')>0)rows.push({b,resources:['tools'],priority:(b.inventory.tools??0)<toolRequirement(b)?2:6});
  return rows;
 }).sort((a,b)=>a.priority-b.priority||a.b.id-b.b.id);
 for(const source of sources){
  if(sim.state.agents.filter(a=>a.kind==='truck'&&(isHome(sim.building(a.target)?.kind??'')||a.cargo==='tools'&&sim.building(a.target)?.kind!=='warehouse')).length>=Math.max(2,sources.filter(warehouseReady).length))break;
  if(sim.state.agents.filter(a=>a.kind==='truck'&&a.source===source.id).length>=(warehouseReady(source)?2:1))continue;
  for(const {b:target,resources} of demands){if(target.id===source.id)continue;
   const resource=resources.find(r=>availableSupply(source,r)>0&&(r!=='meat'||!isHome(target.kind)||!targets.some(t=>t.kind==='butcher'&&!t.construction&&(t.inventory.meat??0)<14))&&(warehouseReady(source)||(source.kind==='market'&&r!=='tools')||buildingRecipe(source)?.output===r||!!buildingRecipe(source)?.outputs?.[r]));
   if(!resource)continue;const room=supplyRoom(sim,target,resource);if(!room)continue;
   const path=sim.route(source,target,'truck');if(!path)continue;
   const amount=Math.min(deliveryCapacity(source),room,availableSupply(source,resource));source.inventory[resource]!-=amount;
   sim.state.agents.push({id:sim.state.nextId++,kind:'truck',source:source.id,target:target.id,path,segment:0,progress:0,resident:null,cargo:resource,amount,returning:false,wait:0});break;
  }
 }
}
