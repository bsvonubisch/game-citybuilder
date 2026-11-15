import type Phaser from "phaser";
import { buildingArt, type BuildingArt } from "./building-art.js";
import { dimensions, type BuildingKind, type HouseTier } from "./catalog.js";
import { iso, plotTransform, plotOutline } from "./rendering.js";
import { drawFoundation } from "./foundation.js";
import { drawPlaza } from "./park-art.js";
import { drawFisheryPlatform } from "./fishery-art.js";
import { FOUNDATION_HEIGHT } from "./foundation.js";

export function artTransform(art: BuildingArt, w: number, h: number) {
  const land = art.land;
  const t = plotTransform(art.ground, land?.width ?? w, land?.height ?? h);
  const offset = land ? iso(land.x, land.y) : { x: 0, y: 0 };
  return {
    scale: t.scale,
    point: (x: number, y: number) => {
      const p = t.point(x, y);
      return {
        x: p.x + offset.x,
        y: p.y + offset.y - (land ? FOUNDATION_HEIGHT : 0),
      };
    },
  };
}

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
  wood?: HTMLImageElement,
  plaza=true,
) {
  if (art.land && wood) {
    const rotation = [1, 0, 3, 2].indexOf(art.frame);
    drawFisheryPlatform(ctx, rotation, stone, wood);
  } else drawFoundation(ctx, w, h, stone);
  if (art.texture === "park-parts") {
    if (benches && plaza) drawPlaza(ctx, source, benches, art.frame);
    return;
  }
  const t = artTransform(art, w, h),
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
  const t = artTransform(art, w, h),
    [cw, ch] = art.size;
  const corners = [t.point(0, 0), t.point(cw, ch), ...plotOutline(w, h)];
  // The sails extend above the tower. Include their swept envelope in cached
  // previews and visibility bounds, even though gameplay animates them separately.
  if (art.texture === "building-mill" && art.mechanism) {
    const p = t.point(...art.mechanism),
      r = 350 * t.scale;
    corners.push({ x: p.x - r, y: p.y - r }, { x: p.x + r, y: p.y + r });
  }
  return {
    left: Math.floor(Math.min(...corners.map((p) => p.x))),
    top: Math.floor(Math.min(...corners.map((p) => p.y))),
    right: Math.ceil(Math.max(...corners.map((p) => p.x))),
    bottom:
      Math.ceil(Math.max(...corners.map((p) => p.y))) + (art.land ? 6 : 0),
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
        this.scene.textures
          .get("bridge-wood")
          .getSourceImage() as HTMLImageElement,
        false,
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
      t = artTransform(art, w, h);
    return { ...t.point(x, y), scale: t.scale };
  }
}
