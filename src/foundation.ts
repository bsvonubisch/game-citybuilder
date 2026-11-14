import { iso } from "./rendering.js";

/** Every building uses these world-space dimensions, independent of sprite scale. */
export const FOUNDATION_HEIGHT = 4;
export const STONES_PER_TILE = 6;
export const foundationGeometry = (w: number, h: number) => ({
  height: FOUNDATION_HEIGHT,
  columns: w * STONES_PER_TILE,
  rows: h * STONES_PER_TILE,
  base: [
    iso(-0.5, -0.5),
    iso(w - 0.5, -0.5),
    iso(w - 0.5, h - 0.5),
    iso(-0.5, h - 0.5),
  ],
});

export function drawFoundation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stone?: HTMLImageElement,
) {
  if (stone) {
    const n = STONES_PER_TILE,
      z = FOUNDATION_HEIGHT;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const start = iso(-0.5, -0.5);
    ctx.transform(32, 16, -32, 16, start.x, start.y - z);
    for (let x = 0; x < w; x++)
      for (let y = 0; y < h; y++) ctx.drawImage(stone, x, y, 1, 1);
    ctx.restore();
    for (const side of [0, 1])
      for (let i = 0; i < (side ? w : h) * n; i++) {
        const a = side ? iso(i / n - 0.5, h - 0.5) : iso(w - 0.5, i / n - 0.5);
        const b = side
          ? iso((i + 1) / n - 0.5, h - 0.5)
          : iso(w - 0.5, (i + 1) / n - 0.5);
        ctx.save();
        ctx.transform(b.x - a.x, b.y - a.y, 0, z, a.x, a.y - z);
        const sw = stone.width / n,
          sh = stone.height / n;
        ctx.drawImage(
          stone,
          (i % n) * sw,
          ((i * 3 + side) % n) * sh,
          sw,
          sh,
          0,
          0,
          1,
          1,
        );
        ctx.fillStyle = side ? "#54483c25" : "#3d39363d";
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
      }
    return;
  }
  const n = STONES_PER_TILE,
    z = FOUNDATION_HEIGHT;
  const polygon = (
    points: { x: number; y: number }[],
    color: string,
    stroke?: string,
  ) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.28;
      ctx.stroke();
    }
  };
  const top = (x: number, y: number) => {
    const p = iso(x, y);
    return { x: p.x, y: p.y - z };
  };
  const tones = [
    "#b4ac9e",
    "#b9b0a2",
    "#ada89b",
    "#c1b6a7",
    "#a9a699",
    "#b4b0a5",
  ];
  for (let row = 0; row < h * n; row++)
    for (let col = 0; col < w * n; col++) {
      const x = col / n - 0.5,
        y = row / n - 0.5,
        tone = (col * 13 + row * 7) % tones.length;
      const points = [
        top(x, y),
        top(x + 1 / n, y),
        top(x + 1 / n, y + 1 / n),
        top(x, y + 1 / n),
      ];
      polygon(points, tones[tone], "#827e73");
      ctx.strokeStyle = "#d5cbbb";
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(points[3].x, points[3].y);
      ctx.lineTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      const center = top(x + 0.5 / n, y + 0.5 / n);
      for (let i = 0; i < 8; i++) {
        const a = Math.sin(col * 17.1 + row * 37.7 + i * 71.3),
          b = Math.cos(col * 23.3 + row * 49.1 + i * 31.7);
        ctx.fillStyle = i % 2 ? "#c8bfaf" : "#99988a";
        ctx.fillRect(
          center.x + a * 2.4,
          center.y + b * (1 - Math.abs(a)) * 0.95,
          0.35,
          0.25,
        );
      }
    }
  // Full-height side blocks end exactly at the occupied ground outline.
  for (const side of [0, 1]) {
    const count = (side ? w : h) * n;
    for (let i = 0; i < count; i++) {
      const a = side ? iso(i / n - 0.5, h - 0.5) : iso(w - 0.5, i / n - 0.5);
      const b = side
        ? iso((i + 1) / n - 0.5, h - 0.5)
        : iso(w - 0.5, (i + 1) / n - 0.5);
      polygon(
        [{ x: a.x, y: a.y - z }, { x: b.x, y: b.y - z }, b, a],
        side ? (i % 3 ? "#a79c8e" : "#b1a597") : i % 3 ? "#8d877d" : "#979084",
        "#6f6d64",
      );
      ctx.strokeStyle = side ? "#d0c2ae" : "#b1aa98";
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - z + 0.25);
      ctx.lineTo(b.x, b.y - z + 0.25);
      ctx.stroke();
      ctx.fillStyle = side ? "#978f80" : "#797a70";
      ctx.fillRect((a.x + b.x) / 2, (a.y + b.y) / 2 - 1.2, 0.6, 0.35);
    }
  }
}
