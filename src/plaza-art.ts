import type Phaser from 'phaser';
import {drawPlaza,plazaLayout} from './park-art.js';
import {iso} from './rendering.js';
import {groundHeight} from './terrain.js';
import type {Simulation} from './simulation.js';
export class PlazaArt {
 private sprites:Phaser.GameObjects.Image[]=[];
 constructor(private scene:Phaser.Scene){}
 sync(sim:Simulation,depths:ReadonlyMap<number,number>=new Map()){
  for(const s of this.sprites)s.destroy();this.sprites=[];
  for(const b of sim.state.buildings.filter(b=>(b.kind==='park'||b.kind==='garden')&&!b.construction))for(const item of plazaLayout(b.rotation,b.kind==='garden'?4:2)){
   const size=b.kind==='garden'?4:2;const name='plaza-part-'+size+'-'+b.rotation+'-'+item.id;
   if(!this.scene.textures.exists(name)){
    const t=this.scene.textures.createCanvas(name,288*4,260*4)!,ctx=t.context;ctx.scale(4,4);ctx.translate(144,96);
    drawPlaza(ctx,this.scene.textures.get('park-parts').getSourceImage() as HTMLImageElement,this.scene.textures.get('park-benches').getSourceImage() as HTMLImageElement,b.rotation,item.id,size);t.refresh();
   }
   const p=iso(b.x,b.y),ground=iso(b.x+item.x,b.y+item.y),height=groundHeight(b.x,b.y,sim.state.terrain);ground.y-=height;
   const s=this.scene.add.image(p.x-144,p.y-96-height,name).setOrigin(0).setScale(.25).setDepth((depths.get(b.id)??((b.x+b.y+size*2-2)*32+12))+.1+(item.x+item.y)*.08).setData('buildingId',b.id).setData('plazaPart',true).setInteractive({pixelPerfect:true});
   if(item.kind==='lamp')s.setData('streetlight',true).setData('lampGround',ground);
   this.sprites.push(s);
  }
  return this.sprites.filter(s=>s.getData('streetlight'));
 }
}
