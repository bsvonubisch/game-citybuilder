import {sourceImage} from "./source-images.js";
import type Phaser from 'phaser';
import {marketLayout} from './market-layout.js';
import {iso} from './rendering.js';
import {FOUNDATION_HEIGHT} from './foundation.js';
import {groundHeight} from './terrain.js';
import type {Simulation} from './simulation.js';
import {prepareActorFrames} from './actor-art.js';
export function drawMarketStall(ctx:CanvasRenderingContext2D,variants:HTMLImageElement,produce:HTMLImageElement|undefined,variant:number,rotation:number,x:number,y:number){
 const green=variant===3&&produce,source=green?produce:variants,cols=green?2:4,rows=green?2:3;
 const frame=green?[0,1,3,2][rotation]:variant%3*4+[0,1,3,2][rotation];
 const cw=source.width/cols,ch=source.height/rows;
 const scale=green?42/ch:62/cw;
 // The produce sheet has extra transparent horizontal padding.
 const displayW=green?84:62,displayH=ch*scale,p=iso(x,y);
 ctx.drawImage(source,frame%cols*cw,Math.floor(frame/cols)*ch,cw,ch,p.x-displayW/2,p.y-displayH-FOUNDATION_HEIGHT,displayW,displayH);
}
export function drawMarket(ctx:CanvasRenderingContext2D,variants:HTMLImageElement,w:number,h:number,rotation:number,produce?:HTMLImageElement){
 for(const slot of marketLayout({x:0,y:0,plot:[w,h],rotation}).sort((a,b)=>a.stall.x+a.stall.y-b.stall.x-b.stall.y))drawMarketStall(ctx,variants,produce,slot.variant,rotation,slot.stall.x,slot.stall.y);
}
export function prepareVendorFrames(scene:Phaser.Scene){prepareActorFrames(scene,'market-vendors',4);}
export class MarketArt {
 private sprites:Phaser.GameObjects.Image[]=[];
 constructor(private scene:Phaser.Scene){}
 sync(sim:Simulation,depths:ReadonlyMap<number,number>){
  for(const s of this.sprites)s.destroy();this.sprites=[];
  for(const b of sim.state.buildings.filter(b=>b.kind==='market'&&!b.construction))for(const slot of marketLayout(b)){
   const name=`market-part-${slot.variant}-${b.rotation}`;
   if(!this.scene.textures.exists(name)){
    const texture=this.scene.textures.createCanvas(name,144*4,100*4)!,ctx=texture.context;ctx.scale(4,4);ctx.translate(72,84);
    drawMarketStall(ctx,sourceImage(this.scene,'market-stalls') as HTMLImageElement,sourceImage(this.scene,'market-produce') as HTMLImageElement,slot.variant,b.rotation,0,0);texture.refresh();
   }
   const p=iso(slot.stall.x,slot.stall.y),local=slot.stall.x-b.x+slot.stall.y-b.y;
   this.sprites.push(this.scene.add.image(p.x-72,p.y-84-groundHeight(b.x,b.y,sim.state.terrain),name).setOrigin(0).setScale(.25).setDepth((depths.get(b.id)??0)+.1+local*.08).setData('buildingId',b.id).setInteractive({pixelPerfect:true}));
  }
 }
}
