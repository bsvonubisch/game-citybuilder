import type Phaser from "phaser";
import { buildingArt, type BuildingArt } from "./building-art.js";
import { dimensions, type BuildingKind, type HouseTier } from "./catalog.js";
import { iso, plotTransform, plotOutline } from "./rendering.js";

const RESOLUTION = 4;
/** A grid-aligned paved lot beneath an undistorted building. Cached at 4x. */
export function drawPlot(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement,
  art: BuildingArt,
  w: number,
  h: number,
  slate: HTMLImageElement,
) {
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
  ctx.save();
  // Only the flat paving is projected. Its edges coincide with occupancy and
  // road tiles, even when the source building has a different base aspect.
  ctx.transform(32, 16, -32, 16, 0, 0);
  ctx.fillStyle = "#aaa899";
  ctx.fillRect(-0.5, -0.5, w, h);
  const paving = ctx.createPattern(slate, "repeat")!;
  paving.setTransform(new DOMMatrix().scale(2 / slate.width, 2 / slate.height));
  ctx.fillStyle = paving;
  ctx.fillRect(-0.5, -0.5, w, h);
  // A restrained stone border makes the complete lot readable, including its
  // loading apron, without drawing a second raised platform around the sprite.
  ctx.strokeStyle = "#d5cbb1";
  ctx.lineWidth = 0.035;
  ctx.strokeRect(-0.4825, -0.4825, w - 0.035, h - 0.035);
  ctx.restore();
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
        this.scene.textures.get("slate").getSourceImage() as HTMLImageElement,
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
