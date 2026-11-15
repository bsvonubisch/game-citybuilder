export const CROPS = {
  wheat: {name:'Wheat',output:'grain',grow:75,yield:3,row:0},
  potatoes: {name:'Potatoes',output:'potatoes',grow:95,yield:4,row:1},
  carrots: {name:'Carrots',output:'carrots',grow:65,yield:3,row:2},
} as const;
export type Crop = keyof typeof CROPS;
export const isCrop=(value:unknown):value is Crop=>typeof value==='string'&&Object.hasOwn(CROPS,value);
export const validFarmPlot=(plot:unknown):plot is [number,number]=>Array.isArray(plot)&&plot.length===2&&plot.every(n=>Number.isInteger(n)&&n>=1&&n<=10);
export const farmArea=(plot:readonly[number,number]=[2,2])=>plot[0]*plot[1];
export const farmJobs=(plot?:readonly[number,number])=>Math.min(12,Math.max(1,Math.ceil(farmArea(plot)/4)));
export const farmPrice=(plot?:readonly[number,number])=>({cost:30+farmArea(plot)*20,materials:{wood:2+Math.ceil(farmArea(plot)/2)}});
export const farmWork=(plot?:readonly[number,number])=>20+farmArea(plot)*12;
export function farmRectangle(from:{x:number;y:number},to:{x:number;y:number}){
  const x=from.x+Math.max(-9,Math.min(9,to.x-from.x)),y=from.y+Math.max(-9,Math.min(9,to.y-from.y));
  return {x:Math.min(from.x,x),y:Math.min(from.y,y),plot:[Math.abs(x-from.x)+1,Math.abs(y-from.y)+1] as [number,number]};
}
/** Four individually tended crop patches per tile; dimensions never scale plants. */
export function farmPatch(index:number,plot:readonly[number,number]=[2,2]){
  const columns=plot[0]*2;
  return {x:Math.floor(index%columns)/2-.25,y:Math.floor(index/columns)/2-.25};
}
