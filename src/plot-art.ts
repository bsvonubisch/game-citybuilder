import type Phaser from "phaser";
import { buildingArt, type BuildingArt } from "./building-art.js";
import { dimensions, type BuildingKind } from "./catalog.js";
import { iso, plotTransform } from "./rendering.js";

const RESOLUTION = 4;
/** Rasterize once into whole destination pixels, avoiding translucent seams
 * between fractional source columns. Call with a 4x canvas transform. */
export function drawPlot(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement,
  art: BuildingArt,
  w: number,
  h: number,
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
  ctx.imageSmoothingEnabled = false;
  const start = Math.ceil(t.point(0, 0).x * RESOLUTION),
    end = Math.floor(t.point(cw, 0).x * RESOLUTION);
  for (let column = start; column < end; column++) {
    const left = column / RESOLUTION,
      right = (column + 1) / RESOLUTION,
      x = t.sourceX(left),
      next = t.sourceX(right),
      mid = t.sourceX((left + right) / 2);
    const top = t.point(mid, 0).y,
      bottom = t.point(mid, ch).y;
    ctx.drawImage(
      source,
      sx + (x * sw) / cw,
      sy,
      ((next - x) * sw) / cw,
      sh,
      left,
      top,
      1 / RESOLUTION,
      bottom - top,
    );
  }
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
  ) {
    const [w, h] = dimensions(kind, rotation, plot),
      key = `fitted-${kind}-${rotation}-${w}-${h}`;
    let fit = this.cache.get(key);
    if (!fit) {
      const art = buildingArt(kind, rotation),
        source = this.scene.textures
          .get(art.texture)
          .getSourceImage() as HTMLImageElement;
      const transform = plotTransform(art.ground, w, h),
        [cw, ch] = art.size;
      const corners = [
        [0, 0],
        [cw, 0],
        [cw, ch],
        [0, ch],
      ].map(([x, y]) => transform.point(x, y));
      const left = Math.floor(Math.min(...corners.map((p) => p.x))),
        top = Math.floor(Math.min(...corners.map((p) => p.y)));
      const right = Math.ceil(Math.max(...corners.map((p) => p.x))),
        bottom = Math.ceil(Math.max(...corners.map((p) => p.y)));
      const texture = this.scene.textures.createCanvas(
        key,
        (right - left) * RESOLUTION,
        (bottom - top) * RESOLUTION,
      )!;
      const ctx = texture.context;
      ctx.scale(RESOLUTION, RESOLUTION);
      ctx.translate(-left, -top);
      drawPlot(ctx, source, art, w, h);
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
  ) {
    const art = buildingArt(kind, rotation),
      [w, h] = dimensions(kind, rotation, plot),
      t = plotTransform(art.ground, w, h);
    return { ...t.point(x, y), scale: t.scaleAt(x) };
  }
}
