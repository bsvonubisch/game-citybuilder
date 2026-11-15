import type {Point} from "./simulation.js";
export interface EdgeOccluder {a:Point;b:Point;depth:number;left:number;right:number;top:number;bottom:number}
/** A one-tile rail is a vertical plane, not a single depth at its midpoint.
 * Sort travellers by the side of that plane their feet actually occupy. */
export function edgeDepth(p:Point,bounds:{left:number;right:number;top:number;bottom:number},natural:number,edges:readonly EdgeOccluder[]){
  let lower=-Infinity,upper=Infinity;
  for(const e of edges){
    if(bounds.right<=e.left||bounds.left>=e.right||bounds.bottom<=e.top||bounds.top>=e.bottom)continue;
    const vertical=e.a.x===e.b.x,along=vertical?p.y:p.x;
    const start=vertical?e.a.y:e.a.x,end=vertical?e.b.y:e.b.x;
    if(along<Math.min(start,end)-.18||along>Math.max(start,end)+.18)continue;
    const near=vertical?p.x>e.a.x:p.y>e.a.y;
    if(near)lower=Math.max(lower,e.depth+.15);else upper=Math.min(upper,e.depth-.15);
  }
  return Math.max(lower,Math.min(upper,natural));
}
