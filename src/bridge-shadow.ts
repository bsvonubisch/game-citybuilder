import type Phaser from 'phaser';
import {iso} from './rendering.js';
import {isBridge} from './bridges.js';
import {terrainCell} from './terrain.js';
import {WATER_DROP} from './water-level.js';
import {SIZE} from './catalog.js';
import type {Simulation} from './simulation.js';

/** Static ambient occlusion on the water. Connected spans share one path,
 * avoiding a dark seam per tile. Cached 256px chunks keep GPU uploads bounded. */
export class BridgeShadow {
 private images:Phaser.GameObjects.Image[]=[];
 private keys:string[]=[];
 constructor(private scene:Phaser.Scene){}
 redraw(sim:Simulation){
  this.images.forEach(i=>i.destroy());this.images=[];this.keys.forEach(k=>this.scene.textures.remove(k));this.keys=[];
  const cells=[...sim.roads].map(k=>k.split(',').map(Number)).filter(([x,y])=>isBridge(sim.roads,x,y,sim.state.terrain)).map(([x,y])=>iso(x,y));
  const chunks=new Map<string,{x:number;y:number}>();
  for(const p of cells)for(let x=Math.floor((p.x-38)/256);x<=Math.floor((p.x+38)/256);x++)for(let y=Math.floor((p.y-22+WATER_DROP)/256);y<=Math.floor((p.y+22+WATER_DROP)/256);y++)chunks.set(`${x},${y}`,{x:x*256,y:y*256});
  for(const [id,origin] of chunks){
   const name='bridge-shade-'+id,texture=this.scene.textures.createCanvas(name,528,528)!,ctx=texture.context;
   this.keys.push(name);ctx.scale(2,2);ctx.translate(4-origin.x,4-origin.y);
   const diamond=(x:number,y:number)=>{ctx.moveTo(x,y-16);ctx.lineTo(x+32,y);ctx.lineTo(x,y+16);ctx.lineTo(x-32,y);ctx.closePath();};
   ctx.beginPath();for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const p=iso(x,y);p.y+=WATER_DROP;if(p.x<origin.x-38||p.x>origin.x+294||p.y<origin.y-22||p.y>origin.y+278)continue;
    if(terrainCell(x,y,sim.state.terrain).kind==='water')diamond(p.x,p.y);
   }ctx.clip();ctx.beginPath();for(const p of cells)diamond(p.x,p.y+WATER_DROP);
   ctx.shadowColor='#082d3080';ctx.shadowBlur=7;ctx.fillStyle='#082d3059';ctx.fill();
   texture.refresh();texture.add('inner',0,8,8,512,512);
   this.images.push(this.scene.add.image(origin.x,origin.y,name,'inner').setOrigin(0).setScale(.5).setDepth(-1000.7));
  }
 }
}
