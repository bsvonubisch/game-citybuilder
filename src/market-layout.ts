export interface MarketPlot {x:number;y:number;rotation:number;plot?:readonly[number,number]}
export function validMarketPlot(plot:unknown):plot is [number,number] {
  return Array.isArray(plot)&&plot.length===2&&plot.every(n=>Number.isInteger(n)&&n>=1&&n<=5);
}
export function marketLayout(b:MarketPlot) {
  const [w,h]=b.plot??[2,2],r=b.rotation%4,cw=r%2?h:w,ch=r%2?w:h;
  const turn=(x:number,y:number)=>r===0?{x,y}:r===1?{x:ch-1-y,y:x}:r===2?{x:cw-1-x,y:ch-1-y}:{x:y,y:cw-1-x};
  const slots=[];
  for(let y=0;y<ch;y+=2)for(let x=0;x<cw;x++) {
    if(cw>=3&&x===Math.floor(cw/2))continue;
    const place=(dx:number,dy:number)=>{const p=turn(x+dx,y+dy);return{x:b.x+p.x,y:b.y+p.y};};
    slots.push({id:slots.length,variant:(x+y*2)%4,stall:place(-.08,-.12),vendor:place(.31,-.16),customer:place(-.06,.33)});
  }
  return slots;
}
export const marketStalls=(b:MarketPlot)=>marketLayout(b).length;
export function marketPrice(plot:readonly[number,number]=[2,2]) {
 const area=plot[0]*plot[1];return {cost:80+area*45,materials:{wood:area*3,stone:area*3,planks:area}};
}
