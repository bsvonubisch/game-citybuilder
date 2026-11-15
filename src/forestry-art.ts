import type Phaser from "phaser";
import { DECORATIONS, STEP } from "./catalog.js";
import { iso, facing, travellerDepth, opaqueBounds, type OccludingPlot } from "./rendering.js";
import { groundHeight } from "./terrain.js";
import { walkFrame } from "./animation.js";
import { forestPosition, treeStage } from "./forestry.js";
import type { Simulation } from "./simulation.js";
import type { Decoration } from "./decorations.js";

export function prepareForestryFrames(scene:Phaser.Scene, name="forestry") {
  const texture=scene.textures.get(name), source=texture.getSourceImage() as HTMLImageElement;
  const c=document.createElement("canvas");c.width=source.width;c.height=source.height;
  const ctx=c.getContext("2d",{willReadFrequently:true})!;ctx.drawImage(source,0,0);
  for(let frame=0;frame<20;frame++) {
    const x=Math.round(frame%4*source.width/4), y=Math.round(Math.floor(frame/4)*source.height/5);
    const w=Math.round((frame%4+1)*source.width/4)-x, h=Math.round((Math.floor(frame/4)+1)*source.height/5)-y;
    if(frame<16) texture.add(frame,0,x,y,w,h);
    else {
      const box=opaqueBounds(ctx.getImageData(x,y,w,h).data,w,h);
      texture.add(frame,0,x+box.x,y+box.y,box.width,box.height);
    }
  }
}
export class ForestryArt {
  private logs=new Map<number,Phaser.GameObjects.Image>();
  private chips=new Map<number,Phaser.GameObjects.Graphics>();
  constructor(private scene:Phaser.Scene) {}
  clear() { for(const s of this.logs.values())s.destroy();for(const s of this.chips.values())s.destroy();this.logs.clear();this.chips.clear(); }
  update(sim:Simulation, elapsed:number, people:Map<number,Phaser.GameObjects.Image>, trees:Phaser.GameObjects.Image[], plots:OccludingPlot[]) {
    for(const sprite of trees) {
      const d=sprite.getData("decoration") as Decoration|undefined;
      if(!d)continue;
      const stage=treeStage(d,sim.state.tick);
      if(sprite.getData("growth")===stage)continue;
      sprite.setData("growth",stage);
      const def=DECORATIONS[d.kind];
      if(stage==="stump")sprite.setTexture("forestry",16).setOrigin(.5,1).setScale(9/this.scene.textures.getFrame("forestry",16).height);
      else if(d.cutAt!==undefined)sprite.setTexture(def.texture,def.frame).setOrigin(.5,1).setScale(def.height/sprite.frame.height*(stage==="sapling"?.28:stage==="young"?.6:1));
    }
    const live=new Set<number>();
    for(const b of sim.state.buildings) for(const trip of [...(b.forestry??[]).map(t=>({...t,rock:undefined})),...(b.mining??[]).map(t=>({...t,tree:-1,phase:t.phase==="mining"?"chopping" as const:t.phase}))]) {
      const agent=sim.state.agents.find(a=>a.resident===trip.resident&&a.onsite===b.id), s=agent&&people.get(agent.id);
      if(!s||!agent)continue;
      live.add(agent.id);
      const p=forestPosition(trip,elapsed), v=iso(p.x,p.y);
      const miner=!!trip.rock, texture=miner?"mining":"forestry";
      const tree=trip.rock??sim.state.decorations.find(d=>d.id===trip.tree);
      const direction=trip.phase==="chopping"&&tree ? facing(tree.x-p.x,tree.y-p.y) : facing(p.dx,p.dy);
      const clock=sim.state.tick*STEP+elapsed;
      const frame=[0,1,1,2,3,0][Math.floor(clock*6+trip.resident)%6];
      if(trip.phase==="chopping")s.setTexture(texture,direction*4+frame).setOrigin([.44,.56,.56,.44][direction],.97).setScale(29/s.frame.height).setFlipX(false);
      else {
        const pose=walkFrame(direction,0,trip.distance+elapsed*.75,false);
        s.setTexture("walkers",pose.frame).setOrigin(.5,.91).setScale(24/s.frame.height).setFlipX(pose.flip);
      }
      s.setPosition(v.x,v.y-groundHeight(p.x,p.y,sim.state.terrain)).setVisible(true);
      s.setDepth(travellerDepth(p,{left:s.x-s.displayWidth*s.originX,right:s.x+s.displayWidth*(1-s.originX),top:s.y-s.displayHeight*s.originY,bottom:s.y+s.displayHeight*(1-s.originY)},plots));
      let logs=this.logs.get(agent.id);
      const cargoFrame=miner?(b.kind==="quarry"?16:17):17;
      if(!logs){logs=this.scene.add.image(0,0,texture,cargoFrame).setOrigin(.5,.5);this.logs.set(agent.id,logs);}
      logs.setTexture(texture,cargoFrame).setScale((miner?8:12)/this.scene.textures.getFrame(texture,cargoFrame).width);
      logs.setPosition(s.x+(direction===0||direction===3?3:-3),s.y-10).setDepth(s.depth+.1).setVisible(trip.cargo>0);
      let chips=this.chips.get(agent.id);
      if(!chips){chips=this.scene.add.graphics();this.chips.set(agent.id,chips);}
      chips.clear().setDepth(s.depth+.2);
      if(trip.phase==="chopping"&&tree&&frame===2) {
        const at=iso(tree.x,tree.y), phase=(clock*6)%1;
        for(let i=0;i<3;i++)chips.fillStyle(miner?(b.kind==="quarry"?0xb8b6ab:0xc98552):i%2?0xd9ac63:0x9c6836,.9).fillRect(at.x-5+i*4+(i-1)*phase*5,at.y-4-phase*7+i*2-groundHeight(tree.x,tree.y,sim.state.terrain),1.7,.9);
      }
    }
    for(const [id,s] of this.logs)if(!live.has(id)){s.destroy();this.logs.delete(id);}
    for(const [id,s] of this.chips)if(!live.has(id)){s.destroy();this.chips.delete(id);}
  }
}
