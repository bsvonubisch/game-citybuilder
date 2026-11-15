import {DAY_TICKS} from "./daylight.js";
export type IncomeSource="tax"|"exports"|"market";
export interface IncomeEntry {tick:number;amount:number;source:IncomeSource}
export function incomeSummary(tick:number,entries:readonly IncomeEntry[]=[]){
  const totals={tax:0,exports:0,market:0,total:0};
  for(const e of entries)if(e.tick>tick-DAY_TICKS&&e.tick<=tick){totals[e.source]+=e.amount;totals.total+=e.amount;}
  return totals;
}
