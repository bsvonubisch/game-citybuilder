import type Phaser from 'phaser';
import {animalPosition,huntPosition,HUNT_SECONDS} from './hunting.js';
import {iso,facing,travellerDepth,type OccludingPlot} from './rendering.js';
import {groundHeight} from './terrain.js';
import {STEP} from './catalog.js';
import type {Simulation} from './simulation.js';
import {prepareActorFrames,placeActor} from './actor-art.js';
export function prepareHuntingFrames(scene:Phaser.Scene){prepareActorFrames(scene,'hunters',5);prepareActorFrames(scene,'hunter-walk',4);for(const [name,cols] of [['wildlife',4]] as const){const texture=scene.textures.get(name),source=texture.getSourceImage() as HTMLImageElement;for(let i=0;i<cols*4;i++){const x=Math.round(i%cols*source.width/cols),y=Math.round(Math.floor(i/cols)*source.height/4);texture.add(i,0,x,y,Math.round((i%cols+1)*source.width/cols)-x,Math.round((Math.floor(i/cols)+1)*source.height/4)-y);}}}
export class HuntingArt {
 private animals=new Map<number,Phaser.GameObjects.Image>();private arrows:Phaser.GameObjects.Graphics;private selection:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene){this.arrows=scene.add.graphics();this.selection=scene.add.graphics();}
 clear(){for(const a of this.animals.values())a.destroy();this.animals.clear();this.arrows.clear();this.selection.clear();}
 update(sim:Simulation,elapsed:number,people:Map<number,Phaser.GameObjects.Image>,plots:OccludingPlot[],selected:number|null=null){
  this.selection.clear();
  const live=new Set((sim.state.wildlife??[]).map(a=>a.id));for(const [id,s] of this.animals)if(!live.has(id)){s.destroy();this.animals.delete(id);}this.arrows.clear();
  for(const a of sim.state.wildlife??[]){let s=this.animals.get(a.id);if(!s){s=this.scene.add.image(0,0,'wildlife',0).setOrigin(.5,.93).setData('animalId',a.id).setInteractive({pixelPerfect:true,alphaTolerance:40});this.animals.set(a.id,s);}if(a.respawnAt!==undefined){s.setVisible(false);continue;}
   const p=animalPosition(a,elapsed),v=iso(p.x,p.y),pose=a.to?1+Math.floor((sim.state.tick*STEP+elapsed)*4)%2:a.wait>2?3:0,frame=a.heading*4+pose;
   s.setTexture('wildlife',frame).setScale(23/s.frame.height).setPosition(v.x,v.y-groundHeight(p.x,p.y,sim.state.terrain)).setVisible(true);
   s.setDepth(travellerDepth(p,{left:s.x-s.displayWidth/2,right:s.x+s.displayWidth/2,top:s.y-s.displayHeight,bottom:s.y},plots));
   if(a.id===selected)this.selection.setDepth(s.depth-.01).lineStyle(1.2,0xf3ce7b,.95).strokeEllipse(s.x,s.y,20,9);
  }
  for(const b of sim.state.buildings)for(const trip of b.hunting??[]){const agent=sim.state.agents.find(a=>a.resident===trip.resident&&a.onsite===b.id),s=agent&&people.get(agent.id);if(!s)continue;
   const p=huntPosition(trip,elapsed),animal=sim.state.wildlife?.find(a=>a.id===trip.animal),direction=trip.phase==='aiming'&&animal?facing(animal.x-p.x,animal.y-p.y):facing(p.dx,p.dy),phase=trip.phase==='returning'&&trip.cargo?4:trip.phase==='aiming'?(trip.work<.8?1:trip.work<HUNT_SECONDS-.6?2:3):0,frame=direction*5+phase,v=iso(p.x,p.y);
   if(trip.phase==='aiming')placeActor(s,'hunters',frame);
   else placeActor(s,'hunter-walk',direction*4+Math.floor((trip.distance+elapsed*.75)*10)%4);
   s.setVisible(true).setPosition(v.x,v.y-groundHeight(p.x,p.y,sim.state.terrain)).setData('sized',false);
   s.setDepth(travellerDepth(p,{left:s.x-s.displayWidth/2,right:s.x+s.displayWidth/2,top:s.y-s.displayHeight,bottom:s.y},plots));
   if(trip.phase==='aiming'&&animal&&trip.work>=HUNT_SECONDS-.6){const end=iso(animal.x,animal.y),t=Math.min(1,(trip.work-HUNT_SECONDS+.6)/.6),x=s.x+(end.x-s.x)*t,y=s.y-17+(end.y-groundHeight(animal.x,animal.y,sim.state.terrain)-s.y+9)*t;this.arrows.setDepth(s.depth+.1).lineStyle(.8,0xd9bc75,1).lineBetween(x-(end.x-s.x)*.14,y-(end.y-s.y)*.14,x,y);}
  }
 }
}
