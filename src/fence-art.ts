import {sourceImage} from "./source-images.js";
import type Phaser from "phaser";
import {iso,opaqueBounds} from "./rendering.js";
import {fenceEnds,fencePostMask,canonicalFence} from "./fences.js";
import type {Decoration} from "./decorations.js";
export function fenceCrops(image:HTMLImageElement){
 const c=document.createElement('canvas');c.width=Math.floor(image.width/2);c.height=Math.floor(image.height/2);const ctx=c.getContext('2d')!;
 return Array.from({length:4},(_,i)=>{ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(image,(i%2)*c.width,Math.floor(i/2)*c.height,c.width,c.height,0,0,c.width,c.height);const b=opaqueBounds(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height);return{...b,x:b.x+(i%2)*c.width,y:b.y+Math.floor(i/2)*c.height};});
}
export function drawPicketFence(ctx:CanvasRenderingContext2D,source:HTMLImageElement,crops:ReturnType<typeof fenceCrops>,side:number,posts=3){
 const [a,b]=fenceEnds({x:0,y:0},side).map(p=>iso(p.x,p.y)),crop=crops[side<2?0:1];
 ctx.save();ctx.transform(b.x-a.x,b.y-a.y,0,1,a.x,a.y);ctx.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,-13,1,13);ctx.restore();
 const post=crops[side<2?2:3],height=14,width=post.width/post.height*height;
 [a,b].forEach((p,i)=>{if(posts&(1<<i))ctx.drawImage(source,post.x,post.y,post.width,post.height,p.x-width/2,p.y-height,width,height);});
}
export class FenceArt {
 private crops?:ReturnType<typeof fenceCrops>;
 constructor(private scene:Phaser.Scene){}
 place(sprite:Phaser.GameObjects.Image,d:Pick<Decoration,'id'|'x'|'y'|'side'>,decorations:readonly Decoration[]){
  d={...d,...canonicalFence(d)};
  const side=d.side??1,posts=fencePostMask(d,decorations),name='pickets-'+side+'-'+posts;
  if(!this.scene.textures.exists(name)){
   const texture=this.scene.textures.createCanvas(name,76*4,76*4)!,ctx=texture.context;
   const source=sourceImage(this.scene,'fence-pickets') as HTMLImageElement;
   this.crops??=fenceCrops(source);ctx.scale(4,4);ctx.translate(38,48);drawPicketFence(ctx,source,this.crops,side,posts);texture.refresh();
  }
  const p=iso(d.x,d.y);sprite.setTexture(name).setOrigin(0).setScale(.25).setPosition(p.x-38,p.y-48);
 }
}
