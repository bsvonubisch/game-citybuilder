import {SIZE,dimensions} from './catalog.js';
import type {Building,Point,World} from './simulation.js';
export const quarter=(n:number)=>((n%4+4)%4) as 0|1|2|3;
/** Quarter-turns on the ground plane. Upright artwork is never screen-rotated. */
export function turnPoint(p:Point,turn:number):Point{
 const n=SIZE-1;switch(quarter(turn)){case 1:return{x:p.y,y:n-p.x};case 2:return{x:n-p.x,y:n-p.y};case 3:return{x:n-p.y,y:p.x};default:return{x:p.x,y:p.y};}
}
export function turnBox(p:Point,w:number,h:number,turn:number){
 const a=turnPoint(p,turn),b=turnPoint({x:p.x+w-1,y:p.y+h-1},turn);
 return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),plot:(quarter(turn)%2?[h,w]:[w,h]) as [number,number]};
}
const sources=new WeakMap<object,{turn:number;source:object}>();
export function markView<T extends object>(view:T,source:T,turn:number){sources.set(view,{turn,source});return view;}
export const viewTurn=(value:object)=>sources.get(value)?.turn??0;
export const sourceObject=<T extends object>(value:T):T=>(sources.get(value)?.source??value) as T;
export const sourcePoint=(value:object,p:Point)=>turnPoint(p,-viewTurn(value));
/** Also supports a placement preview, which has no persisted source object. */
export function sourceBuilding(b:Building,turn:number):Building{
 const original=sourceObject(b);if(original!==b)return original;
 const [w,h]=dimensions(b.kind,b.rotation,b.plot),box=turnBox(b,w,h,-turn);
 return{...b,x:box.x,y:box.y,rotation:quarter(b.rotation-turn),...(b.plot?{plot:box.plot}:{})};
}
export function sourceBrush<T extends Point&{size:number}>(world:World,c:T):T{
 const start=Math.floor((c.size-1)/2),b=turnBox({x:c.x-start,y:c.y-start},c.size,c.size,-viewTurn(world));
 return{...c,x:b.x+start,y:b.y+start};
}
