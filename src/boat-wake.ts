import type {Point} from './simulation.js';

export const WAKE_LIFETIME=2.8;
const SPACING=.105,MAX_MARKS=24;
export type WakeMark=Point&{dx:number;dy:number;born:number};
/** Small world-space history: foam stays where the hull passed, including
 * corners. Camera movement cannot drag it around; game pause freezes it. */
export class BoatWake {
 readonly marks:WakeMark[]=[];
 private previous:(Point&{time:number})|undefined;
 private distance=0;
 moving=false;
 update(p:Point,time:number,sailing:boolean){
  while(this.marks.length&&time-this.marks[0].born>=WAKE_LIFETIME)this.marks.shift();
  const previous=this.previous;this.previous={...p,time};
  if(!previous){this.moving=false;return;}
  const dt=time-previous.time,dx=p.x-previous.x,dy=p.y-previous.y,length=Math.hypot(dx,dy);
  if(dt===0)return;
  if(dt<0||dt>1||length>.9){this.marks.length=0;this.distance=0;this.moving=false;return;}
  this.moving=sailing&&length>1e-5;
  if(!this.moving){this.distance=0;return;}
  const ux=dx/length,uy=dy/length;
  // Emit by distance travelled rather than frame rate or time spent waiting.
  let offset=SPACING-this.distance;
  for(;offset<=length;offset+=SPACING){
   const f=offset/length;
   this.marks.push({x:previous.x+dx*f-ux*.36,y:previous.y+dy*f-uy*.36,dx:ux,dy:uy,born:previous.time+dt*f});
   if(this.marks.length>MAX_MARKS)this.marks.shift();
  }
  this.distance=(this.distance+length)%SPACING;
 }
 clear(){this.marks.length=0;this.previous=undefined;this.distance=0;this.moving=false;}
}
