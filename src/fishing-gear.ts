import { WATER_DROP } from './water-level.js';
import type Phaser from 'phaser';
import type {Point} from './simulation.js';
import {iso} from './rendering.js';
import {fishingNet} from './fishing-motion.js';

// Hand contacts measured relative to the existing trimmed boat images.
const HANDS=[[.54,.43],[.46,.43],[.51,.44],[.49,.44]] as const;
/** Small projected rope/net geometry; the upright boat art stays unchanged. */
export function drawFishingGear(g:Phaser.GameObjects.Graphics,water:Phaser.GameObjects.Graphics,sprite:Phaser.GameObjects.Image,
 pose:Point&{dx:number;dy:number;frame:number},side:number,progress:number,duration:number,time:number){
 const work=fishingNet(progress,duration),normal={x:-pose.dy*side,y:pose.dx*side};
 const near=normal.x+normal.y>0;
 g.setDepth(sprite.depth+(near?.15:-.15));
 const [hx,hy]=HANDS[pose.frame],hand={x:sprite.x+(hx-sprite.originX)*sprite.displayWidth,y:sprite.y+(hy-sprite.originY)*sprite.displayHeight-WATER_DROP};
 const reach=.22+work.extension*.6,ground={x:pose.x+normal.x*reach,y:pose.y+normal.y*reach},surface=iso(ground.x,ground.y);
 const lift=(1-work.extension)*8,center={x:surface.x,y:surface.y-lift};
 const radius=.09+work.extension*.15,bag=work.hauling?2.8*(1-work.extension):0;
 const rim=Array.from({length:13},(_,i)=>{const a=i/12*Math.PI*2,p=iso(ground.x+Math.cos(a)*radius,ground.y+Math.sin(a)*radius);return{x:p.x,y:p.y-lift};});
 const alpha=work.visibility;
 // A slack rope connects the fisher's hands to the net; its bend tightens on hauling.
 const rope=[hand,{x:hand.x+(center.x-hand.x)*.42,y:hand.y+(center.y-hand.y)*.42+(work.hauling?1:3)},center];
 g.lineStyle(.95,0x5b4931,Math.max(.35,alpha*.8)).strokePoints(rope,false);
 g.lineStyle(.42,0xdfca92,Math.max(.3,alpha)).strokePoints(rope,false);
 if(!work.soaking&&alpha>.01){
  // Diamond mesh collapses into a hanging bag as the catch is lifted.
  g.fillStyle(0x766b47,.13*alpha).fillPoints(rim,true);
  g.lineStyle(.55,0xddc89b,.72*alpha).strokePoints(rim,false);
  const bottom={x:center.x,y:center.y+bag};
  for(let i=0;i<12;i+=2){g.lineStyle(.4,0xe4d4ad,.65*alpha).strokePoints([rim[i],bottom,rim[(i+5)%12]],false);}
  for(let i=1;i<3;i++){
   const f=i/3,ring=rim.map(p=>({x:bottom.x+(p.x-bottom.x)*f,y:bottom.y+(p.y-bottom.y)*f}));
   g.lineStyle(.35,0xc6b48c,.65*alpha).strokePoints(ring,false);
  }
  if(work.catchVisible){
   for(let i=0;i<2;i++){
    const x=center.x+(i-.5)*2.1,y=center.y+bag*.45+i*.8;
    g.fillStyle(0x405c65,alpha).fillEllipse(x,y,2.8,1.35);
    g.fillStyle(0xdbece2,alpha).fillEllipse(x-.2,y-.25,2.1,.7);
    g.fillTriangle(x+1,y,x+2,y-.65,x+2,y+.65);
   }
  }
 }
 // Cork floats and water rings remain on the surface while the net is submerged.
 if(work.extension>.65){
  for(const i of [0,4,8]){
   const r=rim[i],dy=Math.sin(time*2.7+i)*.3;
   water.fillStyle(0x8d582e,.8).fillEllipse(r.x,r.y+lift+dy,1.8,1);
   water.fillStyle(0xf3d79b,.9).fillEllipse(r.x,r.y+lift+dy-.4,1.3,.7);
  }
  const pulse=(progress*.5)%1;
  water.lineStyle(.65,0xc9f2e4,(1-pulse)*.48).strokeEllipse(surface.x,surface.y,10+pulse*11,5+pulse*5.5);
 }
 if(work.dripping){
  for(let i=0;i<3;i++){
   const t=(progress*3+i/3)%1,x=center.x+(i-1)*1.6,y=center.y+bag+t*Math.max(1,lift-bag);
   g.lineStyle(.6,0xd4f4e8,(1-t)*.7).lineBetween(x,y,x,y+1.2);
  }
  water.lineStyle(.65,0xd4f4e8,.45).strokeEllipse(surface.x,surface.y,5+(progress*4%1)*6,2.5+(progress*4%1)*3);
 }
}
