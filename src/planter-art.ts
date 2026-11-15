import {sourceImage} from "./source-images.js";
import type Phaser from "phaser";
import {iso} from "./rendering.js";
import {FENCE_DIRECTIONS} from "./fences.js";
import type {Decoration} from "./decorations.js";
import type {Point} from "./simulation.js";

export function planterMask(p:Point,decorations:readonly Decoration[],height:(p:Point)=>number=()=>0,hasFoundation:(p:Point)=>boolean=()=>false) {
  return FENCE_DIRECTIONS.reduce((mask,d,i)=>{
    const neighbor={x:p.x+d.x,y:p.y+d.y};
    const joined=height(neighbor)===height(p)&&(hasFoundation(neighbor)||decorations.some(n=>n.kind==="planter"&&n.x===neighbor.x&&n.y===neighbor.y));
    return mask|(joined?1<<i:0);
  },0);
}
const corners=[{x:0,y:-16},{x:32,y:0},{x:0,y:16},{x:-32,y:0}];
// Mask directions: +x, +y, -x, -y. Edges share their exact tile boundary.
export const planterEdges=(mask:number)=>[[1,2],[2,3],[3,0],[0,1]].filter((_,i)=>!(mask&(1<<i)));
export const plantCrops=(image:{width:number;height:number})=>Array.from({length:8},(_,i)=>({x:i%4*image.width/4,y:Math.floor(i/4)*image.height/2,width:image.width/4,height:image.height/2}));
export function drawPlanter(ctx:CanvasRenderingContext2D,mask:number,flowers:CanvasImageSource,crops:ReturnType<typeof plantCrops>,wood:HTMLImageElement,variant=0) {
  const height=5;
  const shape=(raise=0)=>{ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y-raise):ctx.moveTo(p.x,p.y-raise));ctx.closePath();};
  shape(height);ctx.fillStyle="#47612e";ctx.fill();
  ctx.save();shape(height);ctx.clip();
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const p=iso((x-1.5)/3,(y-1.5)/3),crop=crops[(x*3+y*5+variant*2)%crops.length];
    ctx.drawImage(flowers,crop.x,crop.y,crop.width,crop.height,p.x-14,p.y-19,28,24);
  }
  ctx.restore();
  for(const [a,b] of planterEdges(mask)) {
    const p=corners[a],q=corners[b];
    ctx.save();ctx.transform(q.x-p.x,q.y-p.y,0,height,p.x,p.y-height);
    ctx.drawImage(wood,wood.width*.35,0,wood.width*.5,wood.height*.15,0,0,1,1);
    ctx.fillStyle=(a===1||a===2)?"#301c0e99":"#21160cbb";ctx.fillRect(0,0,1,1);ctx.restore();
    ctx.beginPath();ctx.moveTo(p.x,p.y-height);ctx.lineTo(q.x,q.y-height);ctx.strokeStyle="#856741";ctx.lineWidth=.65;ctx.stroke();
  }
}
export class PlanterArt {
  constructor(private scene:Phaser.Scene){}
  place(sprite:Phaser.GameObjects.Image,x:number,y:number,mask:number) {
    const variant=((x*7+y*11)%4+4)%4,name=`planter-${mask}-${variant}`;
    if(!this.scene.textures.exists(name)) {
      const texture=this.scene.textures.createCanvas(name,66*4,44*4)!;
      const ctx=texture.context;ctx.scale(4,4);ctx.translate(33,26);
      const source=sourceImage(this.scene,"planter-plants") as HTMLImageElement;
      const wood=sourceImage(this.scene,"bridge-wood") as HTMLImageElement;
      drawPlanter(ctx,mask,source,plantCrops(source),wood,variant);
      texture.refresh();
    }
    const p=iso(x,y);
    sprite.setTexture(name).setOrigin(0,0).setScale(.25).setPosition(p.x-33,p.y-26);
  }
}
