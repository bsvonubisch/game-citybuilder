import {roadVisualState,roadWorkAt} from './roadworks.js';
import {sourceImage} from "./source-images.js";
import type Phaser from "phaser";
import { roadSurface } from "./road-art.js";
import { roadTypeAt } from "./roads.js";
import { groundHeight } from "./terrain.js";
import { SIZE } from "./catalog.js";
import { iso, cameraViewport } from "./rendering.js";
import { key, terrain, type Simulation } from "./simulation.js";

// Four source pixels per world pixel preserves detail at the maximum 2.7× zoom.
// Small GPU textures also work on devices with a 2048px texture limit.
export const TERRAIN_RESOLUTION = 4;
const CHUNK = 256;
const BORDER = 2;
const EDGES = [
  { dx: 1, dy: 0, a: [32, 0], b: [0, 16] },
  { dx: 0, dy: 1, a: [0, 16], b: [-32, 0] },
  { dx: -1, dy: 0, a: [-32, 0], b: [0, -16] },
  { dx: 0, dy: -1, a: [0, -16], b: [32, 0] },
];
const shade = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export class TerrainArt {
  private chunks: {
    texture?: Phaser.Textures.CanvasTexture;
    image?: Phaser.GameObjects.Image;
    name: string;
    dirty: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  private grass: HTMLImageElement;
  private shore: HTMLImageElement;
  constructor(private scene: Phaser.Scene) {
    const source = (name: string) =>
      sourceImage(scene,name) as HTMLImageElement;
    this.grass = source("meadow");
    this.shore = source("shore");
    const width = SIZE * 64,
      height = SIZE * 32 + 32;
    for (let y = 0; y < height; y += CHUNK)
      for (let x = 0; x < width; x += CHUNK) {
        const w = Math.min(CHUNK, width - x),
          h = Math.min(CHUNK, height - y);
        const name = `terrain-${x}-${y}`;
        const worldX = x - SIZE * 32,
          worldY = y - 16;
        this.chunks.push({ name, dirty: true, x: worldX, y: worldY, w, h });
      }
  }

  redraw(sim: Simulation) {
    for (const chunk of this.chunks) chunk.dirty = true;
    this.update(sim);
  }
  /** The expanded valley keeps high-resolution terrain only around the camera.
   * Off-screen chunks are disposable, so map size does not allocate one huge bitmap. */
  update(sim: Simulation) {
    sim=roadVisualState(sim);
    const view = cameraViewport(this.scene.cameras.main),
      margin = 64;
    for (const chunk of this.chunks) {
      const near =
        chunk.x + chunk.w >= view.x - margin &&
        chunk.x <= view.x + view.width + margin &&
        chunk.y + chunk.h >= view.y - margin &&
        chunk.y <= view.y + view.height + margin;
      if (!near) {
        if (chunk.texture) {
          chunk.image!.destroy();
          this.scene.textures.remove(chunk.name);
          chunk.texture = undefined;
          chunk.image = undefined;
          chunk.dirty = true;
        }
        continue;
      }
      if (!chunk.texture) {
        chunk.texture = this.scene.textures.createCanvas(
          chunk.name,
          chunk.w * TERRAIN_RESOLUTION + BORDER*2,
          chunk.h * TERRAIN_RESOLUTION + BORDER*2,
        )!;
        // A shared world-space gutter gives linear filtering real neighbouring
        // pixels at chunk joins, instead of sampling a transparent boundary.
        chunk.texture.add('inner',0,BORDER,BORDER,chunk.w*TERRAIN_RESOLUTION,chunk.h*TERRAIN_RESOLUTION);
        chunk.image = this.scene.add
          .image(chunk.x, chunk.y, chunk.name,'inner')
          .setOrigin(0)
          .setScale(1 / TERRAIN_RESOLUTION)
          .setDepth(-1000);
      }
      if (!chunk.dirty) continue;
      chunk.dirty = false;
      const ctx = chunk.texture.context;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, chunk.texture.width, chunk.texture.height);
      ctx.setTransform(
        TERRAIN_RESOLUTION,
        0,
        0,
        TERRAIN_RESOLUTION,
        -chunk.x * TERRAIN_RESOLUTION + BORDER,
        -chunk.y * TERRAIN_RESOLUTION + BORDER,
      );
      ctx.imageSmoothingEnabled = true;
      const pattern = (source: HTMLImageElement, size: number) => {
        const p = ctx.createPattern(source, "repeat")!;
        p.setTransform(
          new DOMMatrix().scale(size / source.width, size / source.height),
        );
        return p;
      };
      // The moving water field is rendered separately below the cached banks.
      const meadow = pattern(this.grass, 160);
      const poly = (points: number[][], fill: string | CanvasPattern) => {
        ctx.beginPath();
        points.forEach(([x, y], i) =>
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
        );
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      const visible = (x: number, y: number) =>
        x + 42 >= chunk.x &&
        x - 42 < chunk.x + chunk.w &&
        y + 32 >= chunk.y &&
        y - 36 < chunk.y + chunk.h;
      const line = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        width: number,
        color: string,
      ) => {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      };
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          if (groundHeight(x, y, sim.state.terrain) !== 0) continue;
          const p = iso(x, y);
          if (!visible(p.x, p.y)) continue;
          const water = terrain(x, y, sim.state.terrain) === "water",
            road = sim.roads.has(key({ x, y }));
          if (x === SIZE - 1)
            poly(
              [
                [p.x + 32, p.y],
                [p.x, p.y + 16],
                [p.x, p.y + 25],
                [p.x + 32, p.y + 9],
              ],
              water ? "#347d7b" : "#64754d",
            );
          if (y === SIZE - 1)
            poly(
              [
                [p.x - 32, p.y],
                [p.x, p.y + 16],
                [p.x, p.y + 25],
                [p.x - 32, p.y + 9],
              ],
              water ? "#347d7b" : "#64754d",
            );
          const diamond = [
            [p.x, p.y - 16.1],
            [p.x + 32.2, p.y],
            [p.x, p.y + 16.1],
            [p.x - 32.2, p.y],
          ];
          if (!water) poly(diamond, meadow);
          if (!water && road) {
            ctx.save();
            if(roadWorkAt(sim.state,{x,y})){ctx.globalAlpha=.9;ctx.filter="saturate(.15) brightness(.8)";}
            ctx.translate(p.x, p.y - 16);
            ctx.transform(32, 16, -32, 16, 0, 0);
            ctx.drawImage(roadSurface(this.scene, roadTypeAt(sim.state.roadTypes, {x, y}), x, y), 0, 0, 1, 1);
            ctx.restore();
          }
        }
      // Individual raised curb stones and banks are baked only after town edits.
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          if (groundHeight(x, y, sim.state.terrain) !== 0) continue;
          const p = iso(x, y);
          if (!visible(p.x, p.y)) continue;
          const water = terrain(x, y, sim.state.terrain) === "water",
            road = sim.roads.has(key({ x, y }));
          for (const e of EDGES) {
            const nx = x + e.dx,
              ny = y + e.dy;
            if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
            const shore =
              water && !road && terrain(nx, ny, sim.state.terrain) === "land";
            const curb =
              road && !water && !sim.roads.has(key({ x: nx, y: ny }));
            if (!shore && !curb) continue;
            const ax = p.x + e.a[0],
              ay = p.y + e.a[1],
              bx = p.x + e.b[0],
              by = p.y + e.b[1];
            if (curb) {
              if (roadTypeAt(sim.state.roadTypes, {x, y}) === "dirt") {
                line(ax, ay + .6, bx, by + .6, 2.6, "#6e674746");
                line(ax, ay, bx, by, 1.4, "#b49a6970");
                continue;
              }
              line(ax, ay + 1, bx, by + 1, 3.2, "#6f7560");
              line(ax, ay - 0.6, bx, by - 0.6, 3.2, "#c6bba1");
              line(ax, ay - 1.7, bx, by - 1.7, 0.7, "#eee2c4");
              for (let i = 0; i <= 6; i++) {
                const xx = ax + ((bx - ax) * i) / 6,
                  yy = ay + ((by - ay) * i) / 6;
                line(xx - 1, yy + 0.7, xx + 1, yy - 2, 0.6, "#897f6a");
              }
            } else {
              line(ax, ay, bx, by, 17, "#a4ccb324");
              line(ax, ay, bx, by, 11, "#b9ceaa42");
              // Riverbed stones remain visible beneath the pale shallows.
              for (let i = 0; i < 2; i++) {
                const t = (i + 0.5) / 2,
                  frame = this.scene.textures.getFrame(
                    "shore",
                    (x + y + i) % 4,
                  );
                const w = 16,
                  h = (w * frame.height) / frame.width;
                ctx.globalAlpha = 0.32;
                ctx.drawImage(
                  this.shore,
                  frame.cutX,
                  frame.cutY,
                  frame.cutWidth,
                  frame.cutHeight,
                  ax + (bx - ax) * t - e.dx * 3 - w / 2,
                  ay + (by - ay) * t + 3 - h / 2,
                  w,
                  h,
                );
                ctx.globalAlpha = 1;
              }
              line(ax, ay, bx, by, 5, "#b7b08e");
              for (let i = 0; i < 3; i++) {
                const t = (i + 0.5) / 3;
                const frame = this.scene.textures.getFrame(
                  "shore",
                  Math.floor(shade(x + i, y) * 4),
                );
                const w = 12 + shade(x, y + i) * 5,
                  h = (w * frame.height) / frame.width;
                ctx.drawImage(
                  this.shore,
                  frame.cutX,
                  frame.cutY,
                  frame.cutWidth,
                  frame.cutHeight,
                  ax + (bx - ax) * t - w / 2,
                  ay + (by - ay) * t - h * 0.68,
                  w,
                  h,
                );
              }
            }
          }
        }
      chunk.texture.refresh();
    }
  }
}
