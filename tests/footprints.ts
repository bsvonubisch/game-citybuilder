import {
  BUILDINGS,
  dimensions,
  FRONT_NAMES,
  FRONT_DIRECTIONS,
  type BuildingKind,
} from "../src/catalog.js";
import { buildingArt } from "../src/building-art.js";
import { plotTransform, iso } from "../src/rendering.js";
import { drawPlot } from "../src/plot-art.js";

const contacts = document.querySelector<HTMLInputElement>("#contacts")!;
const drawCases: (() => void)[] = [];
const filter = new URLSearchParams(location.search).get("kind");
for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
  if (filter && kind !== filter) continue;
  const image = new Image();
  image.src = `/plot-${kind}.png`;
  await image.decode();
  for (let rotation = 0; rotation < 4; rotation++) {
    const art = buildingArt(kind, rotation),
      [w, h] = dimensions(kind, rotation),
      fit = plotTransform(art.ground, w, h);
    const article = document.createElement("article"),
      title = document.createElement("h2"),
      canvas = document.createElement("canvas");
    title.textContent = `${BUILDINGS[kind].name} · ${FRONT_NAMES[rotation]} · ${w}×${h}`;
    canvas.width = 400;
    canvas.height = 390;
    article.append(title, canvas);
    document.querySelector("main")!.append(article);
    const ctx = canvas.getContext("2d")!;
    const sprite = document.createElement("canvas"),
      [cw, ch] = art.size,
      corners = [
        [0, 0],
        [cw, 0],
        [cw, ch],
        [0, ch],
      ].map(([x, y]) => fit.point(x, y));
    const left = Math.floor(Math.min(...corners.map((p) => p.x))),
      top = Math.floor(Math.min(...corners.map((p) => p.y))),
      right = Math.ceil(Math.max(...corners.map((p) => p.x))),
      bottom = Math.ceil(Math.max(...corners.map((p) => p.y)));
    sprite.width = (right - left) * 4;
    sprite.height = (bottom - top) * 4;
    const sc = sprite.getContext("2d")!;
    sc.scale(4, 4);
    sc.translate(-left, -top);
    drawPlot(sc, image, art, w, h);
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#8da778";
      ctx.fillRect(0, 0, 400, 390);
      ctx.imageSmoothingEnabled = false;
      const center = iso((w - 1) / 2, (h - 1) / 2);
      ctx.translate(200 - center.x * 1.8, 290 - center.y * 1.8);
      ctx.scale(1.8, 1.8);
      const poly = (
        points: { x: number; y: number }[],
        fill: string,
        stroke: string,
      ) => {
        ctx.beginPath();
        points.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      };
      for (let x = -1; x <= w; x++)
        for (let y = -1; y <= h; y++)
          poly(
            [
              iso(x - 0.5, y - 0.5),
              iso(x + 0.5, y - 0.5),
              iso(x + 0.5, y + 0.5),
              iso(x - 0.5, y + 0.5),
            ],
            x < 0 || y < 0 || x === w || y === h ? "#b5b2a1" : "#8da778",
            "#d7cfb8",
          );
      ctx.drawImage(sprite, left, top, right - left, bottom - top);
      if (contacts.checked) {
        poly(
          [
            iso(-0.5, -0.5),
            iso(w - 0.5, -0.5),
            iso(w - 0.5, h - 0.5),
            iso(-0.5, h - 0.5),
          ],
          "#00000000",
          "#ffe5a4",
        );
        const ground = art.ground.map(([x, y]) => fit.point(x, y));
        ctx.beginPath();
        ground.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.strokeStyle = "#5af9e2";
        ctx.lineWidth = 1;
        ctx.stroke();
        const d = FRONT_DIRECTIONS[rotation],
          edge = {
            x: (w - 1) / 2 + (d.x * w) / 2,
            y: (h - 1) / 2 + (d.y * h) / 2,
          },
          from = iso(edge.x, edge.y),
          to = iso(edge.x + d.x * 0.5, edge.y + d.y * 0.5);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = "#60ffab";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };
    drawCases.push(draw);
    draw();
  }
}
contacts.onchange = () => drawCases.forEach((draw) => draw());
