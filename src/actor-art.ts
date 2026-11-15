import type Phaser from 'phaser';
import {opaqueBounds} from './rendering.js';
type Anchor={x:number;height:number};
const anchors=new WeakMap<object,Map<number,Anchor>>();
/** Trim atlas padding, anchor at the feet, and keep one body scale per facing.
 * Bending to serve must not stretch a character back up to standing height. */
export function prepareActorFrames(scene:Phaser.Scene,name:string,columns:number,rows=4){
 const texture=scene.textures.get(name),source=texture.getSourceImage() as HTMLImageElement;
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0);
 const entries=new Map<number,Anchor>();
 for(let row=0;row<rows;row++){
  const cells=[];
  for(let col=0;col<columns;col++){
   const x=Math.round(col*source.width/columns),y=Math.round(row*source.height/rows),w=Math.round((col+1)*source.width/columns)-x,h=Math.round((row+1)*source.height/rows)-y;
   const pixels=ctx.getImageData(x,y,w,h).data,box=opaqueBounds(pixels,w,h);
   let left=w,right=0;
   for(let py=box.y+Math.floor(box.height*.93);py<box.y+box.height;py++)for(let px=box.x;px<box.x+box.width;px++)if(pixels[(py*w+px)*4+3]>180){left=Math.min(left,px);right=Math.max(right,px);}
   cells.push({box,x,y,foot:right>=left?(left+right)/2:box.x+box.width/2});
  }
  const height=Math.max(...cells.map(c=>c.box.height));
  cells.forEach((c,col)=>{const frame=row*columns+col;texture.add(frame,0,c.x+c.box.x,c.y+c.box.y,c.box.width,c.box.height);entries.set(frame,{x:(c.foot-c.box.x)/c.box.width,height});});
 }
 anchors.set(texture,entries);canvas.width=canvas.height=1;
}
export function placeActor(sprite:Phaser.GameObjects.Image,name:string,frame:number,height=22){
 sprite.setTexture(name,frame);const anchor=anchors.get(sprite.texture)?.get(frame);
 sprite.setOrigin(anchor?.x??.5,1).setScale(height/(anchor?.height??sprite.frame.height)).setFlipX(false);
 return sprite;
}
