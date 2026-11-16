import { SIZE } from './catalog.js';
import { terrainCell } from './terrain.js';
import { WATER_DROP } from './water-level.js';
import { BridgeShadow } from './bridge-shadow.js';
import {roadVisualState} from './roadworks.js';
import {sourceImage} from './source-images.js';
import type {EdgeOccluder} from './edge-occlusion.js';
import {roadTypeAt} from './roads.js';
import type Phaser from 'phaser';
import {BRIDGE_PARAPET_HEIGHT,bridgeRails,bridgeLandings,deckHeight,isBridge} from './bridges.js';
import {bridgeProfile} from './bridge-profile.js';
import {sourcePoint,sourceObject} from './view-space.js';
import {iso} from './rendering.js';
import {type Point,type Simulation} from './simulation.js';
type Vec={x:number;y:number};
const RESOLUTION=4,WIDTH=96,HEIGHT=88;
const CORNERS=[ [{x:.5,y:-.5},{x:.5,y:.5}], [{x:.5,y:.5},{x:-.5,y:.5}], [{x:-.5,y:.5},{x:-.5,y:-.5}], [{x:-.5,y:-.5},{x:.5,y:-.5}] ];
// Measured production atlas coordinates, not the nominal image-generation guide.
const MATERIALS={
 wood:{key:'bridge-woodland',deck:[1,1,1252,599],profileX:0,profileWidth:1254,railTop:628,deckTop:850,bottom:1150},
 stone:{key:'bridge-alpine',deck:[1,1,1252,625],profileX:12,profileWidth:1230,railTop:672,deckTop:824,bottom:1200},
 brick:{key:'bridge-iron',deck:[1,1,1252,625],profileX:16,profileWidth:1222,railTop:639,deckTop:850,bottom:1220},
} as const;
/** Painted planar bridge pieces follow exact grid geometry. Front rails sort
 * independently from the opaque deck and its under-deck supports. */
export class BridgeArt {
 edges:EdgeOccluder[]=[];
 lights:Phaser.GameObjects.Image[]=[];
 private shadow:BridgeShadow;
 private under:Phaser.GameObjects.Container;
 private waterMask:Phaser.GameObjects.Graphics;
 private variants=new Map<string,{deck:string;supports:(string|null)[];abutments:string;vault:string|null;rails:(string|null)[]}>();
 private images:Phaser.GameObjects.Image[]=[];
 constructor(private scene:Phaser.Scene){
  this.shadow=new BridgeShadow(scene);
  this.waterMask=scene.make.graphics({x:0,y:0});
  this.under=scene.add.container(0,0).setDepth(-997).setMask(this.waterMask.createGeometryMask());
  const frame=scene.textures.getFrame('streetlamp',0),tex=scene.textures.createCanvas('bridge-lantern',frame.cutWidth,Math.ceil(frame.cutHeight*.24))!;
  tex.context.drawImage(scene.textures.get('streetlamp').getSourceImage() as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight*.24,0,0,tex.width,tex.height);tex.refresh();
 }
 private canvas(name:string,paint:(ctx:CanvasRenderingContext2D)=>void){
  const tex=this.scene.textures.createCanvas(name,WIDTH*RESOLUTION,HEIGHT*RESOLUTION)!,ctx=tex.context;
  ctx.scale(RESOLUTION,RESOLUTION);ctx.translate(WIDTH/2,HEIGHT/2);ctx.imageSmoothingEnabled=true;paint(ctx);tex.refresh();return name;
 }
  private quad(
    ctx: CanvasRenderingContext2D,
    points: Vec[],
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    material:CanvasImageSource,
  ) {
    const [a, b, c, d] = points;
    // Flat deck patches and wall panels need one affine draw. Clipping them
    // into two triangles leaves an antialiased crack through the material.
    if (Math.abs(a.x + c.x - b.x - d.x) < .001 &&
        Math.abs(a.y + c.y - b.y - d.y) < .001) {
      ctx.save();
      ctx.transform(b.x - a.x, b.y - a.y, d.x - a.x, d.y - a.y, a.x, a.y);
      ctx.drawImage(material, sx, sy, sw, sh, 0, 0, 1, 1);
      ctx.restore();
      return;
    }
    for (const [end, side, triangle] of [
      [b, { x: c.x - b.x, y: c.y - b.y }, [a, b, c]],
      [
        { x: a.x + c.x - d.x, y: a.y + c.y - d.y },
        { x: d.x - a.x, y: d.y - a.y },
        [a, c, d],
      ],
    ] as [Vec, Vec, Vec[]][]) {
      ctx.save();
      ctx.beginPath();
      triangle.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.clip();
      ctx.transform(end.x - a.x, end.y - a.y, side.x, side.y, a.x, a.y);
      ctx.drawImage(material, sx, sy, sw, sh, 0, 0, 1, 1);
      ctx.restore();
    }
  }

