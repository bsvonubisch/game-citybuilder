import type Phaser from 'phaser';
import {drawPlaza,plazaLayout} from './park-art.js';
import {iso} from './rendering.js';
import {groundHeight} from './terrain.js';
import type {Simulation} from './simulation.js';
export class PlazaArt {
 private sprites:Phaser.GameObjects.Image[]=[];
 constructor(private scene:Phaser.Scene){}
 sync(sim:Simulation){
  for(const s of this.sprites)s.destroy();this.sprites=[];
  for(const b of sim.state.buildings.filter(b=>b.kind==='park'&&!b.construction))for(const item of plazaLayout(b.rotation)){
   const name='plaza-part-'+b.rotation+'-'+item.id;
   if(!this.scene.textures.exists(name)){
    const t=this.scene.textures.createCanvas(name,144*4,160*4)!,ctx=t.context;ctx.scale(4,4);ctx.translate(72,96);
    drawPlaza(ctx,this.scene.textures.get('park-parts').getSourceImage() as HTMLImageElement,this.scene.textures.get('park-benches').getSourceImage() as HTMLImageElement,b.rotation,item.id);t.refresh();
   }
   const p=iso(b.x,b.y),ground=iso(b.x+item.x,b.y+item.y),height=groundHeight(b.x,b.y,sim.state.terrain);ground.y-=height;
   const s=this.scene.add.image(p.x-72,p.y-96-height,name).setOrigin(0).setScale(.25).setDepth((b.x+b.y+2)*32+12.1+(item.x+item.y)*.08).setData('buildingId',b.id).setData('plazaPart',true).setInteractive({pixelPerfect:true});
   if(item.kind==='lamp')s.setData('streetlight',true).setData('lampGround',ground);
   this.sprites.push(s);
  }
  return this.sprites.filter(s=>s.getData('streetlight'));
 }
}
