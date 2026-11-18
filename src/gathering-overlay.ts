import type Phaser from 'phaser';
import {BERRY_STATES,gatheringArea,berryMarkerPoint} from './gathering-area.js';
import type {Building,Simulation} from './simulation.js';

/** Small world-space pins stay visible through canopies, even at night. */
export class GatheringOverlay {
  private graphics:Phaser.GameObjects.Graphics;
  private targets=new Map<number,Phaser.GameObjects.Zone>();
  private building:Building|null=null;
  private checked='';
  private drawn='';
  constructor(private scene:Phaser.Scene){this.graphics=scene.add.graphics().setDepth(5005);}
  hide(){this.building=null;this.checked='';this.drawn='';this.graphics.clear();for(const z of this.targets.values())z.destroy();this.targets.clear();}
  show(sim:Simulation,b:Building){this.building=b;this.checked='';this.update(sim);}
  update(sim:Simulation){
    if(!this.building)return;
    const b=this.building.id>0?sim.building(this.building.id):this.building;
    if(!b){this.hide();return;}
    const zoom=this.scene.cameras.main.zoom,stamp=`${sim.state.revision}:${sim.state.tick}:${zoom}:${b.x}:${b.y}:${b.rotation}`;
    if(stamp===this.checked)return;this.checked=stamp;
    const markers=gatheringArea(sim,b),points=markers.map(m=>berryMarkerPoint(sim,m.bush));
    const signature=`${zoom}:`+markers.map((m,i)=>`${m.bush.id}:${m.state}:${points[i].x}:${points[i].y}`).join('|');
    if(signature===this.drawn)return;this.drawn=signature;
    const g=this.graphics.clear(),ids=new Set(markers.map(m=>m.bush.id));
    for(const [id,z] of this.targets)if(!ids.has(id)){z.destroy();this.targets.delete(id);}
    markers.forEach((m,i)=>{
      const p=points[i],color=BERRY_STATES[m.state].color,u=1/zoom,y=p.y-24,r=8*u;
      g.lineStyle(3*u,0x203b32,.9).strokeEllipse(p.x,p.y,24,12);
      g.lineStyle(1.5*u,color,1).strokeEllipse(p.x,p.y,24,12).lineBetween(p.x,p.y-6,p.x,y+r);
      g.fillStyle(0xfff6dd,.98).fillCircle(p.x,y,r).lineStyle(2*u,color,1).strokeCircle(p.x,y,r);
      if(m.state==='blocked')g.lineStyle(1.7*u,0x994d44,1).lineBetween(p.x-3*u,y-3*u,p.x+3*u,y+3*u).lineBetween(p.x+3*u,y-3*u,p.x-3*u,y+3*u);
      else if(m.state==='regrowing')g.lineStyle(1.5*u,0x8c672b,1).strokeCircle(p.x,y,4*u).lineBetween(p.x,y,p.x,y-3*u).lineBetween(p.x,y,p.x+2.5*u,y+1.5*u);
      else{
        g.fillStyle(0x845273,1).fillCircle(p.x-2*u,y,2*u).fillCircle(p.x+2*u,y,2*u).fillCircle(p.x,y+3*u,2*u);
        g.lineStyle(1.5*u,0x50805a,1).lineBetween(p.x,y-1*u,p.x+2*u,y-4*u);
      }
      let z=this.targets.get(m.bush.id);
      if(!z){z=this.scene.add.zone(p.x,y,20*u,20*u).setDepth(5006).setInteractive({useHandCursor:true});this.targets.set(m.bush.id,z);}
      z.setPosition(p.x,y).setSize(20*u,20*u).setData('decoration',m.bush);
    });
  }
}
