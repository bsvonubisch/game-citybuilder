import {roadVisualState,roadWorkAt} from './roadworks.js';
import {sourceImage} from "./source-images.js";
import type Phaser from "phaser";
import { roadSurface } from "./road-art.js";
import { roadTypeAt } from "./roads.js";
import { SIZE } from "./catalog.js";
import { iso } from "./rendering.js";
import { groundHeight, terrainCell } from "./terrain.js";
import { roadHeight } from "./bridges.js";
import type { Simulation } from "./simulation.js";

const edges = [
  [
    [32, 0],
    [0, 16],
    [1, 0],
  ],
  [
    [0, 16],
    [-32, 0],
    [0, 1],
  ],
] as const;
/** Only edited heights and their retaining edges need depth-sorted tile sprites.
 * The original flat terrain keeps its fast cached chunks. */
export class ElevationArt {
  private images: Phaser.GameObjects.Image[] = [];
  private textures = new Set<string>();
  constructor(private scene: Phaser.Scene) {}
  redraw(sim: Simulation) {
    sim=roadVisualState(sim);
    this.images.forEach((s) => s.destroy());
    this.images = [];
    for (const k of this.textures) this.scene.textures.remove(k);
    this.textures.clear();
    const map = sim.state.terrain;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const cell = terrainCell(x, y, map),
          h = groundHeight(x, y, map);
        if (cell.kind === "water") continue;
        const depths = edges.map(
          (e) => h - groundHeight(x + e[2][0], y + e[2][1], map),
        );
        const road = sim.roads.has(`${x},${y}`);
        const sloped =
          road &&
          [-1, 1].some(
            (d) =>
              groundHeight(x + d, y, map) !== h ||
              groundHeight(x, y + d, map) !== h,
          );
        if (h === 0 && !depths.some((d) => d > 0) && !sloped) continue;
        const name = `height-${x}-${y}`,
          bottom = 20 + Math.max(0, ...depths),
          top = -22;
        const texture = this.scene.textures.createCanvas(
          name,
          66 * 4,
          (bottom - top) * 4,
        )!;
        this.textures.add(name);
        const ctx = texture.context;
        ctx.scale(4, 4);
        ctx.translate(33, -top);
        const poly = (
          ps: readonly (readonly number[])[],
          fill: string | CanvasPattern,
        ) => {
          ctx.beginPath();
          ps.forEach((p, i) =>
            i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
          );
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
        };
        for (let i = 0; i < 2; i++) {
          const [a, b] = edges[i],
            drop = Math.max(0, depths[i]);
          if (!drop) continue;
          poly(
            [a, b, [b[0], b[1] + drop], [a[0], a[1] + drop]],
            i === 0 ? "#857c5f" : "#696e52",
          );
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.lineTo(b[0], b[1] + drop);
          ctx.lineTo(a[0], a[1] + drop);
          ctx.clip();
          for (let row = 0; row < drop; row += 4) {
            ctx.strokeStyle = row % 8 === 0 ? "#b1a184" : "#4d5a4355";
            ctx.lineWidth = 0.65;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1] + row);
            ctx.lineTo(b[0], b[1] + row);
            ctx.stroke();
            for (let block = 0; block < 5; block++) {
              const t = (block + (row % 8 ? 0.5 : 0)) / 4;
              ctx.strokeStyle = "#555c46";
              ctx.beginPath();
              ctx.moveTo(
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t + row,
              );
              ctx.lineTo(
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t + row + 4,
              );
              ctx.stroke();
            }
          }
          ctx.restore();
        }
        const grass = sourceImage(this.scene,"meadow") as HTMLImageElement;
        const pattern = ctx.createPattern(grass, "repeat")!;
        pattern.setTransform(
          new DOMMatrix().scale(160 / grass.width, 160 / grass.height),
        );
        poly(
          [
            [0, -16.1],
            [32.2, 0],
            [0, 16.1],
            [-32.2, 0],
          ],
          pattern,
        );
        if (road) {
          const source = roadSurface(this.scene, roadTypeAt(sim.state.roadTypes, {x, y}), x, y);
          const corners = [
            [-0.5, -0.5],
            [0.5, -0.5],
            [0.5, 0.5],
            [-0.5, 0.5],
          ].map(([dx, dy]) => {
            const p = iso(dx, dy);
            return {
              x: p.x,
              y:
                p.y -
                roadHeight(
                  sim.roads,
                  x + dx,
                  y + dy,
                  sim.state.buildings,
                  map,
                ) +
                h,
            };
          });
          const [a, b, c, d] = corners;
          for (const [end, side, triangle] of [
            [b, { x: c.x - b.x, y: c.y - b.y }, [a, b, c]],
            [
              { x: a.x + c.x - d.x, y: a.y + c.y - d.y },
              { x: d.x - a.x, y: d.y - a.y },
              [a, c, d],
            ],
          ] as [
            { x: number; y: number },
            { x: number; y: number },
            { x: number; y: number }[],
          ][]) {
            ctx.save();
            if(roadWorkAt(sim.state,{x,y})){ctx.globalAlpha=.9;ctx.filter='saturate(.15) brightness(.8)';}
            ctx.beginPath();
            triangle.forEach((p, i) =>
              i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
            );
            ctx.closePath();
            ctx.clip();
            ctx.transform(end.x - a.x, end.y - a.y, side.x, side.y, a.x, a.y);
            ctx.drawImage(source, 0, 0, 1, 1);
            ctx.restore();
          }
        }
        texture.refresh();
        const p = iso(x, y);
        this.images.push(
          this.scene.add
            .image(p.x - 33, p.y - h + top, name)
            .setOrigin(0)
            .setScale(0.25)
            .setDepth((x + y) * 32 - 12),
        );
      }
  }
}
