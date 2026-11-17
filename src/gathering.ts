import {SIZE,footprint} from './catalog.js';
import {DAY_TICKS} from './daylight.js';
import {isTree} from './trees.js';
import {terrainCell} from './terrain.js';
import {DEPOSIT_TILES} from './deposits.js';
import {terrainNoise,type Decoration} from './decorations.js';
import type {World} from './simulation.js';

export const BERRY_REGROW_TICKS=DAY_TICKS*2;
export const berryRipe=(d:Decoration,tick:number)=>d.kind==='berry'&&(d.ripeAt??0)<=tick;
/** One-time addition to empty wild land, including existing player towns.
 * IDs, removed bushes and fruit deadlines persist; reload never reseeds them. */
export function seedBerryBushes(world:World){
 if(world.berriesVersion===1)return;
 const occupied=new Set(world.decorations.map(d=>`${d.x},${d.y}`));
 const blocked=new Set<string>(Object.keys(DEPOSIT_TILES));
 for(const b of world.buildings)for(const p of footprint(b.kind,b.x,b.y,b.rotation,b.plot))for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)blocked.add(`${p.x+x},${p.y+y}`);
 for(const road of world.roads){const [x,y]=road.split(',').map(Number);for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])blocked.add(`${x+dx},${y+dy}`);}
 const woodland=new Set<string>();
 for(const d of world.decorations.filter(d=>d.natural&&isTree(d.kind)))for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)woodland.add(`${d.x+x},${d.y+y}`);
 const candidates=[];
 for(let y=1;y<SIZE-1;y++)for(let x=1;x<SIZE-1;x++){
  const k=`${x},${y}`,n=terrainNoise(x+71,y+29);
  if(occupied.has(k)||blocked.has(k)||!woodland.has(k)||terrainCell(x,y,world.terrain).kind!=='land'||n>.22)continue;
  candidates.push({x,y,n});
 }
 candidates.sort((a,b)=>a.n-b.n);
 const planted:{x:number;y:number}[]=[];
 for(const p of candidates){if(planted.length>=140)break;if(planted.some(d=>Math.abs(d.x-p.x)+Math.abs(d.y-p.y)<2))continue;
  planted.push(p);world.decorations.push({id:world.nextId++,kind:'berry',x:p.x,y:p.y,natural:true});
 }
 world.berriesVersion=1;
}
