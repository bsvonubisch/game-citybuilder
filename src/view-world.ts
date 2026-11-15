import {dimensions,isBuilding} from './catalog.js';
import {terrainCell} from './terrain.js';
import {quarter,turnPoint,turnBox,markView,sourceBuilding,sourceBrush} from './view-space.js';
import type {Agent,Building,Command,Point,Simulation,World} from './simulation.js';
import type {Decoration} from './decorations.js';
import {SIZE} from './catalog.js';

const key=(p:Point)=>`${p.x},${p.y}`;
const point=(k:string)=>{const[x,y]=k.split(',').map(Number);return{x,y};};
/** Read-only render facade. Jobs, traffic, inventories and saves stay canonical.
 * Stable objects and cached paths avoid reallocation on every rendered frame. */
export class ViewWorld {
 turn=0;
 private state!:World;
 private revision=-1;
 private tick=-1;
 private buildings=new Map<number,Building>();
 private agents=new Map<number,Agent>();
 private decorations=new Map<number,Decoration>();
 private paths=new WeakMap<Point[],{stamp:string;points:Point[]}>();
 private roadSet=new Set<string>();
 private facade:Simulation;
 constructor(public source:Simulation){
  const methods={
   building:(id:number)=>this.buildings.get(id),
   buildingAt:(x:number,y:number)=>{const p=this.from({x,y}),b=this.source.buildingAt(p.x,p.y);return b&&this.buildings.get(b.id);},
   decorationAt:(x:number,y:number)=>{const p=this.from({x,y}),d=this.source.decorationAt(p.x,p.y);return d&&this.decorations.get(d.id);},
   route:(a:Building,b:Building,kind?:Agent['kind'])=>{const path=this.source.route(this.original(a),this.original(b),kind);return path&&this.path(path);},
   adjacent:(b:Building)=>this.source.adjacent(this.original(b)).map(p=>this.to(p)),
   alert:(b:Building)=>this.source.alert(this.original(b)),
   status:(b:Building)=>this.source.status(this.original(b)),
   canPlace:(kind:Parameters<Simulation['canPlace']>[0],x:number,y:number,r=0,plot?:readonly[number,number])=>{
    if(isBuilding(kind)){const [w,h]=dimensions(kind,r,plot),p=turnBox({x,y},w,h,-this.turn);return this.source.canPlace(kind,p.x,p.y,quarter(r-this.turn),plot?p.plot:undefined);}
    const p=this.from({x,y});return this.source.canPlace(kind,p.x,p.y,kind==='fence'||kind==='streetlight'?quarter(r+this.turn):r);
   },
   canMove:(id:number,x:number,y:number,r:number)=>{const b=this.buildings.get(id);if(!b)return 'Building no longer exists.';const [w,h]=this.source.relocationPlot(b,quarter(r)),p=turnBox({x,y},w,h,-this.turn);return this.source.canMove(id,p.x,p.y,quarter(r-this.turn));},
   step:()=>{this.source.step();this.refresh();},
  };
  this.facade=new Proxy({} as Simulation,{get:(_,name)=>{
   if(name==='state')return this.state;if(name==='roads')return this.roadSet;
   if(name in methods)return methods[name as keyof typeof methods];
   const value=this.source[name as keyof Simulation];return typeof value==='function'?value.bind(this.source):value;
  }});
  markView(this.facade,source,0);
 }
 get simulation(){this.refresh();return this.turn?this.facade:this.source;}
 to(p:Point){return turnPoint(p,this.turn);}
 from(p:Point){return turnPoint(p,-this.turn);}
 facing(r:number){return quarter(r+this.turn);}
 setTurn(turn:number){this.turn=quarter(turn);this.state=undefined!;this.revision=-1;this.tick=-1;this.paths=new WeakMap();markView(this.facade,this.source,this.turn);this.refresh();}
 replace(source:Simulation){this.source=source;this.setTurn(this.turn);}
 private path(path:Point[]){const stamp=`${path.length}:${path[0]?.x}:${path[0]?.y}:${path.at(-1)?.x}:${path.at(-1)?.y}`;let p=this.paths.get(path);if(!p||p.stamp!==stamp){p={stamp,points:path.map(v=>this.to(v))};this.paths.set(path,p);}return p.points;}
 original(b:Building):Building{return sourceBuilding(b,this.turn);}
 private update<T extends {id:number}>(map:Map<number,T>,source:T):T{
  let target=map.get(source.id);if(!target){target={...source};map.set(source.id,target);}
  for(const k of Object.keys(target) as (keyof T)[])if(!(k in source))delete target[k];
  Object.assign(target,source);return markView(target,source,this.turn);
 }
 refresh(){
  if(!this.turn)return;
  const s=this.source.state,changed=!this.state||this.revision!==s.revision;
  if(!changed&&this.tick===s.tick)return;
  this.state??={...s};Object.assign(this.state,s);markView(this.state,s,this.turn);
  this.state.revision=s.revision*4+this.turn;
  if(changed){
   this.state.terrain={};for(let y=-1;y<=SIZE;y++)for(let x=-1;x<=SIZE;x++){const p=this.to({x,y});this.state.terrain[key(p)]={...terrainCell(x,y,s.terrain)};}
   this.state.roads=s.roads.map(k=>key(this.to(point(k))));this.roadSet=new Set(this.state.roads);
   this.state.roadTypes=Object.fromEntries(Object.entries(s.roadTypes??{}).map(([k,v])=>[key(this.to(point(k))),v]));
   this.state.clearedDeposits=s.clearedDeposits?.map(k=>key(this.to(point(k))));
  }
  // Object.assign above refreshes scalar state; retain projected static maps.
  if(!changed){this.state.terrain=this.staticTerrain;this.state.roads=this.staticRoads;this.state.roadTypes=this.staticRoadTypes;this.state.clearedDeposits=this.staticCleared;}
  else{this.staticTerrain=this.state.terrain;this.staticRoads=this.state.roads;this.staticRoadTypes=this.state.roadTypes;this.staticCleared=this.state.clearedDeposits;}
  const keep=new Set(s.buildings.map(b=>b.id));for(const id of this.buildings.keys())if(!keep.has(id))this.buildings.delete(id);
  this.state.buildings=s.buildings.map(b=>{
   const v=this.update(this.buildings,b),[w,h]=dimensions(b.kind,b.rotation,b.plot);Object.assign(v,turnBox(b,w,h,this.turn));v.rotation=this.facing(b.rotation);
   if(b.construction)v.construction={...b.construction,...(b.construction.clearance?{clearance:{...b.construction.clearance,tiles:b.construction.clearance.tiles.map(p=>this.to(p))}}:{})};
   if(b.fishing)v.fishing={...b.fishing,path:this.path(b.fishing.path)};
   if(b.forestry)v.forestry=b.forestry.map(t=>({...t,path:this.path(t.path)}));
   if(b.hunting)v.hunting=b.hunting.map(t=>({...t,path:this.path(t.path)}));
   if(b.mining)v.mining=b.mining.map(t=>({...t,rock:this.to(t.rock),path:this.path(t.path)}));
   if(b.field){
    const local=(p:Point)=>{const q=this.to({x:b.x+p.x,y:b.y+p.y});return{x:q.x-v.x,y:q.y-v.y};};
    const patch=(i:number)=>{const p=local({x:(i%(w*2))*.5-.25,y:Math.floor(i/(w*2))*.5-.25});return Math.round((p.y+.25)*2)*v.plot![0]*2+Math.round((p.x+.25)*2);};
    const cells:typeof b.field.cells=[];b.field.cells.forEach((cell,i)=>cells[patch(i)]=cell);
    v.field={...b.field,cells,tasks:b.field.tasks.map(t=>({...t,patch:patch(t.patch),path:t.path.map(local),entry:t.entry&&local(t.entry)}))};
   }
   return v;
  });
  this.state.agents=s.agents.map(a=>{const v=this.update(this.agents,a);v.path=this.path(a.path);return v;});
  const agentIds=new Set(s.agents.map(a=>a.id));for(const id of this.agents.keys())if(!agentIds.has(id))this.agents.delete(id);
  this.state.decorations=s.decorations.map(d=>{const v=this.update(this.decorations,d);Object.assign(v,this.to(d));if(d.side!==undefined)v.side=quarter(d.side-this.turn);if(d.edge!==undefined)v.edge=quarter(d.edge-this.turn);return v;});
  const decorationIds=new Set(s.decorations.map(d=>d.id));for(const id of this.decorations.keys())if(!decorationIds.has(id))this.decorations.delete(id);
  this.state.roadWorks=s.roadWorks?.map(w=>({...w,...this.to(w)}));
  this.state.wildlife=s.wildlife?.map(a=>({...a,...this.to(a),home:this.to(a.home),to:a.to&&this.to(a.to),heading:quarter(a.heading-this.turn)}));
  this.revision=s.revision;this.tick=s.tick;
 }
 private staticTerrain:World['terrain'];private staticRoads:string[]=[];private staticRoadTypes:World['roadTypes'];private staticCleared:World['clearedDeposits'];
 command(c:Command):Command{
  if(!this.turn)return c;
  if(c.type==='roadStroke'||c.type==='removeStroke')return{...c,from:this.from(c.from),to:this.from(c.to)};
  if(c.type==='terrain')return sourceBrush(this.simulation.state,c);
  if(c.type==='move'){
   const b=this.simulation.building(c.id);if(!b)return c;const rotation=c.rotation??b.rotation,[w,h]=this.source.relocationPlot(b,rotation),p=turnBox(c,w,h,-this.turn);return{...c,x:p.x,y:p.y,rotation:quarter(rotation-this.turn)};
  }
  if(c.type==='place'){
   if(isBuilding(c.kind)){const [w,h]=dimensions(c.kind,c.rotation,c.plot),p=turnBox(c,w,h,-this.turn);return{...c,x:p.x,y:p.y,rotation:quarter((c.rotation??0)-this.turn),...(c.plot?{plot:p.plot}:{})};}
   return{...c,...this.from(c),...(c.kind==='fence'||c.kind==='streetlight'?{rotation:quarter((c.rotation??0)+this.turn)}:{})};
  }
  if(c.type==='demolish')return{...c,...this.from(c)};
  return c;
 }
}
