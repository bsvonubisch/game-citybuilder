import type Phaser from "phaser";
import {iso} from "./rendering.js";
import {FENCE_DIRECTIONS} from "./fences.js";
import type {Decoration} from "./decorations.js";
import type {Point} from "./simulation.js";

export function planterMask(p:Point,decorations:readonly Decoration[],height:(p:Point)=>number=()=>0) {
  return FENCE_DIRECTIONS.reduce((mask,d,i)=>mask|(decorations.some(n=>n.kind==="planter"&&n.x===p.x+d.x&&n.y===p.y+d.y&&height(n)===height(p))?1<<i:0),0);
}
const corners=[{x:0,y:-16},{x:32,y:0},{x:0,y:16},{x:-32,y:0}];
// Mask directions: +x, +y, -x, -y. Edges share their exact tile boundary.
export const planterEdges=(mask:number)=>[[1,2],[2,3],[3,0],[0,1]].filter((_,i)=>!(mask&(1<<i)));
export function drawPlanter(ctx:CanvasRenderingContext2D,mask:number,flowers:CanvasImageSource,crop:{x:number;y:number;width:number;height:number},wood:HTMLImageElement) {
  const height=5;
  const shape=(raise=0)=>{ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y-raise):ctx.moveTo(p.x,p.y-raise));ctx.closePath();};
  shape(height);ctx.fillStyle="#47612e";ctx.fill();
  ctx.save();shape(height);ctx.clip();
  // Reuse the painted flowers from the existing planter, without its box.
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const p=iso((x-1.5)/3,(y-1.5)/3);
    ctx.drawImage(flowers,crop.x,crop.y,crop.width,crop.height,p.x-15,p.y-18,30,20);
  }
  ctx.restore();
  for(const [a,b] of planterEdges(mask)) {
    const p=corners[a],q=corners[b];
    ctx.save();ctx.transform(q.x-p.x,q.y-p.y,0,height,p.x,p.y-height);
    ctx.drawImage(wood,wood.width*.35,0,wood.width*.5,wood.height*.15,0,0,1,1);
    ctx.fillStyle=(a===1||a===2)?"#70442122":"#452a1844";ctx.fillRect(0,0,1,1);ctx.restore();
    ctx.beginPath();ctx.moveTo(p.x,p.y-height);ctx.lineTo(q.x,q.y-height);ctx.strokeStyle="#c3a06c";ctx.lineWidth=.65;ctx.stroke();
  }
}
export class PlanterArt {
  constructor(private scene:Phaser.Scene){}
  place(sprite:Phaser.GameObjects.Image,x:number,y:number,mask:number) {
    const name=`planter-${mask}`;
    if(!this.scene.textures.exists(name)) {
      const texture=this.scene.textures.createCanvas(name,66*4,44*4)!;
      const ctx=texture.context;ctx.scale(4,4);ctx.translate(33,26);
      const frame=this.scene.textures.getFrame("props",2);
      const source=this.scene.textures.get("props").getSourceImage() as HTMLImageElement;
      const wood=this.scene.textures.get("bridge-wood").getSourceImage() as HTMLImageElement;
      drawPlanter(ctx,mask,source,{x:frame.cutX+frame.width*.06,y:frame.cutY,width:frame.width*.87,height:frame.height*.45},wood);
      texture.refresh();
    }
    const p=iso(x,y);
    sprite.setTexture(name).setOrigin(0,0).setScale(.25).setPosition(p.x-33,p.y-26);
  }
}
