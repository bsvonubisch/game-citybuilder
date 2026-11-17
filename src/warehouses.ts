import {DELIVERY_CAPACITY} from "./catalog.js";
import type { Building } from "./simulation.js";

/** An upgrade keeps the existing depot open; a new construction site cannot supply a town. */
export function warehouseReady(b: Building) {
  return b.kind === "warehouse" && (!b.construction || b.construction.upgradeLevel !== undefined);
}

export const deliveryCapacity=(source:Building)=>DELIVERY_CAPACITY+(source.kind==='warehouse'?((source.level??1)-1)*4:0);

export const LAST_WAREHOUSE_MESSAGE = "Keep one finished warehouse. Finish the replacement warehouse before removing this one.";
