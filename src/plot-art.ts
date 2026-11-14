import type Phaser from "phaser";
import { buildingArt, type BuildingArt } from "./building-art.js";
import { dimensions, type BuildingKind, type HouseTier } from "./catalog.js";
import { iso, plotTransform, plotOutline } from "./rendering.js";
import { drawFoundation } from "./foundation.js";
import { drawPlaza } from "./park-art.js";

const RESOLUTION = 4;
/** One raised stone foundation material, shared by all plot sizes and views. */
export function drawPlot(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement,
  art: BuildingArt,
  w: number,
  h: number,
  benches?: HTMLImageElement,
  stone?: HTMLImageElement,
) {
  drawFoundation(ctx, w, h, stone);
  if (art.texture === "park-parts") {
    if (benches) drawPlaza(ctx, source, benches, art.frame);
    return;
  }
  const t = plotTransform(art.ground, w, h),
    [cw, ch] = art.size;
  const sw = Math.floor(source.width / art.columns),
    sh = Math.floor(source.height / art.rows);
  const sx = Math.floor(
      ((art.frame % art.columns) * source.width) / art.columns,
    ),
    sy = Math.floor(
      (Math.floor(art.frame / art.columns) * source.height) / art.rows,
    );
  ctx.imageSmoothingEnabled = false;
  const top = t.point(0, 0);
  ctx.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    top.x,
    top.y,
    cw * t.scale,
    ch * t.scale,
  );
}

export function plotBounds(art: BuildingArt, w: number, h: number) {
  const t = plotTransform(art.ground, w, h),
    [cw, ch] = art.size;
  const corners = [t.point(0, 0), t.point(cw, ch), ...plotOutline(w, h)];
  // The sails extend above the tower. Include their swept envelope in cached
  // previews and visibility bounds, even though gameplay animates them separately.
  if(art.texture==="building-mill" && art.mechanism) {
    const p=t.point(...art.mechanism),r=350*t.scale;
    corners.push({x:p.x-r,y:p.y-r},{x:p.x+r,y:p.y+r});
  }
  return {
    left: Math.floor(Math.min(...corners.map((p) => p.x))),
    top: Math.floor(Math.min(...corners.map((p) => p.y))),
    right: Math.ceil(Math.max(...corners.map((p) => p.x))),
    bottom: Math.ceil(Math.max(...corners.map((p) => p.y))),
  };
}
export class PlotArt {
  private cache = new Map<string, { texture: string; x: number; y: number }>();
  constructor(private scene: Phaser.Scene) {}
  place(
    sprite: Phaser.GameObjects.Image,
    kind: BuildingKind,
    x: number,
    y: number,
    rotation: number,
    plot?: readonly [number, number],
    houseTier: HouseTier = 1,
  ) {
    const [w, h] = dimensions(kind, rotation, plot),
      key = `fitted-${kind}-${houseTier}-${rotation}-${w}-${h}`;
    let fit = this.cache.get(key);
    if (!fit) {
      const art = buildingArt(kind, rotation, houseTier),
        source = this.scene.textures
          .get(art.texture)
          .getSourceImage() as HTMLImageElement;
      const { left, top, right, bottom } = plotBounds(art, w, h);
      const texture = this.scene.textures.createCanvas(
        key,
        (right - left) * RESOLUTION,
        (bottom - top) * RESOLUTION,
      )!;
      const ctx = texture.context;
      ctx.scale(RESOLUTION, RESOLUTION);
      ctx.translate(-left, -top);
      drawPlot(
        ctx,
        source,
        art,
        w,
        h,
        this.scene.textures
          .get("park-benches")
          .getSourceImage() as HTMLImageElement,
        this.scene.textures
          .get("foundation-stone")
          .getSourceImage() as HTMLImageElement,
      );
      texture.refresh();
      fit = { texture: key, x: left, y: top };
      this.cache.set(key, fit);
    }
    const p = iso(x, y);
    sprite
      .setTexture(fit.texture)
      .setOrigin(0, 0)
      .setScale(1 / RESOLUTION)
      .setPosition(p.x + fit.x, p.y + fit.y);
  }
  point(
    kind: BuildingKind,
    rotation: number,
    x: number,
    y: number,
    plot?: readonly [number, number],
    houseTier: HouseTier = 1,
  ) {
    const art = buildingArt(kind, rotation, houseTier),
      [w, h] = dimensions(kind, rotation, plot),
      t = plotTransform(art.ground, w, h);
    return { ...t.point(x, y), scale: t.scale };
  }
}
