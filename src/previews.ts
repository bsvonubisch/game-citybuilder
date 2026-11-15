import {drawFarmPreview} from './farm-art.js';
import type {Crop} from './farm-layout.js';
import {isLivestock,LIVESTOCK,livestockPose} from './livestock.js';
import {iso,opaqueBounds} from './rendering.js';
import type {Building} from './simulation.js';
import {drawPicketFence,fenceCrops} from "./fence-art.js";
import { buildingArt } from "./building-art.js";
import {resolvedBuildingArt} from './sprite-ground.js';
import { dimensions, type BuildingKind, type HouseTier } from "./catalog.js";
import { drawPlot, plotBounds,artTransform } from "./plot-art.js";
import { drawRotor, rotorView } from "./windmill.js";
import {drawPlanter,plantCrops} from "./planter-art.js";

const images = new Map<string, Promise<HTMLImageElement>>();
export function artImage(path: string) {
  let promise = images.get(path);
  if (!promise) {
    const image = new Image();
    image.src = path;
    promise = image.decode().then(() => image);
    images.set(path, promise);
  }
  return promise;
}
const previews = new Map<string, Promise<string>>();
export async function fencePreview(){
 const image=await artImage('/fence-pickets.png'),c=document.createElement('canvas');c.width=288;c.height=216;const ctx=c.getContext('2d')!;ctx.scale(4,4);ctx.translate(36,28);drawPicketFence(ctx,image,fenceCrops(image),1);return c.toDataURL();
}
export function planterPreview() {
  let promise=previews.get("planter");
  if(!promise){promise=(async()=>{
    const [plants,wood]=await Promise.all([artImage("/planter-plants.png"),artImage("/bridge-wood.png")]);
    const c=document.createElement("canvas");c.width=288;c.height=216;
    const ctx=c.getContext("2d")!;ctx.scale(4,4);ctx.translate(36,29);
    drawPlanter(ctx,0,plants,plantCrops(plants),wood);return c.toDataURL();
  })();previews.set("planter",promise);}return promise;
}
export function buildingPreview(
  kind: BuildingKind,
  rotation = 0,
  tier: HouseTier = 1,
  crop:Crop|null='wheat',
) {
  const key = `${kind}-${rotation}-${tier}-${crop}`;
  let promise = previews.get(key);
  if (!promise) {
    promise = (async () => {
      let art = buildingArt(kind, rotation, tier);
      const [w, h] = dimensions(kind, rotation);
      const [image, benches, rotor, stone, wood, meadow, earth] = await Promise.all([
        artImage(`/${art.texture}.png`),
        (kind === "park" || kind === "garden") ? artImage("/park-benches.png") : undefined,
        kind === "mill" ? artImage("/windmill-parts.png") : undefined,
        artImage("/foundation-stone.png"),
        kind === "fishery" ? artImage("/bridge-wood.png") : undefined,
        kind === "garden" || isLivestock(kind) ? artImage("/meadow-hd.png") : undefined,
        kind === "farm" || kind === 'pigs' ? artImage("/construction-earth.png") : undefined,
      ]);
      art=resolvedBuildingArt(kind,rotation,tier,image);
      const bounds = plotBounds(art, w, h),
        canvas = document.createElement("canvas");
      canvas.width = (bounds.right - bounds.left + 16) * 3;
      canvas.height = (bounds.bottom - bounds.top + 32) * 3;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(3, 3);
      ctx.translate(-bounds.left + 8, -bounds.top + 24);
      const t = artTransform(art, w, h),
        p = art.mechanism ? t.point(...art.mechanism) : null;
      const sail = () => {
        if (rotor && p)
          drawRotor(ctx, rotor, p.x, p.y, t.scale * 0.7, rotation, 0.5);
      };
      if (rotorView(rotation).rear) sail();
      if(kind==='farm'&&earth)drawFarmPreview(ctx,image,earth,w,h,crop);else drawPlot(ctx, image, art, w, h, benches, stone, wood,true,meadow,earth);
      if(isLivestock(kind)){
        const sheet=await artImage(`/livestock-${LIVESTOCK[kind].animal}.png`),cell=document.createElement('canvas');cell.width=sheet.width/4;cell.height=sheet.height/4;
        const c=cell.getContext('2d')!;c.drawImage(sheet,0,0,cell.width,cell.height,0,0,cell.width,cell.height);
        const box=opaqueBounds(c.getImageData(0,0,cell.width,cell.height).data,cell.width,cell.height),scale=LIVESTOCK[kind].height/box.height;
        for(let i=0;i<2;i++){const p=livestockPose({id:0,kind,x:0,y:0,rotation:rotation as Building['rotation'],plot:[w,h]},i,0);if(!p)continue;const v=iso(p.x,p.y);ctx.drawImage(cell,box.x,box.y,box.width,box.height,v.x-box.width*scale/2,v.y-box.height*scale,box.width*scale,box.height*scale);}
      }
      if (!rotorView(rotation).rear) sail();
      return canvas.toDataURL();
    })();
    previews.set(key, promise);
  }
  return { key, promise };
}
