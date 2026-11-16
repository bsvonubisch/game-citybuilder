import {isBridge} from './bridges.js';
import {roadTypeAt} from './roads.js';
import type {Point,Simulation} from './simulation.js';

/** A painted arch spans two real tiles. Resolve its phase in authoritative map
 * space, so a camera turn cannot move piers or reverse half of an arch. */
export function bridgeProfile(sim:Simulation,tile:Point,a:Point,b:Point) {
 const axis=Math.abs(b.x-a.x)>.01?'x':'y',direction=Math.sign(b[axis]-a[axis]);
 const kind=roadTypeAt(sim.state.roadTypes,tile);let start=tile[axis];
 const p={...tile};
 while(start>0){p[axis]=start-1;if(!isBridge(sim.roads,p.x,p.y,sim.state.terrain)||roadTypeAt(sim.state.roadTypes,p)!==kind)break;start--;}
 const half=(tile[axis]-start)%2;
 return {from:(half+(direction<0?1:0))/2,to:(half+(direction>0?1:0))/2};
}
