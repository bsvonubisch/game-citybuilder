import type Phaser from 'phaser';
import {isLivestock,LIVESTOCK,ensureHerd,livestockPose,livestockCrew,penPoint,type LivestockKind} from './livestock.js';
import {iso,fitGround,facing,type OccludingPlot} from './rendering.js';
import {groundHeight} from './terrain.js';
import {groundedArt} from './sprite-ground.js';
import {drawFoundation,FOUNDATION_HEIGHT} from './foundation.js';
import {dimensions,STEP} from './catalog.js';
import {daylight} from './daylight.js';
import {sourceImage} from './source-images.js';
import {placeActor,prepareActorFrames} from './actor-art.js';
import type {Building,Simulation} from './simulation.js';

const shelterFrames=new WeakMap<object,ReturnType<typeof groundedArt>[]>();
function shelterArt(source:HTMLImageElement){
 let frames=shelterFrames.get(source);if(frames)return frames;
 frames=[0,1,2,3].map(frame=>groundedArt({texture:'pen-shelter-cutout',frame,columns:2,rows:2,size:[627,627],ground:[[52,482],[310,613],[570,482]]},source));
 const scale=Math.min(...frames.map(art=>fitGround(art.contacts!,1,1,.06).scale));
 frames=frames.map(art=>({...art,scaleLimit:scale}));shelterFrames.set(source,frames);return frames;
}
export function drawPenShelter(ctx:CanvasRenderingContext2D,source:HTMLImageElement,rotation:number,stone?:HTMLImageElement){
 drawFoundation(ctx,1,1,stone);const art=shelterArt(source)[rotation],t=fitGround(art.contacts!,1,1,.06,art.scaleLimit),cw=source.width/2,ch=source.height/2;
 ctx.drawImage(source,(rotation%2)*cw,Math.floor(rotation/2)*ch,cw,ch,t.x,t.y-FOUNDATION_HEIGHT,cw*t.scale,ch*t.scale);
}
type PenEdge={a:{x:number;y:number};b:{x:number;y:number}};
export function penEdges(w:number,h:number,rotation:number){
 const pen={x:0,y:0,kind:'cattle' as const,rotation:rotation as 0|1|2|3,plot:[w,h] as const},edges:PenEdge[]=[];
 const [cw,ch]=rotation%2?[h,w]:[w,h];
 for(let x=0;x<cw;x++){
   edges.push({a:penPoint(pen,x-.5,-.5),b:penPoint(pen,x+.5,-.5)});
   if(x!==Math.floor(cw/2))edges.push({a:penPoint(pen,x-.5,ch-.5),b:penPoint(pen,x+.5,ch-.5)});
 }
 for(let y=0;y<ch;y++)for(const x of [-.5,cw-.5])edges.push({a:penPoint(pen,x,y-.5),b:penPoint(pen,x,y+.5)});
 return edges;
}
function drawRail(ctx:CanvasRenderingContext2D,edge:PenEdge){
 const a=iso(edge.a.x,edge.a.y),b=iso(edge.b.x,edge.b.y);
 ctx.lineCap='butt';
 for(const height of [3,7]){
   ctx.strokeStyle='#63432b';ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(a.x,a.y-height);ctx.lineTo(b.x,b.y-height);ctx.stroke();
   ctx.strokeStyle='#bd8b4c';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a.x,a.y-height-.8);ctx.lineTo(b.x,b.y-height-.8);ctx.stroke();
 }
 for(const p of [a,b]){ctx.fillStyle='#704b2f';ctx.fillRect(p.x-.9,p.y-9,1.8,9);ctx.fillStyle='#d4a369';ctx.fillRect(p.x-.9,p.y-9,1.8,.8);}
}
export function drawPen(ctx:CanvasRenderingContext2D,source:HTMLImageElement,kind:LivestockKind,w:number,h:number,rotation:number,stone?:HTMLImageElement,meadow?:HTMLImageElement,earth?:HTMLImageElement,parts=true){
 ctx.save();ctx.transform(32,16,-32,16,0,-16);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const image=kind==='pigs'&&earth?earth:meadow;
   if(image)ctx.drawImage(image,0,0,kind==='pigs'?image.width:image.width/2,kind==='pigs'?image.height:image.height/2,x,y,1,1);
   else{ctx.fillStyle=kind==='pigs'?'#8c6844':'#708f43';ctx.fillRect(x,y,1,1);}
 }
 ctx.restore();if(!parts)return;
 const edges=penEdges(w,h,rotation),p=penPoint({kind,x:0,y:0,rotation:rotation as 0|1|2|3,plot:[w,h]},0,0);
 const pieces=[...edges.map(edge=>({depth:(edge.a.x+edge.a.y+edge.b.x+edge.b.y)/2,draw:()=>drawRail(ctx,edge)})),{depth:p.x+p.y,draw:()=>{const v=iso(p.x,p.y);ctx.save();ctx.translate(v.x,v.y);drawPenShelter(ctx,source,rotation,stone);ctx.restore();}}];
 for(const piece of pieces.sort((a,b)=>a.depth-b.depth))piece.draw();
}
export class LivestockArt{
 private parts:Phaser.GameObjects.Image[]=[];
 private animals=new Map<string,Phaser.GameObjects.Image>();
 private depths:ReadonlyMap<number,number>=new Map();
 constructor(private scene:Phaser.Scene){for(const kind of Object.values(LIVESTOCK))prepareActorFrames(scene,`livestock-${kind.animal}`,4);}
 clear(){for(const p of this.parts)p.destroy();this.parts=[];for(const s of this.animals.values())s.destroy();this.animals.clear();}
 sync(sim:Simulation,depths:ReadonlyMap<number,number>){
   this.clear();this.depths=depths;
   for(const b of sim.state.buildings.filter(b=>isLivestock(b.kind)&&!b.construction)){
     const [w,h]=dimensions(b.kind,b.rotation,b.plot),base=depths.get(b.id)??0,elevation=groundHeight(b.x,b.y,sim.state.terrain);
     const add=(key:string,p:{x:number;y:number},paint:(ctx:CanvasRenderingContext2D)=>void)=>{
       if(!this.scene.textures.exists(key)){const texture=this.scene.textures.createCanvas(key,320,288)!,ctx=texture.context;ctx.scale(4,4);ctx.translate(40,56);paint(ctx);texture.refresh();}
       const v=iso(b.x+p.x,b.y+p.y);this.parts.push(this.scene.add.image(v.x-40,v.y-56-elevation,key).setOrigin(0).setScale(.25).setDepth(base+.1+(p.x+p.y)*.08).setData('buildingId',b.id).setInteractive({pixelPerfect:true}));
     };
     const home=penPoint({...b,x:0,y:0},0,0);add(`pen-shelter-${b.rotation}`,home,ctx=>drawPenShelter(ctx,sourceImage(this.scene,'livestock-shelter'),b.rotation,sourceImage(this.scene,'foundation-stone')));
     for(const edge of penEdges(w,h,b.rotation)){
       const p={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2},local={a:{x:edge.a.x-p.x,y:edge.a.y-p.y},b:{x:edge.b.x-p.x,y:edge.b.y-p.y}};
       add(`pen-rail-${local.a.x}-${local.a.y}`,p,ctx=>drawRail(ctx,local));
     }
   }
 }
 update(sim:Simulation,elapsed:number,people:Map<number,Phaser.GameObjects.Image>,plots:OccludingPlot[]){
   const day=daylight(sim.state.tick),time=(day.day*14+Math.max(0,Math.min(14,day.hour-6)))*10+(!day.night?elapsed:0),view=this.scene.cameras.main.worldView;
   const active=new Set<string>();
   for(const b of sim.state.buildings){
     if(!isLivestock(b.kind)||b.construction)continue;
     const config=LIVESTOCK[b.kind],base=this.depths.get(b.id)??0,z=groundHeight(b.x,b.y,sim.state.terrain);
     for(let i=0;i<ensureHerd(b).count;i++){
       const key=`${b.id}:${i}`,p=livestockPose(b,i,time),v=iso(p.x,p.y);let s=this.animals.get(key);
       active.add(key);
       if(!s){s=this.scene.add.image(v.x,v.y,`livestock-${config.animal}`).setData('buildingId',b.id).setInteractive({pixelPerfect:true});this.animals.set(key,s);}
       if(v.x<view.left-40||v.x>view.right+40||v.y<view.top-40||v.y>view.bottom+40){s.setVisible(false);continue;}
       const direction=facing(p.dx,p.dy),pose=!day.night&&p.walking?[0,1,0,2][Math.floor(p.phase*4)%4]:p.grazing&&!day.night?3:0;
       placeActor(s,`livestock-${config.animal}`,direction*4+pose,config.height);s.setPosition(v.x,v.y-z).setDepth(base+.1+(p.x-b.x+p.y-b.y)*.08).setVisible(true);
     }
     for(const [i,a] of livestockCrew(sim,b).entries()){
       const s=people.get(a.id);if(!s)continue;const [ww,hh]=dimensions(b.kind,b.rotation,b.plot),[cw,ch]=b.rotation%2?[hh,ww]:[ww,hh],p=penPoint(b,.8+(i%2)*(cw-1.4),Math.min(ch-.7,1+Math.floor(i/2)*.7)),v=iso(p.x,p.y),t=(sim.state.tick*STEP+elapsed+i*4)%12;
       const direction=facing(p.x-b.x,p.y-b.y),pose=t<2?[0,1,2,3][Math.floor(t*2)]:0;
       placeActor(s,'farm-workers',direction*4+pose);s.setPosition(v.x,v.y-z).setVisible(true).setDepth(base+.1+(p.x-b.x+p.y-b.y)*.08).setData('sized',false);
     }
   }
   for(const [key,s] of this.animals)if(!active.has(key)){s.destroy();this.animals.delete(key);}
 }
}
