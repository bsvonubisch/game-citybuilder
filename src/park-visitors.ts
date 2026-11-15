import type {Agent,Building} from './simulation.js';
export const parkVisitDuration=(id:number)=>24+id%5*2;
export function parkVisitor(a:Agent,b:Building|undefined,acc=0){
 if(!b||b.kind!=='park'||b.construction||!b.enabled||!a.returning||a.active!==false||a.wait<=0||a.resident===null)return null;
 const elapsed=Math.max(0,parkVisitDuration(a.id)-a.wait+acc),walk=elapsed%10<5;
 const base=a.id%8*Math.PI/4,angle=base+Math.floor(elapsed/10)*.7+Math.min(elapsed%10,5)*.14;
 const r=.52+.08*Math.abs(Math.sin(angle*2)),p={x:b.x+.5+Math.cos(angle)*r,y:b.y+.5+Math.sin(angle)*r};
 return{...p,dx:walk?-Math.sin(angle):b.x+.5-p.x,dy:walk?Math.cos(angle):b.y+.5-p.y,walking:walk,elapsed};
}
