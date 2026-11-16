import {sourceImage} from "./source-images.js";
import type Phaser from "phaser";
import type { RoadType } from "./roads.js";

/** Reuse the town's painted material detail. These small surface canvases are
 * made once and then baked into the same terrain chunks as the original slate. */
export function prepareRoadSurfaces(scene: Phaser.Scene) {
  const earth = sourceImage(scene,"construction-earth") as HTMLImageElement;
  const slate = sourceImage(scene,"slate") as HTMLImageElement;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const texture = scene.textures.createCanvas(`road-dirt-${x}-${y}`, 512, 512)!;
    const ctx = texture.context;
    ctx.drawImage(earth, x * earth.width / 2, y * earth.height / 2, earth.width / 2, earth.height / 2, 0, 0, 512, 512);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "#e3d4bd";
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = "source-over";
    texture.refresh();
  }
  const paving=scene.textures.createCanvas("road-pavement",512,512)!;
  paving.context.drawImage(slate,0,0,512,512);
  paving.context.globalCompositeOperation="source-atop";paving.context.fillStyle="#e3d9ba55";paving.context.fillRect(0,0,512,512);paving.refresh();
  for(const [kind,key] of [['stone','bridge-alpine'],['brick','bridge-iron']]){
    const source=sourceImage(scene,key),texture=scene.textures.createCanvas('road-'+kind,512,512)!;
    texture.context.drawImage(source,1,1,1252,312.5,0,0,512,512);texture.refresh();
  }
}

export function paintBrickSurface(ctx: CanvasRenderingContext2D, slate: CanvasImageSource & { width: number; height: number }) {
  ctx.fillStyle = "#665647";
  ctx.fillRect(0, 0, 512, 512);
  // Running-bond brickwork uses smaller, long pavers with the painted grain,
  // softened edges and warm highlights of the existing architecture.
  const w = 512 / 6, h = 512 / 12;
  const colors = ["#d58a60", "#c77d55", "#dda071", "#c88b68", "#d2956c"];
  for (let row = 0; row < 12; row++) for (let col = -1; col < 7; col++) {
    const x = col * w + (row % 2 ? w / 2 : 0), y = row * h;
    const index = ((row * 7 + col) % colors.length + colors.length) % colors.length;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 3);
    ctx.clip();
    ctx.drawImage(slate, slate.width * .015, slate.height * .015, slate.width * .22, slate.height * .14, x, y, w, h);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = colors[index];
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "#542412";
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#f2c59b85";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h - 4);
    ctx.lineTo(x + 3, y + 3);
    ctx.lineTo(x + w - 4, y + 3);
    ctx.stroke();
    ctx.restore();
  }
}

export function roadSurface(scene: Phaser.Scene, kind: RoadType, x: number, y: number) {
  const name = kind === "pavement" ? "road-pavement" : kind === "stone" ? "road-stone" : kind === "brick" ? "road-brick" : `road-dirt-${x % 2}-${y % 2}`;
  return sourceImage(scene,name) as HTMLImageElement | HTMLCanvasElement;
}
