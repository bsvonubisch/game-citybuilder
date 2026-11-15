import { SIZE, dimensions, type Resource } from "./catalog.js";
import type { Building, Point, World } from "./simulation.js";

/** Permanent geology. Extraction removes a layer, never the deposit location. */
export const DEPOSITS: Record<string, "stone" | "metal"> = {
  "19,4": "stone",
  "19,7": "metal",
  "17,5": "stone",
  "19,5": "metal",
  "4,19": "stone",
  "20,20": "metal",
  "9,22": "stone",
  "15,3": "metal",
  "6,32": "stone",
  "16,36": "metal",
  "4,44": "metal",
  "12,49": "stone",
  "19,55": "metal",
  "5,59": "stone",
  "34,5": "stone",
  "43,9": "metal",
  "53,4": "stone",
  "59,16": "metal",
  "37,19": "metal",
  "47,23": "stone",
  "56,29": "metal",
  "35,32": "stone",
  "42,36": "metal",
  "60,40": "stone",
  "35,46": "metal",
  "41,54": "stone",
  "52,58": "metal",
  "59,53": "stone",
};
export const INITIAL_RESERVE = 60000;
export const MINING_RADIUS = 8;
/** Nearest seam owns each exposed tile; anchors never move or merge. */
export const DEPOSIT_TILES: Record<string,string> = {};
for (const [anchor] of Object.entries(DEPOSITS)) {
  const [x,y]=anchor.split(",").map(Number);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
    if(Math.abs(dx)+Math.abs(dy)>1)continue;
    const px=x+dx,py=y+dy,k=`${px},${py}`;
    if(px<0||py<0||px>=SIZE||py>=SIZE)continue;
    const previous=DEPOSIT_TILES[k];
    const [ox,oy]=previous?.split(",").map(Number)??[Infinity,Infinity];
    if(!previous||dx*dx+dy*dy<(px-ox)**2+(py-oy)**2)DEPOSIT_TILES[k]=anchor;
  }
}
export const depositAt=(p:Point)=>DEPOSIT_TILES[`${p.x},${p.y}`];
export const exposedDeposit=(world:Pick<World,"clearedDeposits">,p:Point)=>depositAt(p)&&!world.clearedDeposits?.includes(`${p.x},${p.y}`);
export const depositTiles=(anchor:string):Point[]=>Object.entries(DEPOSIT_TILES).filter(([,a])=>a===anchor).map(([k])=>{const[x,y]=k.split(",").map(Number);return{x,y};});
export function nearbyDeposit(b:Pick<Building,"kind"|"x"|"y"|"plot"> & {rotation:number}) {
  if(!isExtractor(b.kind))return undefined;
  const [w,h]=dimensions(b.kind,b.rotation,b.plot),x=b.x+(w-1)/2,y=b.y+(h-1)/2;
  return Object.entries(DEPOSITS).filter(([,kind])=>kind===(b.kind==="quarry"?"stone":"metal"))
    .map(([id])=>({id,distance:Math.min(...depositTiles(id).map(p=>Math.hypot(p.x-x,p.y-y)))}))
    .filter(d=>d.distance<=MINING_RADIUS).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id))[0]?.id;
}
export function buildingDeposit(b:Building) {
  return b.deposit ?? (DEPOSITS[`${b.x},${b.y}`]===(b.kind==="quarry"?"stone":"metal")?`${b.x},${b.y}`:nearbyDeposit(b));
}
export function expandReserves(world:World) {
  if(world.geologyVersion===2)return;
  for(const k of Object.keys(DEPOSITS))if((world.deposits[k]??0)>0)
    world.deposits[k]+=(INITIAL_RESERVE-6000)*((world.depositDepths?.[k]??0)+1);
  world.geologyVersion=2;
}
export const isExtractor = (kind: string) =>
  kind === "quarry" || kind === "mine";
export function deeperLayer(depth: number) {
  const next = depth + 1;
  return {
    depth: next,
    reserve: INITIAL_RESERVE * (next + 1),
    cost: 300 + next * 150,
    materials: { planks: 12 + next * 4, metal: 6 + next * 2 } as Partial<
      Record<Resource, number>
    >,
    labour: Math.min(1200, 240 + next * 120),
  };
}
