import { WATER_DROP } from './water-level.js';
import {BRIDGE_TIMBER} from './timber-material.js';
import { drawFoundation, FOUNDATION_HEIGHT } from "./foundation.js";
import { fisheryLayout } from "./shoreline.js";
import { iso } from "./rendering.js";

/** Same raised stone height on land, textured timber on the exact water half. */
export function drawFisheryDock(
  ctx: CanvasRenderingContext2D,
  rotation: number,
  wood: HTMLImageElement,
  height = FOUNDATION_HEIGHT,
) {
  const r = fisheryLayout(rotation).water;
  const corners = [
    iso(r.x - 0.5, r.y - 0.5),
    iso(r.x + r.width - 0.5, r.y - 0.5),
    iso(r.x + r.width - 0.5, r.y + r.height - 0.5),
    iso(r.x - 0.5, r.y + r.height - 0.5),
  ];
  // Draw pilings first. The opaque deck hides their upper ends.
  for (const p of corners) {
    ctx.drawImage(
      wood,
      ...BRIDGE_TIMBER.post,
      p.x - 1,
      p.y - height,
      2,
      height + WATER_DROP + 2,
    );
    ctx.fillStyle = "#4d3d2840";
    ctx.fillRect(p.x - 1, p.y - height, 0.7, height + WATER_DROP + 2);
  }
  ctx.save();
  const p = corners[0];
  ctx.transform(32, 16, -32, 16, p.x, p.y - height);
  ctx.fillStyle = "#946331";
  ctx.fillRect(0, 0, r.width, r.height);
  // Boards cross the short dock dimension. Rotate the material with the plot,
  // keeping the bridge's six boards per tile and continuous two-tile repeat.
  const alongX=r.width>r.height;
  if(alongX)ctx.transform(0,1,1,0,0,0);
  const [sx,sy,sw,sh]=BRIDGE_TIMBER.deck;
  for(let x=0;x<(alongX?r.height:r.width);x++)
    for(let y=0;y<(alongX?r.width:r.height);y++)
      ctx.drawImage(wood,sx,sy+(y%2)*sh/2,sw,sh/2,x,y,1,1);
  ctx.restore();
  for (const [a, b] of [
    [corners[1], corners[2]],
    [corners[2], corners[3]],
  ]) {
    ctx.save();
    ctx.transform(b.x - a.x, b.y - a.y, 0, 2, a.x, a.y - height);
    ctx.drawImage(
      wood,
      ...BRIDGE_TIMBER.beam,
      0,
      0,
      1,
      1,
    );
    ctx.restore();
  }
  // Low mooring posts stay inside the plot; no extra tiles are obstructed.
  for (const t of [0.15, 0.85]) {
    const x = alongX
      ? r.x - 0.5 + r.width * t
      : r.x + (rotation === 1 ? -0.38 : 0.38);
    const y = alongX
      ? r.y + (rotation === 0 ? -0.38 : 0.38)
      : r.y - 0.5 + r.height * t;
    const q = iso(x, y);
    ctx.drawImage(
      wood,
      ...BRIDGE_TIMBER.post,
      q.x - 1.5,
      q.y - height - 5,
      3,
      5,
    );
    ctx.fillStyle = "#b38a54";
    ctx.fillRect(q.x - 1.5, q.y - height - 5, 3, 0.7);
  }
}
export function drawFisheryPlatform(
  ctx: CanvasRenderingContext2D,
  rotation: number,
  stone: HTMLImageElement | undefined,
  wood: HTMLImageElement,
) {
  drawFisheryDock(ctx, rotation, wood);
  const land = fisheryLayout(rotation).land,
    p = iso(land.x, land.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  drawFoundation(ctx, land.width, land.height, stone);
  ctx.restore();
}
