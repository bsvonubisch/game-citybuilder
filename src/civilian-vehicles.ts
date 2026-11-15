import type {Agent} from './simulation.js';

export const CIVILIAN_CARS=[
  {name:'Green compact',row:0,classic:true},
  {name:'Gold compact',row:1,classic:true},
  {name:'Lavender fastback',row:0,classic:false},
  {name:'Blue family saloon',row:1,classic:false},
  {name:'Cream roadster',row:2,classic:false},
  {name:'Teal estate',row:3,classic:false},
] as const;
/** Stable per resident, including return trips, recovery and reloaded saves.
 * Mix the ID first: motorists' IDs are regularly spaced, not random. */
export function civilianCar(a:Pick<Agent,'id'|'resident'>){
  let hash=(a.resident??a.id)>>>0;hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash=(hash^(hash>>>16))>>>0;
  return CIVILIAN_CARS[hash%CIVILIAN_CARS.length];
}
