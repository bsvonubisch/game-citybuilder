import type Phaser from 'phaser';
import {sourceImage} from './source-images.js';
import {CROPS,farmPatch,type Crop} from './farm-layout.js';
import {cropStage,ensureField,farmPosition,FARM_WORK_SECONDS} from './farming.js';
import {dimensions} from './catalog.js';
import {iso,plotOutline,opaqueBounds,facing,travellerDepth,type OccludingPlot} from './rendering.js';
import {groundHeight} from './terrain.js';
import {walkFrame} from './animation.js';
import {placeActor,prepareActorFrames} from './actor-art.js';
import type {Building,Simulation} from './simulation.js';

type CropFrame={x:number;y:number;width:number;height:number;scale:number};
const frames=new WeakMap<object,CropFrame[]>();
function cropFrames(source:HTMLImageElement){
  let result=frames.get(source);if(result)return result;
  const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0);result=[];
  for(let row=0;row<3;row++){
    const cells=[];for(let col=0;col<3;col++){const x=Math.round(col*source.width/3),y=Math.round(row*source.height/3),w=Math.round((col+1)*source.width/3)-x,h=Math.round((row+1)*source.height/3)-y;const box=opaqueBounds(ctx.getImageData(x,y,w,h).data,w,h);cells.push({x:x+box.x,y:y+box.y,width:box.width,height:box.height});}
    const scale=(row===0?13:9)/cells[2].height;
    result.push(...cells.map(cell=>({...cell,scale})));
  }
  frames.set(source,result);c.width=c.height=1;return result;
}
export function drawFarmGround(ctx:CanvasRenderingContext2D,earth:HTMLImageElement,w:number,h:number){
  ctx.save();const corners=plotOutline(w,h);ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  ctx.transform(32,16,-32,16,0,-16);
  for(let x=0;x<w;x++)for(let y=0;y<h;y++)ctx.drawImage(earth,x,y,1,1);
  ctx.strokeStyle='#38271855';ctx.lineWidth=.035;
  for(let y=.25;y<h;y+=.5){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.restore();
}
export function drawFarmPreview(ctx:CanvasRenderingContext2D,crops:HTMLImageElement,earth:HTMLImageElement,w:number,h:number,crop:Crop|null='wheat'){
  drawFarmGround(ctx,earth,w,h);if(!crop)return;const f=cropFrames(crops)[CROPS[crop].row*3+2];
  const patches=Array.from({length:w*h*4},(_,i)=>farmPatch(i,[w,h])).sort((a,b)=>a.x+a.y-b.x-b.y);
  for(const p of patches){const v=iso(p.x,p.y);ctx.drawImage(crops,f.x,f.y,f.width,f.height,v.x-f.width*f.scale/2,v.y-f.height*f.scale,f.width*f.scale,f.height*f.scale);}
}
export class FarmArt{
  private previewKey='';
  private ground:Phaser.GameObjects.Image[]=[];
  private plants:{b:Building;patch:number;s:Phaser.GameObjects.Image;stage?:string}[]=[];
  private cargo=new Map<number,Phaser.GameObjects.Image>();
  private tick=-1;
  constructor(private scene:Phaser.Scene){
    prepareActorFrames(scene,'farm-workers',4);
    const texture=scene.textures.createCanvas('field-earth',256,128)!,ctx=texture.context;
    ctx.scale(4,4);ctx.translate(32,16);drawFarmGround(ctx,sourceImage(scene,'construction-earth'),1,1);texture.refresh();
    scene.textures.createCanvas('field-empty',1,1)!.refresh();
    const source=sourceImage(scene,'farm-crops'),cropTexture=scene.textures.get('farm-crops');
    cropFrames(source).forEach((f,i)=>cropTexture.add(i,0,f.x,f.y,f.width,f.height));
  }
  place(sprite:Phaser.GameObjects.Image,b:Pick<Building,'kind'|'x'|'y'|'plot'>&{rotation:number}){
    const [w,h]=dimensions(b.kind,b.rotation,b.plot),v=iso(b.x,b.y);
    sprite.setTexture('field-empty').setOrigin(0).setDisplaySize((w+h)*32,(w+h)*16).setPosition(v.x-h*32,v.y-16);
  }
  preview(sprite:Phaser.GameObjects.Image,x:number,y:number,plot:readonly[number,number],crop:Crop|null){
    const [w,h]=plot,key=`${w}:${h}:${crop}`,left=-h*32,top=-32;
    if(this.previewKey!==key){
      this.scene.textures.remove('field-preview');const texture=this.scene.textures.createCanvas('field-preview',(w+h)*64,((w+h)*16+48)*2)!,ctx=texture.context;
      ctx.scale(2,2);ctx.translate(-left,-top);drawFarmPreview(ctx,sourceImage(this.scene,'farm-crops'),sourceImage(this.scene,'construction-earth'),w,h,crop);texture.refresh();this.previewKey=key;
    }
    const p=iso(x,y);sprite.setTexture('field-preview').setOrigin(0).setScale(.5).setPosition(p.x+left,p.y+top);
  }
  sync(sim:Simulation){
    for(const s of this.ground)s.destroy();for(const p of this.plants)p.s.destroy();this.ground=[];this.plants=[];this.tick=-1;
    for(const b of sim.state.buildings.filter(b=>b.kind==='farm'&&!b.construction?.clearance)){
      const [w,h]=dimensions(b.kind,b.rotation,b.plot),elevation=groundHeight(b.x,b.y,sim.state.terrain);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const p=iso(b.x+x,b.y+y);
        this.ground.push(this.scene.add.image(p.x,p.y-elevation,'field-earth').setScale(.25).setDepth(-997).setData('buildingId',b.id).setInteractive({pixelPerfect:true}));
      }
      if(b.construction)continue;
      ensureField(b).cells.forEach((_,patch)=>{const p=farmPatch(patch,b.plot),v=iso(b.x+p.x,b.y+p.y);this.plants.push({b,patch,s:this.scene.add.image(v.x,v.y-elevation,'farm-crops',0).setOrigin(.5,1).setVisible(false).setData('buildingId',b.id).setInteractive({pixelPerfect:true})});});
    }
  }
  update(sim:Simulation,elapsed:number,people:Map<number,Phaser.GameObjects.Image>,plots:OccludingPlot[]){
    if(this.tick!==sim.state.tick){
      this.tick=sim.state.tick;const source=sourceImage(this.scene,'farm-crops'),all=cropFrames(source);
      for(const p of this.plants){const stage=cropStage(p.b.field!.cells[p.patch],p.b.crop??'wheat',sim.state.tick);if(stage!==p.stage){p.stage=stage;const frame=CROPS[p.b.crop??'wheat'].row*3+(stage==='ripe'?2:stage==='growing'?1:0);p.s.setTexture('farm-crops',frame).setScale(all[frame].scale);const local=farmPatch(p.patch,p.b.plot),world={x:p.b.x+local.x,y:p.b.y+local.y};p.s.setDepth(travellerDepth(world,{left:p.s.x-p.s.displayWidth/2,right:p.s.x+p.s.displayWidth/2,top:p.s.y-p.s.displayHeight,bottom:p.s.y},plots)-.2);}}
    }
    const view=this.scene.cameras.main.worldView;
    for(const p of this.plants)p.s.setVisible(p.stage!=='soil'&&p.s.x>=view.left-30&&p.s.x<=view.right+30&&p.s.y>=view.top-30&&p.s.y<=view.bottom+30);
    const carrying=new Set<number>();
    for(const b of sim.state.buildings.filter(b=>b.kind==='farm'&&!b.construction))for(const task of b.field?.tasks??[]){
      const a=sim.state.agents.find(a=>a.resident===task.resident&&a.onsite===b.id),s=a&&people.get(a.id);if(!s)continue;
      const local=farmPosition(task,elapsed),p={x:b.x+local.x,y:b.y+local.y},v=iso(p.x,p.y),direction=task.phase==='working'?2:facing(local.dx,local.dy);
      if(task.phase==='working'){
        // A single bend per patch, with a stable foot anchor and body scale.
        const phase=Math.min(.999,(task.work+elapsed)/FARM_WORK_SECONDS),frame=[0,1,2,2,3,0][Math.floor(phase*6)];
        placeActor(s,'farm-workers',direction*4+frame);
      }else{const pose=walkFrame(direction,0,task.distance+elapsed*.9,false);s.setTexture('walkers',pose.frame).setOrigin(.5,.91).setScale(24/s.frame.height).setFlipX(pose.flip);}
      s.setPosition(v.x,v.y-groundHeight(b.x,b.y,sim.state.terrain)).setVisible(true).setData('sized',false);
      s.setDepth(travellerDepth(p,{left:s.x-s.displayWidth*s.originX,right:s.x+s.displayWidth*(1-s.originX),top:s.y-s.displayHeight*s.originY,bottom:s.y},plots));
      if(task.cargo){
        carrying.add(a!.id);let bundle=this.cargo.get(a!.id);const frame=CROPS[b.crop??'wheat'].row*3+2;
        if(!bundle){bundle=this.scene.add.image(0,0,'farm-crops',frame).setOrigin(.5);this.cargo.set(a!.id,bundle);}
        bundle.setTexture('farm-crops',frame).setScale(8/bundle.frame.width).setPosition(s.x+(direction===0||direction===3?3:-3),s.y-10).setDepth(s.depth+.1).setVisible(true);
      }
    }
    for(const [id,s] of this.cargo)if(!carrying.has(id)){s.destroy();this.cargo.delete(id);}
  }
}
