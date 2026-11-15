import type {Agent,Building} from './simulation.js';
export const parkVisitDuration=(id:number)=>18+id%5*2;
export function parkVisitor(a:Agent,b:Building|undefined,acc=0){
 if(!b||b.kind!=='park'||b.construction||!b.enabled||!a.returning||a.active!==false||a.wait<=0||a.resident===null||a.parkSlot===undefined)return null;
 const elapsed=Math.max(0,parkVisitDuration(a.id)-a.wait+acc),walking=elapsed<1;
 let [x,y]=[[.5,-.06],[.5,1.06],[-.06,.5],[1.06,.5]][a.parkSlot%4];
 for(let i=0;i<b.rotation;i++)[x,y]=[y,1-x];
 const outward={x:x-.5,y:y-.5},length=Math.hypot(outward.x,outward.y);
 const dx=-outward.x/length,dy=-outward.y/length,offset=walking?(1-elapsed)*.3:0;
 return{x:b.x+x-dx*offset,y:b.y+y-dy*offset,dx,dy,walking,elapsed};
}
