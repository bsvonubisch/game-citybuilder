import { iso, opaqueBounds, travelFacing } from "../src/rendering.js";
import { lanePose } from "../src/lanes.js";
import { walkFrame } from "../src/animation.js";
import type { Agent } from "../src/simulation.js";
const sources = await Promise.all(
  [
    "vehicles-directions",
    "vehicles-turns",
    "pedestrian-walk",
    "pedestrian-turns",
  ].map(async (name, index) => {
    const image = new Image();
    image.src = `/${name}.png`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    const cols = index < 2 ? 4 : 8,
      w = Math.floor(image.width / cols),
      h = Math.floor(image.height / 4);
    const frames = Array.from({ length: cols * 4 }, (_, i) => {
      const x = Math.floor(((i % cols) * image.width) / cols),
        y = Math.floor((Math.floor(i / cols) * image.height) / 4);
      const b = opaqueBounds(ctx.getImageData(x, y, w, h).data, w, h);
      return { ...b, x: x + b.x, y: y + b.y };
    });
    return { image, frames };
  }),
);
const cards = Array.from({ length: 8 }, (_, index) => {
  const turn = index < 4 ? 1 : -1,
    rotation = index % 4;
  const raw = [
    ...Array.from({ length: 4 }, (_, i) => ({ x: i - 3, y: 0 })),
    ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: (i + 1) * turn })),
  ];
  const path = raw.map((p) => {
    let { x, y } = p;
    for (let i = 0; i < rotation; i++) [x, y] = [-y, x];
    return { x, y };
  });
  const card = document.createElement("article");
  card.innerHTML = `<h2>${turn === 1 ? "Right" : "Left"} turn · ${["SE", "SW", "NW", "NE"][rotation]}</h2><canvas width="420" height="340"></canvas>`;
  document.querySelector("main")!.append(card);
  return { ctx: card.querySelector("canvas")!.getContext("2d")!, path, index };
});
const slider = document.querySelector<HTMLInputElement>("#distance")!,
  play = document.querySelector<HTMLButtonElement>("#play")!;
let running = false,
  last = 0;
play.onclick = () => {
  running = !running;
  play.textContent = running ? "Pause turns" : "Play turns";
};
slider.oninput = () => {
  running = false;
  play.textContent = "Play turns";
};
function draw(time: number) {
  const dt = Math.min(0.1, (time - last) / 1000);
  last = time;
  let d = +slider.value;
  if (running) {
    d = 2 + ((d - 2 + dt * 0.55) % 2);
    slider.value = String(d);
  }
  document.querySelector("output")!.textContent =
    `Route position ${d.toFixed(2)}`;
  for (const { ctx, path, index } of cards) {
    ctx.clearRect(0, 0, 420, 340);
    ctx.save();
    ctx.translate(210, 180);
    ctx.scale(1.7, 1.7);
    ctx.strokeStyle = "#a8b99c";
    ctx.lineWidth = 0.6;
    for (const tile of path) {
      const p = iso(tile.x, tile.y);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 16);
      ctx.lineTo(p.x + 32, p.y);
      ctx.lineTo(p.x, p.y + 16);
      ctx.lineTo(p.x - 32, p.y);
      ctx.closePath();
      ctx.fillStyle = "#9da89e";
      ctx.fill();
      ctx.stroke();
    }
    const travellers = ["truck", "person"]
      .map((kind, variant) => {
        const a = { kind, path, segment: 0, progress: 0 } as Agent,
          p = lanePose(a, d),
          heading = travelFacing(p.dx, p.dy);
        ctx.beginPath();
        for (let at = 0; at <= 6; at += 0.025) {
          const p = lanePose(a, at),
            v = iso(p.x, p.y);
          if (at === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        }
        ctx.strokeStyle = variant ? "#e9f2bc" : "#f4d378";
        ctx.lineWidth = 1;
        ctx.stroke();
        return { p, heading, variant };
      })
      .sort((a, b) => a.p.x + a.p.y - (b.p.x + b.p.y));
    for (const { p, heading, variant } of travellers) {
      const intermediate = heading % 2 === 1,
        direction = Math.floor(heading / 2),
        row = index % 4,
        person = variant === 1;
      const src = sources[(person ? 2 : 0) + (intermediate ? 1 : 0)],
        base = sources[person ? 2 : 0];
      const walk = walkFrame(direction, index % 2, d, false, intermediate),
        frame = person ? walk.frame : row * 4 + direction,
        b = src.frames[frame];
      const mean = person
        ? Array.from(
            { length: 16 },
            (_, i) =>
              base.frames[Math.floor(i / 4) * 8 + (index % 2) * 4 + (i % 4)]
                .height,
          )
        : Array.from({ length: 4 }, (_, i) => base.frames[row * 4 + i].width);
      const scale =
        (((person ? 22 : row < 2 ? 25 : 29) /
          (mean.reduce((s, n) => s + n, 0) / mean.length)) *
          base.image.height) /
        src.image.height;
      const v = iso(p.x, p.y),
        w = b.width * scale,
        h = b.height * scale;
      ctx.save();
      ctx.translate(v.x, v.y);
      if (person && walk.flip) ctx.scale(-1, 1);
      ctx.drawImage(
        src.image,
        b.x,
        b.y,
        b.width,
        b.height,
        -w / 2,
        -h * (person ? 1 : 0.8),
        w,
        h,
      );
      ctx.restore();
    }
    ctx.restore();
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
