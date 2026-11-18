import {DELIVERY_CAPACITY, FOOD_RESOURCES, type Resource} from "./catalog.js";
import type { Building, World } from "./simulation.js";

/** An upgrade keeps the existing depot open; a new construction site cannot supply a town. */
export function warehouseReady(b: Building) {
  return b.kind === "warehouse" && (!b.construction || b.construction.upgradeLevel !== undefined);
}

export const deliveryCapacity=(source:Building)=>DELIVERY_CAPACITY+(source.kind==='warehouse'?((source.level??1)-1)*4:0);

export const foodReserveTarget=(population:number)=>Math.max(DELIVERY_CAPACITY*2,population*3);

/** Orders account for arriving trucks. Even a well-stocked depot accepts a load
 * of a missing food, so gluts of one product leave room for the other trades. */
export function foodOrderRoom(world:World, depot:Building, item:Resource) {
  let meals=FOOD_RESOURCES.reduce((sum,r)=>sum+(depot.inventory[r]??0),0);
  let ofKind=depot.inventory[item]??0;
  for(const a of world.agents) {
    if(a.target!==depot.id || !a.cargo || !FOOD_RESOURCES.includes(a.cargo))continue;
    meals+=a.amount;
    if(a.cargo===item)ofKind+=a.amount;
  }
  const variety=item==='meat'?2*DELIVERY_CAPACITY:DELIVERY_CAPACITY;
  return Math.max(0,foodReserveTarget(world.residents.length)-meals,variety-ofKind);
}

export const LAST_WAREHOUSE_MESSAGE = "Keep one finished warehouse. Finish the replacement warehouse before removing this one.";
