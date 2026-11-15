import {livestockSpots,type LivestockKind} from './livestock-layout.js';

type Point={x:number;y:number};
type Animal=Point&{previous:Point;target:Point|null;dx:number;dy:number;pause:number;grazing:boolean;blocked:number;distance:number;random:number};
const TICK=.2;
/** Cosmetic, bounded fixed-step movement. One shared update per pen, with
 * nearby-neighbor lookups instead of comparing every pair on every frame. */
export class LivestockRoaming {
 private animals:Animal[]=[];
 private spots:readonly (readonly[number,number])[];
 private cells=new Map<string,Set<number>>();
 private time:number|undefined;
 private remainder=0;
 private step=0;
 private separation:number;
 private speed:number;
 constructor(private kind:LivestockKind,private w:number,private h:number,private seed:number){
  this.spots=livestockSpots(kind,[w,h]);
  this.separation=kind==='chickens'?.24:kind==='pigs'?.43:.52;
  this.speed=kind==='chickens'?.48:kind==='pigs'?.34:.29;
 }
 private random(a:Animal){a.random=(Math.imul(a.random,1664525)+1013904223)>>>0;return a.random/4294967296;}
 private cell(p:Point){return `${Math.floor(p.x/this.separation)},${Math.floor(p.y/this.separation)}`;}
 private insert(a:Point,i:number){const key=this.cell(a);let cell=this.cells.get(key);if(!cell)this.cells.set(key,cell=new Set());cell.add(i);}
 private free(p:Point,index:number){
  if(p.x<-.12||p.y<-.12||p.x>this.w-.58||p.y>this.h-.58||(p.x<.7&&p.y<.7))return false;
  const cx=Math.floor(p.x/this.separation),cy=Math.floor(p.y/this.separation),r2=this.separation**2;
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)for(const i of this.cells.get(`${x},${y}`)??[]){
   if(i===index)continue;const a=this.animals[i];if((a.x-p.x)**2+(a.y-p.y)**2<r2)return false;
  }
  return true;
 }
 private resize(count:number){
  if(count<this.animals.length){this.animals.length=count;this.cells.clear();this.animals.forEach((a,i)=>this.insert(a,i));}
  while(this.animals.length<count){
   const i=this.animals.length,a:Animal={x:0,y:0,previous:{x:0,y:0},target:null,dx:1,dy:0,pause:0,grazing:true,blocked:0,distance:0,random:(Math.imul(this.seed+1,2654435761)^Math.imul(i+1,2246822519))>>>0};
   const start=Math.floor(this.random(a)*this.spots.length);
   let point:Point|undefined;
   for(let n=0;n<this.spots.length;n++){const s=this.spots[(start+n)%this.spots.length],p={x:s[0],y:s[1]};if(this.free(p,i)){point=p;break;}}
   // The capacity is lower than the number of patches. A moving herd can
   // temporarily occupy every patch's clearance; retry the newcomer later.
   if(!point)break;
   Object.assign(a,point);a.previous={...point};a.pause=.4+this.random(a)*5;
   this.animals.push(a);this.insert(a,i);
  }
 }
 private destination(a:Animal){
  let p:Point={x:a.x,y:a.y};
  for(let n=0;n<8;n++){
   const s=this.spots[Math.floor(this.random(a)*this.spots.length)];p={x:s[0],y:s[1]};
   if(Math.hypot(p.x-a.x,p.y-a.y)>Math.min(2,Math.max(this.w,this.h)*.4))break;
  }
  a.target=p;a.blocked=0;
 }
 private advance(){
  for(const a of this.animals)a.previous={x:a.x,y:a.y};
  // Rotate priority so the same animals cannot always win a narrow passage.
  for(let j=0;j<this.animals.length;j++){
   const i=(j+this.step)%this.animals.length,a=this.animals[i];
   if(a.pause>0){a.pause=Math.max(0,a.pause-TICK);continue;}
   if(!a.target)this.destination(a);
   let goal=a.target!;
   // Both endpoints are outside the shelter, but their diagonal can cut its
   // corner. Route via the open corner until the direct segment is clear.
   const dx=goal.x-a.x,dy=goal.y-a.y;
   if((a.x<.8&&goal.y<.8)||(a.y<.8&&goal.x<.8)){
    const cross=dx===0?0:(.78-a.x)/dx,y=a.y+dy*cross;
    if(cross>=0&&cross<=1&&y<.78)goal={x:.84,y:.84};
   }
   const gx=goal.x-a.x,gy=goal.y-a.y,length=Math.hypot(gx,gy);
   if(length<.025){
    if(goal===a.target){a.target=null;a.pause=2+this.random(a)*6;a.grazing=this.random(a)<.8;}
    continue;
   }
   const distance=Math.min(length,this.speed*TICK),ux=gx/length,uy=gy/length;
   let next:Point|undefined;
   // Small sidesteps let two animals pass. No reversed jitter or teleporting.
   const sign=i%2?1:-1;
   for(const angle of [0,sign*.55,-sign*.55,sign*1.05,-sign*1.05]){
    const c=Math.cos(angle),s=Math.sin(angle),p={x:a.x+(ux*c-uy*s)*distance,y:a.y+(ux*s+uy*c)*distance};
    if(this.free(p,i)){next=p;break;}
   }
   if(next){
    const old=this.cell(a);this.cells.get(old)!.delete(i);if(!this.cells.get(old)!.size)this.cells.delete(old);
    a.dx=next.x-a.x;a.dy=next.y-a.y;a.x=next.x;a.y=next.y;a.distance+=distance;a.blocked=0;this.insert(a,i);
   }else{
    a.blocked+=TICK;
    if(a.blocked>1.2){a.target=null;a.pause=.5+this.random(a)*1.5;a.grazing=true;a.blocked=0;}
   }
  }
  this.step++;
 }
 update(time:number,count:number){
  if(this.time===time&&this.animals.length===count)return;
  this.resize(count);
  if(this.time===undefined||time<this.time){this.time=time;this.remainder=0;return;}
  // A background tab must not replay minutes of cosmetic movement on resume.
  this.remainder+=Math.min(2,time-this.time);this.time=time;
  while(this.remainder>=TICK){this.advance();this.remainder-=TICK;}
 }
 pose(index:number){
  const a=this.animals[index];if(!a)return null;
  const f=this.remainder/TICK,x=a.previous.x+(a.x-a.previous.x)*f,y=a.previous.y+(a.y-a.previous.y)*f;
  return{x,y,dx:a.dx,dy:a.dy,walking:Math.hypot(a.x-a.previous.x,a.y-a.previous.y)>.001,grazing:a.grazing,phase:a.distance/this.speed};
 }
}
