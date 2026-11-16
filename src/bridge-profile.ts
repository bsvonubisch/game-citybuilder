import {isBridge} from './bridges.js';
import {SIZE} from './catalog.js';
import {roadTypeAt} from './roads.js';
import type {Point,Simulation} from './simulation.js';

/** Complete arches end on both banks. Most spans use two tiles; the final span
 * uses three for an odd length, or one for a narrow channel. Resolve the phase
 * in authoritative map space so a camera turn cannot move any piers. */
export function bridgeProfile(sim:Simulation,tile:Point,a:Point,b:Point) {
 const axis=Math.abs(b.x-a.x)>.01?'x':'y',direction=Math.sign(b[axis]-a[axis]);
 const kind=roadTypeAt(sim.state.roadTypes,tile);let start=tile[axis],end=start;
 const p={...tile};
 while(start>0){p[axis]=start-1;if(!isBridge(sim.roads,p.x,p.y,sim.state.terrain)||roadTypeAt(sim.state.roadTypes,p)!==kind)break;start--;}
 while(end<SIZE-1){p[axis]=end+1;if(!isBridge(sim.roads,p.x,p.y,sim.state.terrain)||roadTypeAt(sim.state.roadTypes,p)!==kind)break;end++;}
 const length=end-start+1,offset=tile[axis]-start;
 const finalThree=length>1&&length%2===1&&offset>=length-3;
 const span=length===1?1:finalThree?3:2,part=finalThree?offset-(length-3):offset%2;
 return {from:(part+(direction<0?1:0))/span,to:(part+(direction>0?1:0))/span};
}
