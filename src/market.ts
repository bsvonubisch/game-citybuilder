import {STEP,type Resource} from './catalog.js';
import {DAY_TICKS,daylight} from './daylight.js';
import {marketLayout,marketStalls} from './market-layout.js';
import type {Agent,Building,Resident,Simulation} from './simulation.js';
import {marketCustomerPose,marketVisit} from './market-visitors.js';
export const MARKET_GOODS:Resource[]=['bread','fish','meat','sausages','potatoes','carrots','tools'];
export const marketOpen=(tick:number)=>{const hour=daylight(tick).hour;return hour>=7&&hour<19;};
export const marketStock=(b:Building)=>MARKET_GOODS.reduce((n,r)=>n+(b.inventory[r]??0),0);
export function marketVendors(sim:Simulation,b:Building){return sim.state.agents.filter(a=>a.onsite===b.id&&sim.state.residents.some(r=>r.id===a.resident&&r.job===b.id)).sort((a,c)=>a.resident!-c.resident!);}
export function marketDestination(sim:Simulation,r:Resident) {
 if(!marketOpen(sim.state.tick)||(r.lastShopping??-DAY_TICKS)>sim.state.tick-DAY_TICKS/2)return;
 const home=sim.building(r.home)!;
 return sim.state.buildings.filter(b=>b.kind==='market'&&!b.construction&&b.enabled&&b.connected&&b.id!==r.job&&marketStock(b)>0&&marketVendors(sim,b).length>0)
   .map(b=>({b,path:sim.route(home,b)})).filter(v=>v.path&&v.path.length<=19&&sim.state.agents.filter(a=>a.target===v.b.id&&a.marketSlot!==undefined).length<marketStalls(v.b))
   .sort((a,b)=>a.path!.length-b.path!.length||a.b.id-b.b.id)[0]?.b;
}
export function buyAtMarket(sim:Simulation,a:Agent,b:Building,r:Resident) {
 if(!marketOpen(sim.state.tick)||!b.enabled||!b.connected||b.construction)return false;
 const vendors=marketVendors(sim,b),busy=new Set(sim.state.agents.filter(v=>v.id!==a.id&&v.target===b.id&&v.marketSlot!==undefined).map(v=>v.marketSlot));
 const slot=vendors.findIndex((_,i)=>!busy.has(i));if(slot<0)return false;
 const foodRoom=(sim.state.marketMeals??0)<Math.ceil(sim.state.residents.length/3);
 const goods=MARKET_GOODS.filter(g=>(b.inventory[g]??0)>0&&(g==='tools'||foodRoom));
 const item=goods[(r.id+Math.floor(sim.state.tick/DAY_TICKS))%goods.length];if(!item)return false;
 b.inventory[item]!--;b.produced++;r.lastShopping=sim.state.tick;r.leisure=Math.min(100,(r.leisure??60)+8);
 if(item!=='tools')sim.state.marketMeals=(sim.state.marketMeals??0)+1;
 sim.earn(Math.round((item==='tools'?38:item==='sausages'?8:5)*(1+((b.level??1)-1)*.1)),'market');a.marketSlot=slot;a.wait=marketVisit(b,a).duration;a.active=false;return true;
}
export function marketActor(sim:Simulation,a:Agent,elapsed:number) {
 const b=sim.building(a.onsite??a.target);if(b?.kind!=='market'||b.construction)return;
 const slots=marketLayout(b);
 if(a.onsite===b.id){const index=marketVendors(sim,b).findIndex(v=>v.id===a.id);if(index<0||!slots[index])return;const customer=sim.state.agents.find(v=>v.target===b.id&&v.marketSlot===index&&v.wait>0),visit=customer?marketCustomerPose(b,customer,elapsed):undefined;return {b,p:slots[index].vendor,vendor:true,slot:index,serving:visit?.browsing??false,elapsed:sim.state.tick*STEP+elapsed,visit};}
 if(a.marketSlot!==undefined&&a.returning&&a.wait>0&&slots[a.marketSlot]){const visit=marketCustomerPose(b,a,elapsed);return {b,p:visit,vendor:false,slot:a.marketSlot,serving:false,elapsed:sim.state.tick*STEP+elapsed,visit};}
}
