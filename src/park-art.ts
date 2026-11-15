import { facing, iso, opaqueBounds } from "./rendering.js";
import { FOUNDATION_HEIGHT } from "./foundation.js";

type Part = "fountain" | "bench" | "flowers" | "tree" | "lamp";
interface PlazaObject {
  id: string;
  kind: Part;
  x: number;
  y: number;
  dx: number;
  dy: number;
}
// A single floor plan. Views are rotations of these objects, never new layouts.
const plan: readonly PlazaObject[] = [
  { id: "fountain", kind: "fountain", x: 0.5, y: 0.5, dx: 0, dy: 0 },
  { id: "bench-north", kind: "bench", x: 0.5, y: -0.22, dx: 0, dy: 1 },
  { id: "bench-south", kind: "bench", x: 0.5, y: 1.22, dx: 0, dy: -1 },
  { id: "flowers-west", kind: "flowers", x: -0.2, y: 1.2, dx: 0, dy: 0 },
  { id: "flowers-east", kind: "flowers", x: 1.2, y: -0.2, dx: 0, dy: 0 },
  { id: "pine", kind: "tree", x: -0.22, y: -0.22, dx: 0, dy: 0 },
  { id: "lamp-west", kind: "lamp", x: -0.3, y: 0.5, dx: 0, dy: 0 },
  { id: "lamp-east", kind: "lamp", x: 1.3, y: 0.5, dx: 0, dy: 0 },
];
export function plazaLayout(rotation: number) {
  return plan
    .map((item) => {
      let { x, y, dx, dy } = item;
      for (let i = 0; i < ((rotation % 4) + 4) % 4; i++) {
        [x, y] = [y, 1 - x];
        [dx, dy] = [dy, -dx];
      }
      return { ...item, x, y, dx, dy };
    })
    .sort((a, b) => a.x + a.y - b.x - b.y);
}
const metrics: Record<Part, { frame: number; width: number; foot: number }> = {
  fountain: { frame: 0, width: 39, foot: 7 },
  flowers: { frame: 1, width: 24, foot: 6 },
  tree: { frame: 2, width: 34, foot: 4 },
  lamp: { frame: 3, width: 12, foot: 3 },
  bench: { frame: 0, width: 20, foot: 3 },
};
const cells = new WeakMap<
  HTMLImageElement,
  ReturnType<typeof opaqueBounds>[]
>();
function cellBounds(image: HTMLImageElement) {
  let result = cells.get(image);
  if (result) return result;
  const c = document.createElement("canvas");
  c.width = Math.floor(image.width / 2);
  c.height = Math.floor(image.height / 2);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  result = Array.from({ length: 4 }, (_, frame) => {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(
      image,
      (frame % 2) * c.width,
      Math.floor(frame / 2) * c.height,
      c.width,
      c.height,
      0,
      0,
      c.width,
      c.height,
    );
    return opaqueBounds(
      ctx.getImageData(0, 0, c.width, c.height).data,
      c.width,
      c.height,
    );
  });
  cells.set(image, result);
  return result;
}
export function drawPlaza(
  ctx: CanvasRenderingContext2D,
  parts: HTMLImageElement,
  benches: HTMLImageElement,
  rotation: number,
  only?:string,
) {
  ctx.imageSmoothingEnabled = false;
  for (const item of plazaLayout(rotation)) {
    if(only&&item.id!==only)continue;
    const image = item.kind === "bench" ? benches : parts;
    const m = metrics[item.kind],
      frame = item.kind === "bench" ? facing(item.dx, item.dy) : m.frame;
    const crop = cellBounds(image)[frame],
      scale = m.width / crop.width;
    const p = iso(item.x, item.y),
      height = crop.height * scale;
    ctx.drawImage(
      image,
      (frame % 2) * Math.floor(image.width / 2) + crop.x,
      Math.floor(frame / 2) * Math.floor(image.height / 2) + crop.y,
      crop.width,
      crop.height,
      p.x - m.width / 2,
      p.y - FOUNDATION_HEIGHT + m.foot - height,
      m.width,
      height,
    );
  }
}
