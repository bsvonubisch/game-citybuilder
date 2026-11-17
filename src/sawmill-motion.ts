import type {Point} from './simulation.js';

/** Measured in the 627px cells of building-sawmill.png. The blade is an
 * oblique vertical disc; its horizontal diameter follows the table's ±1:2
 * slope. The bench hides the lower half, and rear views hide the whole saw. */
export const SAWMILL_BLADES = [
  {center:[223,400], across:[22,-11], vertical:24, eject:-1},
  {center:[402,412], across:[22,11], vertical:27, eject:1},
] as const;

export function sawmillMotion(rotation:number,phase:number){
  const blade=SAWMILL_BLADES[rotation as 0|1];if(!blade)return null;
  const [cx,cy]=blade.center,[ux,uy]=blade.across;
  const point=(angle:number,radius:number):Point=>({
    x:cx+Math.cos(angle)*ux*radius,
    y:cy+(Math.cos(angle)*uy+Math.sin(angle)*blade.vertical)*radius,
  });
  const strokes:[Point,Point][]=[];
  for(let i=0;i<6;i++){
    const angle=phase*7+i*Math.PI/3;
    if(Math.sin(angle)<-.08)strokes.push([point(angle,.28),point(angle,.82)]);
  }
  const chips=Array.from({length:5},(_,i)=>{
    const age=(phase*1.4+i/5)%1;
    return{x:cx+blade.eject*(ux*.65+age*22),y:cy+blade.eject*uy*.65-2+age*age*18,alpha:(1-age)*.65};
  });
  return {strokes,chips};
}
