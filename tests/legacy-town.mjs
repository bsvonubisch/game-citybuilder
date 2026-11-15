import {readFileSync} from 'node:fs';
import {Simulation as TownSimulation} from '../.test-dist/simulation.js';
export * from '../.test-dist/simulation.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/legacy-town.json',import.meta.url),'utf8'));
/** Fixed map for existing spatial regression scenarios, not the new-game seed. */
export class Simulation extends TownSimulation {constructor(saved){super(saved??fixture);}}
