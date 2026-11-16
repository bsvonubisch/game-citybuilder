import { SIZE } from './catalog.js';
import { groundHeight, terrainCell, type TerrainMap } from './terrain.js';
import { iso } from './rendering.js';
import { WATER_DROP } from './water-level.js';
import type { Point } from './simulation.js';

const directions = [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
const corners = [[{x:.5,y:-.5},{x:.5,y:.5}], [{x:.5,y:.5},{x:-.5,y:.5}],
  [{x:-.5,y:.5},{x:-.5,y:-.5}], [{x:-.5,y:-.5},{x:.5,y:-.5}]];
export function shoreBanks(tile:Point, roads:ReadonlySet<string>, map?:TerrainMap) {
  if(terrainCell(tile.x,tile.y,map).kind!=='land')return [];
  const height=groundHeight(tile.x,tile.y,map);
  return directions.flatMap((d,side)=>{
    const water={x:tile.x+d.x,y:tile.y+d.y};
    if(water.x<0||water.y<0||water.x>=SIZE||water.y>=SIZE||terrainCell(water.x,water.y,map).kind!=='water'||roads.has(`${water.x},${water.y}`))return [];
    const [a,b]=corners[side].map(p=>({x:p.x+tile.x,y:p.y+tile.y}));
    return [{a,b,water,side,height,drop:Math.max(0,height+WATER_DROP),stone:roads.has(`${tile.x},${tile.y}`)}];
  });
}

/** Bank faces use the actual tile boundaries. Shared corners have identical
 * endpoints, so channels, islands and inside corners need no overlapping props. */
export function drawShoreBank(ctx:CanvasRenderingContext2D, bank:ReturnType<typeof shoreBanks>[number],
  grass:HTMLImageElement, earth:HTMLImageElement, stone:HTMLImageElement) {
  const a=iso(bank.a.x,bank.a.y),b=iso(bank.b.x,bank.b.y),[dx,dy]=[b.x-a.x,b.y-a.y];
  const line=(offset:number,width:number,color:string)=>{
    ctx.beginPath();ctx.moveTo(a.x,a.y+offset);ctx.lineTo(b.x,b.y+offset);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  // Shallows are clipped to both the old boundary and the lower water surface.
  // They cannot paint over foreground grass or bridge ramps.
  ctx.save();const w=iso(bank.water.x,bank.water.y);
  for(const z of [0,WATER_DROP]){
    ctx.beginPath();ctx.moveTo(w.x,w.y-16+z);ctx.lineTo(w.x+32,w.y+z);ctx.lineTo(w.x,w.y+16+z);ctx.lineTo(w.x-32,w.y+z);ctx.closePath();ctx.clip();
  }
  const glow=ctx.createLinearGradient(a.x,a.y+WATER_DROP-8,a.x,a.y+WATER_DROP+8);
  glow.addColorStop(0,'#a9d2a800');glow.addColorStop(.5,'#b7dcb244');glow.addColorStop(1,'#a9d2a800');
  ctx.strokeStyle=glow;ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(a.x,a.y+WATER_DROP);ctx.lineTo(b.x,b.y+WATER_DROP);ctx.stroke();ctx.restore();
  // Only the two faces toward the camera are visible. The other two lie behind
  // the land top, rather than being drawn through it as a second raised edge.
  if(bank.side<2&&bank.drop>0){
    ctx.save();ctx.transform(dx,dy,0,1,a.x,a.y-bank.height);
    if(bank.stone){
      ctx.fillStyle='#777568';ctx.fillRect(0,0,1,bank.drop);
      const rows=Math.ceil(bank.drop/2.2);
      for(let row=0;row<rows;row++)for(let col=-1;col<6;col++){
        const x=(col+(row%2)*.5)/6,l=Math.max(0,x),r=Math.min(1,x+1/6);if(r<=l)continue;
        const sw=stone.width/6,sh=stone.height/6;
        ctx.drawImage(stone,((col+6+row*2)%6)*sw,(row%6)*sh,sw,sh,l,row*2.2,r-l,Math.min(2.2,bank.drop-row*2.2));
        ctx.fillStyle='#454b4240';ctx.fillRect(l,row*2.2,r-l,.18);ctx.fillRect(l,row*2.2,.004,Math.min(2.2,bank.drop-row*2.2));
      }
    }else{
      ctx.drawImage(earth,0,earth.height*.2,earth.width*.5,earth.height*.22,0,0,1,bank.drop);
      ctx.fillStyle=bank.side===0?'#37462d70':'#37462d50';ctx.fillRect(0,0,1,bank.drop);
    }
    const wet=ctx.createLinearGradient(0,Math.max(0,bank.drop-3),0,bank.drop);wet.addColorStop(0,'#244d3900');wet.addColorStop(1,'#244d3980');ctx.fillStyle=wet;ctx.fillRect(0,0,1,bank.drop);ctx.restore();
  }
  if(bank.stone){
    // One continuous coping, capped at the same land datum on every side.
    line(-bank.height-.4,2.2,'#c8bfa5');line(-bank.height-1.25,.55,'#e2dac1');
    for(let i=0;i<6;i++){const t=i/6;ctx.beginPath();ctx.moveTo(a.x+dx*t-.7,a.y+dy*t-bank.height-1.4);ctx.lineTo(a.x+dx*t+.7,a.y+dy*t-bank.height+.5);ctx.strokeStyle='#7c7d6a';ctx.lineWidth=.45;ctx.stroke();}
  }else{
    // A narrow turf lip comes from the same meadow texture as the land. Small
    // roots hang over it; the bank no longer consists of repeated rock piles.
    const pattern=ctx.createPattern(grass,'repeat')!;pattern.setTransform(new DOMMatrix().scale(160/grass.width,160/grass.height));
    ctx.strokeStyle=pattern;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(a.x,a.y-bank.height);ctx.lineTo(b.x,b.y-bank.height);ctx.stroke();
    if(bank.side<2)for(let i=1;i<12;i++){const t=i/12,seed=Math.sin((bank.a.x*17+bank.a.y*31+i)*7.1);ctx.strokeStyle=seed>0?'#7a8a35':'#52652f';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(a.x+dx*t,a.y+dy*t-bank.height-.3);ctx.lineTo(a.x+dx*t+.2,a.y+dy*t-bank.height+1.2+Math.abs(seed));ctx.stroke();}
  }
}
