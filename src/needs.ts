import {buildingRecipe,recipeProducts,FOOD_RESOURCES} from './catalog.js';
import {buildingJobs} from "./catalog.js";
import {isHome} from "./catalog.js";
import {marketStock,marketVendors} from "./market.js";
import { BUILDINGS, RESOURCE_NAMES, houseCapacity, type BuildingKind } from "./catalog.js";
import { builderCapacity } from "./construction.js";
import { serviceCoverage } from "./proximity.js";
import { outputCapacity } from "./upgrades.js";
import { buildingDeposit,isExtractor } from "./deposits.js";
import type { Simulation,Building } from "./simulation.js";
import {isLivestock,ensureHerd,livestockCrew,livestockCapacity} from './livestock.js';

export interface Need {
  id:string; label:string; have:number; need:number; unit:string;
  action?:{label:string;building?:number;kind?:BuildingKind};
}
export function townNeeds(sim:Simulation):Need[] {
  const {buildings,residents}=sim.state,population=residents.length;
  const jobs=buildings.filter(b=>!b.construction&&b.enabled&&buildingJobs(b));
  const sites=buildings.filter(b=>b.construction&&b.enabled);
  const suggest=(kind:BuildingKind,label:string)=>{
    const existing=buildings.find(b=>b.kind===kind&&(b.construction||sim.alert(b)));
    return existing?{label:`Check ${BUILDINGS[kind].name.toLowerCase()}`,building:existing.id}:{label,kind};
  };
  const coverage=(...kinds:BuildingKind[])=>{
    const served=new Set<number>();
    for(const b of buildings.filter(b=>kinds.includes(b.kind)&&!b.construction&&b.connected&&b.enabled&&b.workers>=buildingJobs(b)))
      for(const h of serviceCoverage(sim,b).homes)
        for(const r of residents.filter(r=>r.home===h.home.id).slice(0,h.served))served.add(r.id);
    return served.size;
  };
  const unfilled=jobs.find(b=>b.workers<buildingJobs(b)),site=sites.find(b=>b.workers<builderCapacity(b));
  return [
    {id:"food",label:"Food for the next day",have:FOOD_RESOURCES.reduce((n,r)=>n+sim.stored(r),0)+(sim.state.marketMeals??0),need:Math.ceil(population/3),unit:"meals",action:suggest("fishery","Build fishery")},
    {id:"workers",label:"Workplaces staffed",have:jobs.reduce((n,b)=>n+b.workers,0),need:jobs.reduce((n,b)=>n+buildingJobs(b),0),unit:"workers",action:unfilled?{label:"Check unfilled workplace",building:unfilled.id}:suggest("house","Build homes")},
    {id:"builders",label:"Construction crew",have:sites.reduce((n,b)=>n+b.workers,0),need:sites.reduce((n,b)=>n+builderCapacity(b),0),unit:"builders",action:site?{label:"Check construction site",building:site.id}:undefined},
    {id:"homes",label:"Housing",have:buildings.filter(b=>isHome(b.kind)&&(!b.construction||b.construction.upgradeTo||b.construction.upgradeLevel)&&b.connected).reduce((n,b)=>n+houseCapacity(b),0),need:population,unit:"places",action:suggest("house","Build homes")},
    {id:"parks",label:"Leisure nearby",have:coverage("park","garden","tavern"),need:population,unit:"residents served",action:suggest("park","Add fountain square")},
    {id:"religion",label:"Religion nearby",have:coverage("church"),need:population,unit:"residents served",action:suggest("church","Build church")},
  ];
}
export interface BuildingNeed {label:string;have:string;need:string;ok:boolean}
export function buildingNeeds(sim:Simulation,b:Building):BuildingNeed[] {
  const d={...BUILDINGS[b.kind],recipe:buildingRecipe(b)},rows:BuildingNeed[]=[{label:"Road",have:b.connected?"Connected":"Missing",need:"Warehouse access",ok:b.connected}];
  const workers=b.construction?builderCapacity(b):buildingJobs(b);
  if(workers)rows.push({label:b.construction?"Builders":"Workers",have:String(b.workers),need:String(workers),ok:b.workers>=workers});
  if(b.construction)return rows;
  if(b.kind==="market"){
    rows.push({label:"Vendors on site",have:String(marketVendors(sim,b).length),need:String(buildingJobs(b)),ok:marketVendors(sim,b).length>0});
    rows.push({label:"Stock to sell",have:String(marketStock(b)),need:"Food or tools",ok:marketStock(b)>0});
  }
  if(isLivestock(b.kind)){
    const herd=ensureHerd(b),feed=Math.max(1,Math.ceil(herd.count/4));
    rows.push({label:b.kind==='chickens'?'Birds':'Animals',have:String(herd.count),need:`${livestockCapacity(b.kind,b.plot)} capacity`,ok:true});
    rows.push({label:'Farmers on site',have:String(livestockCrew(sim,b).length),need:String(buildingJobs(b)),ok:livestockCrew(sim,b).length>=buildingJobs(b)});
    rows.push({label:'Grain feed',have:String(b.inventory.grain??0),need:`${feed} / 40s`,ok:herd.fed>0||(b.inventory.grain??0)>=feed});
  }else if(d.recipe?.input)rows.push({label:RESOURCE_NAMES[d.recipe.input],have:String(b.inventory[d.recipe.input]??0),need:`${d.recipe.amount??0} / batch`,ok:(b.inventory[d.recipe.input]??0)>=(d.recipe.amount??0)});
  if(isExtractor(b.kind)){const reserve=sim.state.deposits[buildingDeposit(b)!]??0;rows.push({label:"Deposit",have:reserve.toLocaleString(),need:"Within reach",ok:reserve>0&&sim.alert(b)?.kind!=="input"});}
  if(b.kind==="forester")rows.push({label:"Trees",have:sim.alert(b)?.kind==="input"?"None reachable":"In reach",need:"Mature woodland",ok:sim.alert(b)?.kind!=="input"});
  if(b.kind==="hunter")rows.push({label:"Wildlife",have:sim.alert(b)?.kind==="input"?"None nearby":"In reach",need:"Woodland within 12 tiles",ok:sim.alert(b)?.kind!=="input"});
  if(isHome(b.kind)) {
    rows.push({label:"Food",have:`${sim.state.food}% fed`,need:"100%",ok:sim.state.food>=100});
    const occupants=sim.state.residents.filter(r=>r.home===b.id),leisure=occupants.length?Math.round(occupants.reduce((n,r)=>n+(r.leisure??60),0)/occupants.length):0;
    const faith=occupants.length?Math.round(occupants.reduce((n,r)=>n+(r.faith??70),0)/occupants.length):0;
    rows.push({label:"Religion",have:`${faith}%`,need:"Church visits",ok:faith>=60});
    rows.push({label:"Leisure",have:`${leisure}%`,need:"Nearby visits",ok:leisure>=60});
  }
  if(d.recipe)for(const [resource,count] of recipeProducts(d.recipe))rows.push({label:RESOURCE_NAMES[resource],have:String(b.inventory[resource]??0),need:`${outputCapacity(b)} storage`,ok:d.recipe.outputs?(b.inventory[resource]??0)+count<=outputCapacity(b):(b.inventory[resource]??0)<outputCapacity(b)});
  return rows;
}
