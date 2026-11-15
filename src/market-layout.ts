export interface MarketPlot {x:number;y:number;rotation:number;plot?:readonly[number,number]}
export function marketRectangle(from:{x:number;y:number},to:{x:number;y:number}) {
 const x=from.x+Math.max(-4,Math.min(4,to.x-from.x)),y=from.y+Math.max(-4,Math.min(4,to.y-from.y));
 return {x:Math.min(from.x,x),y:Math.min(from.y,y),plot:[Math.abs(x-from.x)+1,Math.abs(y-from.y)+1] as [number,number]};
}
export function validMarketPlot(plot:unknown):plot is [number,number] {
  return Array.isArray(plot)&&plot.length===2&&plot.every(n=>Number.isInteger(n)&&n>=1&&n<=5);
}
export function marketLayout(b:MarketPlot) {
  const [w,h]=b.plot??[2,2],r=b.rotation%4,cw=r%2?h:w,ch=r%2?w:h;
  const turn=(x:number,y:number)=>r===0?{x,y}:r===1?{x:ch-1-y,y:x}:r===2?{x:cw-1-x,y:ch-1-y}:{x:y,y:cw-1-x};
  const slots=[];
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++) {
    if(cw>=3&&x===Math.floor(cw/2))continue;
    // Stable variation: reload and rotation never reshuffle a vendor's stall.
    const orientation=(x*13+y*7+cw*11+ch*3)%4;
    const place=(dx:number,dy:number)=>{
      const local=orientation===0?{x:dx,y:dy}:orientation===1?{x:-dy,y:dx}:orientation===2?{x:-dx,y:-dy}:{x:dy,y:-dx};
      const p=turn(x+local.x,y+local.y);return{x:b.x+p.x,y:b.y+p.y};
    };
    slots.push({id:slots.length,variant:(x+y*2)%4,rotation:(orientation+r)%4,stall:place(-.08,-.12),vendor:place(.31,-.16),customer:place(-.06,.33)});
  }
  return slots;
}
export const marketStalls=(b:MarketPlot)=>marketLayout(b).length;
export function marketPrice(plot:readonly[number,number]=[2,2]) {
 const area=plot[0]*plot[1];return {cost:80+area*45,materials:{wood:area*3,stone:area*3,planks:area}};
}
