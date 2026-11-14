import type Phaser from "phaser";
import { iso } from "./rendering.js";
import { fenceSpans } from "./fences.js";

const RESOLUTION = 4,
  WIDTH = 72,
  HEIGHT = 52,
  TOP = 32;
/** Sixteen cached connection variants, in the same timber as the town bridges. */
export class FenceArt {
  private cache = new Set<number>();
  constructor(private scene: Phaser.Scene) {}
  place(sprite: Phaser.GameObjects.Image, x: number, y: number, mask: number) {
    const name = `fence-${mask}`;
    if (!this.cache.has(mask)) {
      const texture = this.scene.textures.createCanvas(
        name,
        WIDTH * RESOLUTION,
        HEIGHT * RESOLUTION,
      )!;
      const ctx = texture.context;
      ctx.scale(RESOLUTION, RESOLUTION);
      ctx.translate(WIDTH / 2, TOP);
      const wood = this.scene.textures
        .get("bridge-wood")
        .getSourceImage() as HTMLImageElement;
      const beam = (
        a: { x: number; y: number },
        b: { x: number; y: number },
        thickness: number,
      ) => {
        ctx.save();
        ctx.transform(
          b.x - a.x,
          b.y - a.y,
          0,
          thickness,
          a.x,
          a.y - thickness / 2,
        );
        ctx.drawImage(
          wood,
          wood.width * 0.35,
          0,
          wood.width * 0.5,
          wood.height * 0.13,
          0,
          0,
          1,
          1,
        );
        ctx.fillStyle = "#49311a33";
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
        ctx.strokeStyle = "#c6a66d";
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - thickness / 2);
        ctx.lineTo(b.x, b.y - thickness / 2);
        ctx.stroke();
      };
      const post = (x: number, y: number) => {
        ctx.fillStyle = "#66462b";
        ctx.fillRect(x - 1.5, y - 14, 3, 14);
        ctx.drawImage(
          wood,
          wood.width * 0.55,
          0,
          wood.width * 0.04,
          wood.height,
          x - 1.5,
          y - 14,
          2.1,
          14,
        );
        ctx.fillStyle = "#d6b477";
        ctx.beginPath();
        ctx.moveTo(x - 1.9, y - 14);
        ctx.lineTo(x, y - 15.1);
        ctx.lineTo(x + 1.9, y - 14);
        ctx.lineTo(x, y - 12.9);
        ctx.closePath();
        ctx.fill();
      };
      for (const [a, b] of fenceSpans(mask)) {
        const p = iso(a.x, a.y),
          q = iso(b.x, b.y);
        beam({ x: p.x, y: p.y - 5 }, { x: q.x, y: q.y - 5 }, 2);
        beam({ x: p.x, y: p.y - 11 }, { x: q.x, y: q.y - 11 }, 2);
        beam({ x: p.x, y: p.y - 5 }, { x: q.x, y: q.y - 11 }, 1);
        if (!mask) {
          post(p.x, p.y);
          post(q.x, q.y);
        }
      }
      if (mask) post(0, 0);
      texture.refresh();
      this.cache.add(mask);
    }
    const p = iso(x, y);
    sprite
      .setTexture(name)
      .setOrigin(0, 0)
      .setScale(1 / RESOLUTION)
      .setPosition(p.x - WIDTH / 2, p.y - TOP);
  }
}
