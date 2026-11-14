import type Phaser from "phaser";
import { SIZE } from "./catalog.js";
import { iso } from "./rendering.js";
import { key, terrain, type Simulation } from "./simulation.js";

const shade = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const EDGES = [
  { dx: 1, dy: 0, a: [32, 0], b: [0, 16] },
  { dx: 0, dy: 1, a: [0, 16], b: [-32, 0] },
  { dx: -1, dy: 0, a: [-32, 0], b: [0, -16] },
  { dx: 0, dy: -1, a: [0, -16], b: [32, 0] },
];

/** Rasterize flat source textures into diamond tiles once. The complete map is
 * uploaded only after edits, keeping texture-rich terrain out of the frame loop. */
export class TerrainArt {
  readonly texture: Phaser.Textures.CanvasTexture;
  private tiles: HTMLCanvasElement[] = [];
  constructor(scene: Phaser.Scene) {
    this.texture = scene.textures.createCanvas(
      "terrain-art",
      SIZE * 64,
      SIZE * 32 + 32,
    )!;
    const surfaces = scene.textures
      .get("surfaces")
      .getSourceImage() as HTMLImageElement;
    const water = scene.textures
      .get("brook")
      .getSourceImage() as HTMLImageElement;
    // Spread water across 8×8 tiles so broad ripples do not shrink into noise.
    for (let i = 0; i < 72; i++) {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      // Square texture axes project to the two diagonals of a 2:1 tile.
      ctx.setTransform(0.5, 0.25, -0.5, 0.25, 64, 0);
      if (i >= 8)
        ctx.drawImage(
          water,
          (((i - 8) % 8) * water.width) / 8,
          (Math.floor((i - 8) / 8) * water.height) / 8,
          water.width / 8,
          water.height / 8,
          0,
          0,
          128,
          128,
        );
      else {
        const w = surfaces.width / 4,
          h = surfaces.height / 2;
        ctx.drawImage(
          surfaces,
          (i % 4) * w + 2,
          Math.floor(i / 4) * h + 2,
          w - 4,
          h - 4,
          0,
          0,
          128,
          128,
        );
        if (i < 4) {
          ctx.fillStyle = "#8fa77933";
          ctx.fillRect(0, 0, 128, 128);
        }
      }
      this.tiles.push(c);
    }
  }
  redraw(sim: Simulation) {
    const ctx = this.texture.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.texture.width, this.texture.height);
    ctx.translate(SIZE * 32, 16);
    ctx.imageSmoothingEnabled = false;
    const polygon = (points: number[][], color: string) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const p = iso(x, y),
          water = terrain(x, y) === "water",
          road = sim.roads.has(key({ x, y }));
        const n = shade(x, y);
        if (x === SIZE - 1 || y === SIZE - 1)
          polygon(
            [
              [p.x - 32, p.y],
              [p.x, p.y + 16],
              [p.x + 32, p.y],
              [p.x + 32, p.y + 9],
              [p.x, p.y + 25],
              [p.x - 32, p.y + 9],
            ],
            water ? "#347d7b" : "#647e58",
          );
        polygon(
          [
            [p.x, p.y - 16],
            [p.x + 32, p.y],
            [p.x, p.y + 16],
            [p.x - 32, p.y],
          ],
          water ? "#419e9a" : "#91a96d",
        );
        const frame = water
          ? 8 + (x % 8) + (y % 8) * 8
          : (road ? 4 : 0) + Math.floor(n * 4);
        ctx.drawImage(this.tiles[frame], p.x - 32, p.y - 16, 64, 32);
        if (road && water) {
          polygon(
            [
              [p.x, p.y - 16],
              [p.x + 32, p.y],
              [p.x, p.y + 16],
              [p.x - 32, p.y],
            ],
            "#947952",
          );
          for (let i = 0; i < 8; i++) {
            const a = iso(i / 8 - 0.5, -0.5),
              b = iso(i / 8 - 0.5, 0.5);
            ctx.strokeStyle = i % 2 ? "#c8a77a" : "#ae8a5f";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(p.x + a.x, p.y + a.y);
            ctx.lineTo(p.x + b.x, p.y + b.y);
            ctx.stroke();
          }
        }
      }
    // Shorelines and curbs are a second pass so neighboring tiles never cover them.
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const p = iso(x, y),
          water = terrain(x, y) === "water",
          road = sim.roads.has(key({ x, y }));
        for (const e of EDGES) {
          const nx = x + e.dx,
            ny = y + e.dy;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          const shore = water && !road && terrain(nx, ny) === "land";
          const curb = road && !water && !sim.roads.has(key({ x: nx, y: ny }));
          if (!shore && !curb) continue;
          const ax = p.x + e.a[0],
            ay = p.y + e.a[1],
            bx = p.x + e.b[0],
            by = p.y + e.b[1];
          ctx.lineWidth = shore ? 5 : 4;
          ctx.strokeStyle = shore ? "#bcb58a" : "#d2c8ad";
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.strokeStyle = shore ? "#d9dab080" : "#eee1bf";
          ctx.beginPath();
          ctx.moveTo(ax, ay - 1);
          ctx.lineTo(bx, by - 1);
          ctx.stroke();
          for (let i = 1; i < 8; i++) {
            const xx = ax + ((bx - ax) * i) / 8,
              yy = ay + ((by - ay) * i) / 8;
            ctx.fillStyle = shore ? (i % 2 ? "#8a9e8b" : "#e0cc9d") : "#8f968c";
            ctx.fillRect(xx, yy, shore ? 3 : 1, 2);
            if (shore && shade(x + i, y) > 0.88) {
              ctx.fillStyle = "#6b8649";
              ctx.fillRect(xx, yy - 5, 1, 6);
              ctx.fillRect(xx + 2, yy - 3, 1, 4);
            }
          }
        }
      }
    this.texture.refresh();
  }
}
