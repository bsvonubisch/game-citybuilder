import type { Building } from "./simulation.js";

/** An upgrade keeps the existing depot open; a new construction site cannot supply a town. */
export function warehouseReady(b: Building) {
  return b.kind === "warehouse" && (!b.construction || b.construction.upgradeLevel !== undefined);
}

export const LAST_WAREHOUSE_MESSAGE = "Keep one finished warehouse. Finish the replacement warehouse before removing this one.";
