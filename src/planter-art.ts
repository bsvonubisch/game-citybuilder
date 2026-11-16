import {sourceImage} from "./source-images.js";
import type Phaser from "phaser";
import {iso} from "./rendering.js";
import {FOUNDATION_HEIGHT} from './foundation.js';
import {turnPoint} from './view-space.js';
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
// Mask directions: +x, +y, -x, -y. Edges share their exact tile boundary.
export const planterEdges=(mask:number)=>[[1,2],[2,3],[3,0],[0,1]].filter((_,i)=>!(mask&(1<<i)));
export function planterGeometry(mask:number) {
  const thickness=.045;
  const left=-.5+(mask&4?0:thickness),right=.5-(mask&1?0:thickness);
  const back=-.5+(mask&8?0:thickness),front=.5-(mask&2?0:thickness);
  return {height:FOUNDATION_HEIGHT,soil:FOUNDATION_HEIGHT-.8,
    outer:[iso(-.5,-.5),iso(.5,-.5),iso(.5,.5),iso(-.5,.5)],
    inner:[iso(left,back),iso(right,back),iso(right,front),iso(left,front)]};
}
export const plantCrops=(image:{width:number;height:number})=>Array.from({length:8},(_,i)=>({x:i%4*image.width/4,y:Math.floor(i/4)*image.height/2,width:image.width/4,height:image.height/2}));
/** One continuous flower field, sampled by every tile including a halo of
 * neighbouring blooms. A two-tile repeat bounds texture memory, while scattered
 * positions and species avoid the old per-tile stripes and clipped blossoms. */
export function planterFlowers(tile:Point,turn=0) {
  const flowers=[];
  for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++){
    const anchor=turnPoint({x:tile.x+x/3,y:tile.y+y/3},-turn);
    const gx=Math.round(anchor.x*3),gy=Math.round(anchor.y*3),mx=(gx%6+6)%6,my=(gy%6+6)%6;
    const random=(salt:number)=>{const n=Math.sin(mx*127.1+my*311.7+salt*74.7)*43758.5453;return n-Math.floor(n);};
    const point=turnPoint({x:gx/3+(random(1)-.5)*.18,y:gy/3+(random(2)-.5)*.18},turn);
    flowers.push({id:`${gx},${gy}`,point,crop:Math.floor(random(3)*8),size:23+random(4)*4});
  }
  return flowers.sort((a,b)=>a.point.x+a.point.y-b.point.x-b.point.y||a.point.x-b.point.x);
}
export function drawPlanter(ctx:CanvasRenderingContext2D,mask:number,flowers:CanvasImageSource,crops:ReturnType<typeof plantCrops>,wood:HTMLImageElement,variant=0,turn=0) {
  const {height,soil,outer,inner}=planterGeometry(mask),edges=planterEdges(mask);
  const shape=(points:Point[])=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};
  const raised=(points:Point[],z:number)=>points.map(p=>({x:p.x,y:p.y-z}));
  const panel=(p:Point,q:Point,top:number,bottom:number,shade:string)=>{
    ctx.save();ctx.transform(q.x-p.x,q.y-p.y,0,top-bottom,p.x,p.y-top);
    // One complete painted timber board, without the nearly opaque black tint.
    ctx.drawImage(wood,wood.width*.04,wood.height*.012,wood.width*.43,wood.height*.13,0,0,1,1);
    ctx.fillStyle=shade;ctx.fillRect(0,0,1,1);ctx.restore();
  };
  shape(raised(inner,soil));ctx.fillStyle="#47612e";ctx.fill();
  ctx.save();shape(raised(inner,soil));ctx.clip();
  const phase={x:variant%2,y:Math.floor(variant/2)};
  for(const flower of planterFlowers(phase,turn)){
    const p=iso(flower.point.x-phase.x,flower.point.y-phase.y),crop=crops[flower.crop],size=flower.size;
    ctx.drawImage(flowers,crop.x,crop.y,crop.width,crop.height,p.x-size/2,p.y-soil-size*.72,size,size*.9);
  }
  ctx.restore();
  for(const [a,b] of edges) {
    const p=outer[a],q=outer[b],near=a===1||a===2;
    // Only near exterior faces are visible. At the back, show the shallow
    // inside lip instead of painting a full-height board across the flowers.
    if(near)panel(p,q,height,0,a===1?'#65513d73':'#77614b66');
    else panel(inner[a],inner[b],height,soil,'#66554066');
    const cap=raised([p,q,inner[b],inner[a]],height);
    shape(cap);ctx.fillStyle=near?'#b89465':'#c5a174';ctx.fill();
    // Clip the highlight inside its cap; strokes must not leak into a road or
    // an adjacent foundation, or leave a divider on a joined bed.
    ctx.save();shape(cap);ctx.clip();ctx.beginPath();ctx.moveTo(p.x,p.y-height);ctx.lineTo(q.x,q.y-height);
    ctx.strokeStyle='#dec294';ctx.lineWidth=.55;ctx.stroke();ctx.restore();
  }
}
export class PlanterArt {
  constructor(private scene:Phaser.Scene){}
  place(sprite:Phaser.GameObjects.Image,x:number,y:number,mask:number,turn=0) {
    const variant=((x%2+2)%2)+2*((y%2+2)%2),name=`planter-${mask}-${variant}-${turn}`;
    if(!this.scene.textures.exists(name)) {
      const texture=this.scene.textures.createCanvas(name,66*4,44*4)!;
      const ctx=texture.context;ctx.scale(4,4);ctx.translate(33,26);
      const source=sourceImage(this.scene,"planter-plants") as HTMLImageElement;
      const wood=sourceImage(this.scene,"bridge-wood") as HTMLImageElement;
      drawPlanter(ctx,mask,source,plantCrops(source),wood,variant,turn);
      texture.refresh();
    }
    const p=iso(x,y);
    sprite.setTexture(name).setOrigin(0,0).setScale(.25).setPosition(p.x-33,p.y-26);
  }
}