 private pier(ctx:CanvasRenderingContext2D,u:number,v:number,r:number,top:number,bottom:number,wood:boolean){
  const image=sourceImage(this.scene,wood?'bridge-woodland':'bridge-alpine');
  const p=(x:number,y:number,z:number)=>{const q=iso(x,y);return{x:q.x,y:q.y-z}};
  const sides=[[[u+r,v-r],[u+r,v+r]],[[u+r,v+r],[u-r,v+r]]];
  for(const [index,[a,b]] of sides.entries()){
   const ps=[p(a[0],a[1],top),p(b[0],b[1],top),p(b[0],b[1],bottom),p(a[0],a[1],bottom)];
   this.quad(ctx,ps,wood?6:20,wood?850:848,wood?40:110,wood?250:330,image);
   ctx.fillStyle=index===0?'#182b263b':'#29382b12';ctx.beginPath();ps.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fill();
  }
  const cap=[p(u-r,v-r,top),p(u+r,v-r,top),p(u+r,v+r,top),p(u-r,v+r,top)];
  this.quad(ctx,cap,wood?64:92,wood?659:698,wood?450:285,18,image);
 }
 private variant(sim:Simulation,tile:Point,profiles:{from:number;to:number}[]){
  const open=bridgeRails(sim.roads,tile,sim.state.buildings,sim.state.terrain),land=bridgeLandings(sim.roads,tile,sim.state.buildings,sim.state.terrain);
  const road=roadTypeAt(sim.state.roadTypes,tile),kind=road==='stone'||road==='brick'?road:'wood',material=MATERIALS[kind],image=sourceImage(this.scene,material.key);
  const id=kind+open.map(Number).join('')+land.map(Number).join('')+profiles.map(p=>p.from+':'+p.to).join('_'),existing=this.variants.get(id);if(existing)return existing;
  const point=(u:number,v:number)=>{const p=iso(u,v);return{x:p.x,y:p.y-deckHeight(sim.roads,tile,u,v,sim.state.buildings,sim.state.terrain)}};
  const at=(e:number,t:number)=>{const[a,b]=CORNERS[e];return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}};
  const profile=(ctx:CanvasRenderingContext2D,e:number,top:number,bottom:number,height:number,offset:number,inset=0)=>{
   // Split only where ramp slope changes; source UVs continue through the join.
   for(let i=0;i<2;i++){
    const u=at(e,i/2),v=at(e,(i+1)/2),n=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}][e],p=point(u.x-n.x*inset,u.y-n.y*inset),q=point(v.x-n.x*inset,v.y-n.y*inset),uv=profiles[e];
    const a=uv.from+(uv.to-uv.from)*i/2,b=uv.from+(uv.to-uv.from)*(i+1)/2;
    let ps=[{x:p.x,y:p.y+offset},{x:q.x,y:q.y+offset},{x:q.x,y:q.y+offset+height},{x:p.x,y:p.y+offset+height}];
    if(b<a)ps=[ps[1],ps[0],ps[3],ps[2]];
    this.quad(ctx,ps,material.profileX+Math.min(a,b)*material.profileWidth,top,Math.abs(b-a)*material.profileWidth,bottom-top,image);
   }
  };
  const deck=this.canvas('bridge-deck-'+id,ctx=>{
   ctx.beginPath();for(let e=0;e<4;e++)for(let i=0;i<2;i++){const a=at(e,i/2),p=point(a.x,a.y);if(!e&&!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.closePath();ctx.fillStyle=kind==='wood'?'#946331':kind==='brick'?'#aa7254':'#8c8c91';ctx.fill();
   const acrossX=kind==='wood'&&Number(!open[0])+Number(!open[2])>=Number(!open[1])+Number(!open[3]);
   const [sx,sy,sw,sh]=material.deck;
   for(let j=0;j<4;j++)for(let i=0;i<4;i++){
    const u=i/4-.5,v=j/4-.5,ps=acrossX?[point(u,v),point(u,v+.25),point(u+.25,v+.25),point(u+.25,v)]:[point(u,v),point(u+.25,v),point(u+.25,v+.25),point(u,v+.25)];
    // One tile is half the two-tile material repeat: six deck planks per tile.
    this.quad(ctx,ps,sx+(acrossX?j:i)*sw/4,sy+(acrossX?i:j)*sh/8,sw/4,sh/8,image);
   }
  });
  const supports=open.map((closed,e)=>!closed?null:this.canvas('bridge-supports-'+id+'-'+e,ctx=>{
    const ps=[0,.5,1].map(t=>{const u=at(e,t),p=point(u.x,u.y);return{...u,p}});
    // Supports are volumes with two visible faces and a cap, not flat cutouts.
    for(const t of (kind==='wood'?[0,1]:[])){
     const uv=profiles[e].from+(profiles[e].to-profiles[e].from)*t;
     if(kind!=='wood'&&Math.abs(uv-.5)<.01)continue;
     const q=at(e,t),n=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}][e];
     if(land.some((l,i)=>l&&[q.x,q.y,-q.x,-q.y][i]>.49))continue;
     const top=iso(q.x,q.y).y-point(q.x,q.y).y;
     const cx=q.x-n.x*.035,cy=q.y-n.y*.035;
     this.pier(ctx,cx,cy,kind==='wood'?.045:.08,kind==='wood'?top:top-2,-WATER_DROP+1,kind==='wood');
     this.pier(ctx,cx,cy,kind==='wood'?.065:.1,-WATER_DROP+2.5,-WATER_DROP-.6,false);
    }
    ctx.save();ctx.beginPath();ps.forEach((q,i)=>i?ctx.lineTo(q.p.x,q.p.y):ctx.moveTo(q.p.x,q.p.y));
    for(const q of [...ps].reverse()){
     // The hidden end of a support stops at land, never sticks out above a ramp.
     const taper=Math.min(1,...land.flatMap((l,i)=>l?[Math.max(0,1-2*[q.x,q.y,-q.x,-q.y][i])]:[]));
     const bottom=iso(q.x,q.y);ctx.lineTo(bottom.x,bottom.y+(WATER_DROP+2)*taper);
    }
    ctx.closePath();ctx.clip();profile(ctx,e,material.deckTop,material.bottom,6+WATER_DROP+2,0);ctx.restore();
  }));
  // The arch is a vault across the FULL road width. Its soffit and the
  // inner sides of shared piers sit between the two painted outer faces.
  const alongX=Number(!open[0])+Number(!open[2])>=Number(!open[1])+Number(!open[3]);
  const e=alongX?1:0,uv=profiles[e],bodyDepth=6+WATER_DROP+2;
  const vault=kind==='wood'?null:this.canvas('bridge-vault-'+id,ctx=>{
   const p=(t:number,far:boolean,drop:number)=>{const q=at(e,t),v=alongX?{x:q.x,y:far?-.5:.5}:{x:far?-.5:.5,y:q.y},s=point(v.x,v.y);return{x:s.x,y:s.y+drop}};
   const depth=(phase:number)=>bodyDepth*(.22+.45*((phase-.5)/.37)**2);
   const face=(ps:Vec[],shade:string)=>{
    this.quad(ctx,ps,20,material.deckTop+4,420,58,image);
    ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=shade;ctx.fill();
   };
   const cuts=[0,1];for(let i=0;i<=16;i++){const t=(.13+i*.74/16-uv.from)/(uv.to-uv.from);if(t>0&&t<1)cuts.push(t);}cuts.sort((a,b)=>a-b);
   for(let i=1;i<cuts.length;i++){
    const a=cuts[i-1],b=cuts[i],phase=uv.from+(uv.to-uv.from)*(a+b)/2;if(phase<.13||phase>.87)continue;
    const da=depth(uv.from+(uv.to-uv.from)*a),db=depth(uv.from+(uv.to-uv.from)*b);
    face([p(a,false,da),p(b,false,db),p(b,true,db),p(a,true,da)],'#162f2d80');
   }
   for(const boundary of [.13,.87]){
    const t=(boundary-uv.from)/(uv.to-uv.from);if(t<0||t>1)continue;
    face([p(t,false,depth(boundary)),p(t,true,depth(boundary)),p(t,true,bodyDepth),p(t,false,bodyDepth)],'#132d2b70');
   }
  });
  const abutments=this.canvas('bridge-abutments-'+id,ctx=>{
   // A bank-to-bridge join needs an abutment down to the lowered water surface.
   // Only back edges of the water tile expose this face; the land hides the rest.
   for(const e of [2,3])if(land[e]){
    const[a,b]=CORNERS[e].map(p=>iso(p.x,p.y)),stone=sourceImage(this.scene,'bridge-alpine');
    this.quad(ctx,[a,b,{x:b.x,y:b.y+WATER_DROP},{x:a.x,y:a.y+WATER_DROP}],12,844,420,180,stone);
   }

  });
  const rails=open.map((closed,e)=>!closed?null:this.canvas('bridge-rail-'+id+'-'+e,ctx=>{
   // Inner and outer faces give railings real thickness; the top cap joins them.
   const thickness=kind==='wood'?.075:kind==='stone'?.1:.045;
   profile(ctx,e,material.railTop,material.deckTop,BRIDGE_PARAPET_HEIGHT,-BRIDGE_PARAPET_HEIGHT,thickness);
   profile(ctx,e,material.railTop,material.deckTop,BRIDGE_PARAPET_HEIGHT,-BRIDGE_PARAPET_HEIGHT);
   const n=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}][e];
   if(kind!=='brick')for(let i=0;i<2;i++){
    const a=at(e,i/2),b=at(e,(i+1)/2),ps=[point(a.x,a.y),point(b.x,b.y),point(b.x-n.x*thickness,b.y-n.y*thickness),point(a.x-n.x*thickness,a.y-n.y*thickness)].map(p=>({x:p.x,y:p.y-BRIDGE_PARAPET_HEIGHT+1.1}));
    this.quad(ctx,ps,kind==='wood'?60:90,kind==='wood'?659:698,450,18,image);
   }
   if(kind==='wood')for(const t of [0,1]){
    const q=at(e,t),r=.045,top=point(q.x,q.y).y-iso(q.x,q.y).y-BRIDGE_PARAPET_HEIGHT;
    const ps=[iso(q.x-r,q.y-r),iso(q.x+r,q.y-r),iso(q.x+r,q.y+r),iso(q.x-r,q.y+r)];
    for(const k of [1,2]){const a=ps[k],b=ps[(k+1)%4];this.quad(ctx,[{x:a.x,y:a.y+top},{x:b.x,y:b.y+top},{x:b.x,y:b.y+top+BRIDGE_PARAPET_HEIGHT},{x:a.x,y:a.y+top+BRIDGE_PARAPET_HEIGHT}],5,650,45,200,image);}
    ctx.fillStyle='#be8749';ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y+top):ctx.moveTo(p.x,p.y+top));ctx.closePath();ctx.fill();
   }
  }));
  const result={deck,supports,abutments,vault,rails};this.variants.set(id,result);return result;
 }

 private mount(kind:string,ground:Vec,depth:number){
  const wood=kind==='wood',name='bridge-lamp-plinth-'+(wood?'wood':'stone');
  if(!this.scene.textures.exists(name))this.canvas(name,ctx=>{
   const image=sourceImage(this.scene,wood?'bridge-woodland':'bridge-alpine'),r=wood?.045:.06;
   const points=[iso(-r,-r),iso(r,-r),iso(r,r),iso(-r,r)];
   for(const i of [1,2]){
    const a=points[i],b=points[(i+1)%4];
    this.quad(ctx,[{x:a.x,y:a.y-9},{x:b.x,y:b.y-9},b,a],wood?7:395,wood?654:706,wood?40:45,wood?186:110,image);
   }
   ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y-9):ctx.moveTo(p.x,p.y-9));ctx.closePath();ctx.fillStyle=wood?'#bb8447':'#d9cfb5';ctx.fill();
  });
  this.images.push(this.scene.add.image(ground.x-WIDTH/2,ground.y-HEIGHT/2,name).setOrigin(0).setScale(1/RESOLUTION).setDepth(depth));
 }
 redraw(input:Simulation){
  const canonical=roadVisualState(sourceObject(input)),sim=roadVisualState(input);
  this.shadow.redraw(sim);
  this.waterMask.clear().fillStyle(0xffffff);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(terrainCell(x,y,sim.state.terrain).kind==='water'){
   const p=iso(x,y);this.waterMask.fillPoints([{x:p.x,y:p.y-16.1},{x:p.x+32.2,y:p.y},{x:p.x,y:p.y+16.1},{x:p.x-32.2,y:p.y}],true);
  }
  this.edges=[];this.images.forEach(i=>i.destroy());this.lights.forEach(i=>i.destroy());this.images=[];this.lights=[];
  const lit=new Set<string>();
  for(const road of sim.roads){
   const [x,y]=road.split(',').map(Number);if(!isBridge(sim.roads,x,y,sim.state.terrain))continue;
   const tile={x,y},physical=sourcePoint(input.state,tile);
   const profiles=CORNERS.map(([a,b])=>bridgeProfile(canonical,physical,sourcePoint(input.state,{x:x+a.x,y:y+a.y}),sourcePoint(input.state,{x:x+b.x,y:y+b.y})));
   const p=iso(x,y),art=this.variant(sim,tile,profiles);
   const add=(texture:string,depth:number)=>{
    const image=this.scene.add.image(p.x-WIDTH/2,p.y-HEIGHT/2,texture).setOrigin(0).setScale(1/RESOLUTION).setDepth(depth);
    if(depth<-996)this.under.add(image);this.images.push(image);
   };
   // Sort the under-deck edge faces globally, including after a view turn.
   // Near faces win a shared-depth tie; a far pier cannot draw over a near arch.
   art.supports.forEach((texture,e)=>{if(texture)add(texture,-997+((x+y)*32+(e<2?32:0))*.0001+(e<2?.000001:0));});
   if(art.vault)add(art.vault,-997+((x+y)*32+16)*.0001);
   add(art.abutments,-996.5);add(art.deck,-996);
   const land=bridgeLandings(sim.roads,tile,sim.state.buildings,sim.state.terrain);
   art.rails.forEach((texture,edge)=>{
    if(!texture)return;const depth=(x+y)*32+(edge<2?32:0);add(texture,depth);
    const[a,b]=CORNERS[edge].map(q=>({x:x+q.x,y:y+q.y})),pa=iso(a.x,a.y),pb=iso(b.x,b.y);
    this.edges.push({a,b,depth,left:Math.min(pa.x,pb.x)-3,right:Math.max(pa.x,pb.x)+3,top:Math.min(pa.y,pb.y)-22,bottom:Math.max(pa.y,pb.y)+1});
    // Entrance lanterns sit on rail posts, with the same warm night-light system.
    for(const q of CORNERS[edge]){
     if(!land.some((l,i)=>l&&[q.x,q.y,-q.x,-q.y][i]>.49))continue;
     const k=(x+q.x)+','+(y+q.y);if(lit.has(k))continue;lit.add(k);
     const ground=iso(x+q.x,y+q.y),h=deckHeight(sim.roads,tile,q.x,q.y,sim.state.buildings,sim.state.terrain);
     this.mount(roadTypeAt(sim.state.roadTypes,tile)==='stone'?'stone':roadTypeAt(sim.state.roadTypes,tile)==='brick'?'brick':'wood',{x:ground.x,y:ground.y-h},depth+.05);
     const lamp=this.scene.add.image(ground.x,ground.y-h-BRIDGE_PARAPET_HEIGHT,'bridge-lantern').setOrigin(.5,1).setDepth(depth+.1).setData('streetlight',true).setData('bridgeLantern',true).setData('lampGround',{x:ground.x,y:ground.y-h});
     lamp.setScale(6/lamp.frame.height);this.lights.push(lamp);
    }
   });
  }
  this.under.sort('depth');
  // A player-placed lantern also needs a solid mounting post: iron railings
  // have open space where the former masonry wall used to support its foot.
  for(const d of sim.state.decorations){
   if(d.kind!=='streetlight'||d.edge===undefined||!isBridge(sim.roads,d.x,d.y,sim.state.terrain))continue;
   const kind=roadTypeAt(sim.state.roadTypes,d);if(kind!=='stone'&&kind!=='brick')continue;
   const delta=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}][d.edge],u=delta.x*.495,v=delta.y*.495,p=iso(d.x+u,d.y+v);
   p.y-=deckHeight(sim.roads,d,u,v,sim.state.buildings,sim.state.terrain);
   this.mount(kind,p,(d.x+u+d.y+v)*32+4.9);
  }
 }
}
