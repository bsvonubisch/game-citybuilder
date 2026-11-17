import {buildingRecipe,recipeProducts,FOOD_RESOURCES} from './catalog.js';
import {foodStock,toolRequirement,toolEfficiency,firewoodNeed,homeResidents} from './supplies.js';
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
    {id:"food",label:"Food for the next day",have:buildings.reduce((n,b)=>n+foodStock(b),0),need:population,unit:"meals",action:suggest("fishery","Build fishery")},
    {id:'firewood',label:'Firewood for the next day',have:buildings.filter(b=>isHome(b.kind)||b.kind==='warehouse').reduce((n,b)=>n+(b.inventory.wood??0),0),need:firewoodNeed(sim),unit:'wood',action:suggest('forester','Build forester lodge')},
    {id:'tools',label:'Workers equipped',have:buildings.reduce((n,b)=>n+Math.min(toolRequirement(b),b.inventory.tools??0),0),need:buildings.reduce((n,b)=>n+toolRequirement(b),0),unit:'tools',action:suggest('workshop','Build copper workshop')},
    {id:"workers",label:"Workplaces staffed",have:jobs.reduce((n,b)=>n+b.workers,0),need:jobs.reduce((n,b)=>n+buildingJobs(b),0),unit:"workers",action:unfilled?{label:"Check unfilled workplace",building:unfilled.id}:suggest("house","Build homes")},
    {id:"builders",label:"Construction crew",have:sites.reduce((n,b)=>n+b.workers,0),need:sites.reduce((n,b)=>n+builderCapacity(b),0),unit:"builders",action:site?{label:"Check construction site",building:site.id}:undefined},
    {id:"homes",label:"Housing",have:buildings.filter(b=>isHome(b.kind)&&(!b.construction||b.construction.upgradeTo||b.construction.upgradeLevel)&&b.connected).reduce((n,b)=>n+houseCapacity(b),0),need:population,unit:"places",action:suggest("house","Build homes")},
    {id:"parks",label:"Leisure nearby",have:coverage("park","garden","tavern"),need:population,unit:"residents served",action:suggest("park","Add fountain square")},
    {id:"religion",label:"Religion nearby",have:coverage("church","chapel"),need:population,unit:"residents served",action:suggest("chapel","Build chapel")},
  ];
}
export interface BuildingNeed {label:string;have:string;need:string;ok:boolean}
export function buildingNeeds(sim:Simulation,b:Building):BuildingNeed[] {
  const d={...BUILDINGS[b.kind],recipe:buildingRecipe(b)},rows:BuildingNeed[]=[{label:"Road",have:b.connected?"Connected":"Missing",need:"Warehouse access",ok:b.connected}];
  const workers=b.construction?builderCapacity(b):buildingJobs(b);
  if(workers)rows.push({label:b.construction?"Builders":"Workers",have:String(b.workers),need:String(workers),ok:b.workers>=workers});
  const tools=toolRequirement(b);
  if(tools){rows.push({label:'Work tools',have:String(b.inventory.tools??0),need:`${tools} + 1 spare`,ok:(b.inventory.tools??0)>=tools});rows.push({label:'Tool efficiency',have:`${Math.round(toolEfficiency(b)*100)}%`,need:'100% equipped',ok:toolEfficiency(b)===1});}
  if(b.construction)return rows;
  if(b.kind==="market"){
    rows.push({label:"Vendors on site",have:String(marketVendors(sim,b).length),need:String(buildingJobs(b)),ok:marketVendors(sim,b).length>0});
    rows.push({label:"Stock to sell",have:String(marketStock(b)),need:"Food, firewood or tools",ok:marketStock(b)>0});
  }
  if(isLivestock(b.kind)){
    const herd=ensureHerd(b),feed=Math.max(1,Math.ceil(herd.count/4));
    rows.push({label:b.kind==='chickens'?'Birds':'Animals',have:String(herd.count),need:`${livestockCapacity(b.kind,b.plot)} capacity`,ok:true});
    rows.push({label:'Farmers on site',have:String(livestockCrew(sim,b).length),need:String(buildingJobs(b)),ok:livestockCrew(sim,b).length>=buildingJobs(b)});
    rows.push({label:'Grain feed',have:String(b.inventory.grain??0),need:`${feed} / 40s`,ok:herd.fed>0||(b.inventory.grain??0)>=feed});
  }else if(d.recipe?.input)rows.push({label:RESOURCE_NAMES[d.recipe.input],have:String(b.inventory[d.recipe.input]??0),need:`${d.recipe.amount??0} / batch`,ok:(b.inventory[d.recipe.input]??0)>=(d.recipe.amount??0)});
  if(isExtractor(b.kind)){const reserve=sim.state.deposits[buildingDeposit(b)!]??0;rows.push({label:"Deposit",have:reserve.toLocaleString(),need:"Within reach",ok:reserve>0&&sim.alert(b)?.kind!=="input"});}
  if(b.kind==='gatherer')rows.push({label:'Berry bushes',have:sim.alert(b)?.kind==='input'?'None ripe in reach':'In reach',need:'Wild bushes within 10 tiles',ok:sim.alert(b)?.kind!=='input'});
  if(b.kind==="forester")rows.push({label:"Trees",have:sim.alert(b)?.kind==="input"?"None reachable":"In reach",need:"Mature woodland",ok:sim.alert(b)?.kind!=="input"});
  if(b.kind==="hunter")rows.push({label:"Wildlife",have:sim.alert(b)?.kind==="input"?"None nearby":"In reach",need:"Woodland within 12 tiles",ok:sim.alert(b)?.kind!=="input"});
  if(isHome(b.kind)) {
    const count=homeResidents(sim,b).length;
    rows.push({label:'Food at home',have:String(foodStock(b)),need:`${count} / day`,ok:!count||foodStock(b)>0});
    rows.push({label:'Firewood',have:`${b.inventory.wood??0} wood`,need:count?'1 / day':'No residents',ok:!count||(b.inventory.wood??0)>0});
    rows.push({label:'Heating',have:(b.warmUntil??Infinity)>sim.state.tick?'Warm':'Cold',need:'Warm home',ok:!count||(b.warmUntil??Infinity)>sim.state.tick});
    const occupants=sim.state.residents.filter(r=>r.home===b.id),leisure=occupants.length?Math.round(occupants.reduce((n,r)=>n+(r.leisure??60),0)/occupants.length):0;
    const faith=occupants.length?Math.round(occupants.reduce((n,r)=>n+(r.faith??70),0)/occupants.length):0;
    rows.push({label:"Religion",have:`${faith}%`,need:"Chapel or church visits",ok:faith>=60});
    rows.push({label:"Leisure",have:`${leisure}%`,need:"Nearby visits",ok:leisure>=60});
  }
  if(d.recipe)for(const [resource,count] of recipeProducts(d.recipe))rows.push({label:RESOURCE_NAMES[resource],have:String(b.inventory[resource]??0),need:`${outputCapacity(b)} storage`,ok:d.recipe.outputs?(b.inventory[resource]??0)+count<=outputCapacity(b):(b.inventory[resource]??0)<outputCapacity(b)});
  return rows;
}
