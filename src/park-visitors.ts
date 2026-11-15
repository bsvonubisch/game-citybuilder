import {isPark} from "./catalog.js";
import type {Agent,Building} from './simulation.js';
export const parkVisitorLimit=(b:Building)=>b.kind==="garden"?8:4;
export const parkVisitDuration=(id:number)=>18+id%5*2;
export function parkVisitor(a:Agent,b:Building|undefined,acc=0){
 if(!b||!isPark(b.kind)||b.construction||!b.enabled||!a.returning||a.active!==false||a.wait<=0||a.resident===null||a.parkSlot===undefined)return null;
 const elapsed=Math.max(0,parkVisitDuration(a.id)-a.wait+acc),walking=elapsed<1;
 const size=b.kind==='garden'?4:2,center=(size-1)/2;
 const spots=size===4?[[1.5,.25],[1.5,2.75],[.25,1.5],[2.75,1.5],[1.5,.95],[1.5,2.05],[.95,1.5],[2.05,1.5]]:[[.5,-.06],[.5,1.06],[-.06,.5],[1.06,.5]];
 let [x,y]=spots[a.parkSlot%spots.length];
 for(let i=0;i<b.rotation;i++)[x,y]=[y,size-1-x];
 const outward={x:x-center,y:y-center},length=Math.hypot(outward.x,outward.y);
 const dx=-outward.x/length,dy=-outward.y/length,offset=walking?(1-elapsed)*.3:0;
 return{x:b.x+x-dx*offset,y:b.y+y-dy*offset,dx,dy,walking,elapsed};
}
