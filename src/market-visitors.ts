import {marketLayout} from './market-layout.js';
import {lanePose} from './lanes.js';
import type {Agent,Building,Point} from './simulation.js';
const SPEED=.8;
const cache=new WeakMap<Agent,{key:string;path:Point[];length:number;duration:number}>();
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Walk along the plot aisles, excluding stall bodies, instead of teleporting
 * from the road to a stationary customer pose. Quarter-tile navigation also
 * works for the smallest 1×1 market and all rectangular rotations. */
export function marketVisit(b:Building,a:Agent){
 const slots=marketLayout(b),slot=slots[a.marketSlot??0],entry=lanePose(a,0),[w,h]=b.plot??[2,2];
 const key=`${b.x},${b.y},${w},${h},${b.rotation},${a.marketSlot},${entry.x},${entry.y}`;
 const old=cache.get(a);if(old?.key===key)return old;
 const cols=w*4,rows=h*4,point=(i:number)=>({x:b.x-.375+(i%cols)*.25,y:b.y-.375+Math.floor(i/cols)*.25});
 const open=(i:number)=>slots.every(s=>{const p=point(i),dx=p.x-s.stall.x,dy=p.y-s.stall.y;return s.rotation%2?Math.abs(dx)>.20||Math.abs(dy)>.35:Math.abs(dx)>.35||Math.abs(dy)>.20;});
 const allowed=Array.from({length:cols*rows},(_,i)=>i).filter(open),boundary=allowed.filter(i=>i%cols===0||i%cols===cols-1||i<cols||i>=cols*(rows-1));
 const target=slot?.customer??entry;
 const goal=[...allowed].sort((a,c)=>distance(point(a),target)-distance(point(c),target))[0];
 const parents=new Map<number,number|null>();if(goal!==undefined)parents.set(goal,null);
 const queue=goal===undefined?[]:[goal];
 for(let n=0;n<queue.length;n++){const i=queue[n],x=i%cols,y=Math.floor(i/cols);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*cols+nx;if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&!parents.has(j)&&open(j)){parents.set(j,i);queue.push(j);}}}
 const gate=boundary.filter(i=>parents.has(i)).sort((a,c)=>distance(point(a),entry)-distance(point(c),entry))[0];
 const path:Point[]=[{x:entry.x,y:entry.y}];let next:number|null=gate??null;
 while(next!==null){path.push(point(next));next=parents.get(next)??null;}
 path.push({...target});
 const length=path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0),duration=2*length/SPEED+5+(a.id%3);
 const visit={key,path,length,duration};cache.set(a,visit);return visit;
}
export function marketCustomerPose(b:Building,a:Agent,elapsed=0){
 const visit=marketVisit(b,a),time=Math.max(0,visit.duration-Math.max(0,a.wait-elapsed)),travel=visit.length/SPEED;
 const departing=time>visit.duration-travel,walking=time<travel||departing;
 const d=departing?Math.max(0,(visit.duration-time)*SPEED):Math.min(visit.length,time*SPEED);
 let left=d,p=visit.path[0],dx=0,dy=0;
 for(let i=1;i<visit.path.length;i++){const from=visit.path[i-1],to=visit.path[i],length=distance(from,to);if(left<=length||i===visit.path.length-1){const t=length?Math.min(1,left/length):1;p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};dx=(to.x-from.x)*(departing?-1:1);dy=(to.y-from.y)*(departing?-1:1);break;}left-=length;}
 return {...p,dx,dy,walking,distance:departing?visit.length+(visit.length-d):d,browsing:!walking,time,serviceTime:Math.max(0,time-travel)};
}
