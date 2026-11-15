import {dimensions, footprint, type BuildingKind, type DecorationKind} from './catalog.js';
import {depositAt} from './deposits.js';
import {terrainNoise} from './decorations.js';
import {terrainCell} from './terrain.js';
import {roadEdges} from './streetlights.js';
import type {RoadType} from './roads.js';
import type {Building, World} from './simulation.js';

/** A hand-planned starting village. Only used for new towns, never save migration. */
export function seedStarterTown(world:World) {
  const roads=new Set<string>(); world.roadTypes={}; world.bridgeVersion=1;
  // An established first morning, with growing crops and a continuous riverbank.
  world.tick=960; world.terrain={};
  for(let y=3;y<=32;y++)world.terrain[`21,${y}`]={kind:'land',height:0};
  const road=(x:number,y:number,type:RoadType='stone')=>{const k=`${x},${y}`;roads.add(k);world.roadTypes![k]=type;};
  const across=(y:number,from:number,to:number,type:RoadType='stone')=>{for(let x=from;x<=to;x++)road(x,y,type);};
  const along=(x:number,from:number,to:number,type:RoadType='stone')=>{for(let y=from;y<=to;y++)road(x,y,type);};
  along(6,3,32); along(13,3,32); along(21,3,32);
  across(10,3,32); across(18,3,32,'brick'); across(25,3,21); across(32,3,32,'dirt');
  // A pedestrian garden loop and cottage lane, linked to the main streets.
  across(3,6,13,'pavement'); across(11,6,13,'pavement'); across(16,6,13,'pavement');
  along(7,11,16,'pavement'); along(12,11,16,'pavement');
  across(21,13,21); across(29,13,21,'dirt'); along(32,10,32,'dirt');
  const add=(kind:BuildingKind,x:number,y:number,rotation:Building['rotation'],extras:Partial<Building>={})=>{
    const b:Building={id:world.nextId++,kind,x,y,rotation,plot:dimensions(kind,rotation),inventory:{},progress:0,workers:0,connected:false,enabled:true,produced:0,...extras};
    world.buildings.push(b);return b;
  };
  // A mix of small cottages, timber houses, townhouses and one grand home.
  for(const [x,y,r,tier] of [[4,4,1,2],[4,7,1,1],[7,4,3,3],[7,7,3,2],[11,5,1,2],[11,8,1,1],[4,12,1,2],[4,15,1,1],[4,20,1,2],[4,23,1,1],[7,19,3,2],[7,22,3,1]] as const)
    add('house',x,y,r,{houseTier:tier});
  for(const [x,y,r] of [[10,4,2],[11,4,2],[10,17,0],[11,17,0]] as const)add('cottage',x,y,r);
  add('garden',8,12,0); add('park',11,19,1);
  add('market',14,11,3,{plot:[3,3],inventory:{bread:24,fish:20,potatoes:20,carrots:20,sausages:16,tools:6}});
  add('church',17,15,0); add('tavern',14,16,0);
  add('bakery',14,8,0,{inventory:{flour:10}});
  add('mill',17,8,0,{inventory:{grain:15}});
  add('butcher',11,22,1,{inventory:{meat:12}});
  add('workshop',17,11,2,{inventory:{metal:10}});
  add('brickworks',17,19,0,{inventory:{stone:12}});
  add('quarry',19,11,1); add('mine',19,14,1);
  add('sawmill',19,22,1,{inventory:{wood:15}});
  add('forester',17,27,0); add('hunter',4,28,1);
  add('warehouse',14,19,2,{inventory:{bread:140,fish:80,potatoes:60,carrots:60,sausages:40,meat:35,grain:60,flour:35,wood:200,planks:100,stone:160,metal:100,bricks:80,tools:20}});
  add('warehouse',14,27,3,{inventory:{wood:60,stone:30,planks:30}});
  add('farm',7,26,3,{plot:[5,4],crop:'wheat'});
  add('farm',14,22,3,{plot:[3,3],crop:'potatoes'});
  add('farm',17,23,0,{plot:[2,2],crop:'carrots'});
  // A fishing pier on the natural eastern bank, with a shore-side entrance.
  add('fishery',23,19,3); along(22,18,22);
  // Keep extraction seams exposed; only pre-existing street crossings are cleared.
  world.roads=[...roads];
  const occupied=world.buildings.flatMap(b=>footprint(b.kind,b.x,b.y,b.rotation,b.plot));
  world.clearedDeposits=[...new Set([...world.roads,...occupied.map(p=>`${p.x},${p.y}`)].filter(k=>{const[x,y]=k.split(',').map(Number);return !!depositAt({x,y});}))];
  for(const b of world.buildings.filter(b=>b.kind==='farm')) {
    const [w,h]=b.plot!;
    // Established fields demonstrate growth immediately, with no instant harvest.
    b.field={cells:Array.from({length:w*h*4},(_,i)=>({sownAt:world.tick-480-(Math.floor(i/(w*2))%4)*140})),tasks:[],phase:'harvesting'};
  }
  world.money=5000;
  world.history=['Welcome to Pinehaven. Explore the market square, riverside and woodland workshops.'];
}

/** Sparse ornamental planting in town; dense, harvestable woodland by the lodge. */
export function landscapeStarterTown(world:World) {
  const roads=new Set(world.roads),occupied=new Set(world.buildings.flatMap(b=>footprint(b.kind,b.x,b.y,b.rotation,b.plot).map(p=>`${p.x},${p.y}`)));
  world.decorations=world.decorations.filter(d=>!(d.x>=3&&d.x<=22&&d.y>=2&&d.y<=34));
  const decorated=new Set(world.decorations.map(d=>`${d.x},${d.y}`));
  const add=(kind:DecorationKind,x:number,y:number,natural=false)=>{
    const k=`${x},${y}`;
    if(roads.has(k)||occupied.has(k)||decorated.has(k)||depositAt({x,y})||terrainCell(x,y,world.terrain).kind==='water')return;
    decorated.add(k);world.decorations.push({id:world.nextId++,kind,x,y,natural});
  };
  for(const [x,y] of [[9,5],[9,8],[3,10],[9,11],[12,16],[3,18],[10,20],[9,24],[18,18],[17,25],[22,19],[22,22],[16,26]])add('blossom',x,y);
  for(const [x,y] of [[10,5],[10,8],[9,17],[12,17],[10,21],[10,22],[10,23],[16,14],[17,14],[18,14],[16,17],[3,13],[3,14],[3,21],[3,22]])add('planter',x,y);
  for(const [x,y] of [[9,6],[10,16],[12,24],[16,18],[22,20]])add('bench',x,y);
  // Forest surrounds both lodges and continues into protected wilderness.
  for(let y=25;y<=39;y++)for(let x=1;x<=21;x++) {
    if(x>5&&x<16)continue;
    const n=terrainNoise(x,y);
    if(n>.27)add(n>.58?'pine':n>.4?'oak':'birch',x,y,true);
  }
  for(const k of world.roads) {
    const[x,y]=k.split(',').map(Number);
    if(x>22||y>25||terrainCell(x,y,world.terrain).kind==='water'||(x+y)%4!==0)continue;
    const edges=roadEdges(roads,{x,y});if(!edges.length)continue;
    world.decorations.push({id:world.nextId++,kind:'streetlight',x,y,natural:false,edge:edges[0] as 0|1|2|3});
  }
}
