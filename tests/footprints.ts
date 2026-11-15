import {
  BUILDINGS,
  dimensions,
  FRONT_NAMES,
  FRONT_DIRECTIONS,
  type BuildingKind,
  type HouseTier,
} from "../src/catalog.js";
import { buildingArt } from "../src/building-art.js";
import { iso,opaqueBounds } from "../src/rendering.js";
import { drawPlot, plotBounds, artTransform } from "../src/plot-art.js";
import {resolvedBuildingArt} from '../src/sprite-ground.js';
import { drawRotor, rotorView } from "../src/windmill.js";
import { fisheryCells } from "../src/shoreline.js";

const contacts = document.querySelector<HTMLInputElement>("#contacts")!;
const drawCases: (() => void)[] = [];
contacts.onchange = () => drawCases.forEach((draw) => draw());
const filter = new URLSearchParams(location.search).get("kind")?.split(",");
const tierFilter = Number(
  new URLSearchParams(location.search).get("tier") ?? 0,
);
const benches = new Image();
benches.src = "/park-benches.png";
const rotor = new Image();
rotor.src = "/windmill-parts.png";
const stone = new Image();
stone.src = "/foundation-stone.png";
const wood = new Image();
wood.src = "/bridge-wood.png";
const meadow=new Image();meadow.src='/meadow-hd.png';
const earth=new Image();earth.src='/construction-earth.png';
const walker=new Image();walker.src='/pedestrian-walk.png';
await Promise.all([
  benches.decode(),
  rotor.decode(),
  stone.decode(),
  wood.decode(),
  meadow.decode(),walker.decode(),earth.decode(),
]);
const walkerCell=document.createElement('canvas');
walkerCell.width=Math.floor(walker.width/8);walkerCell.height=Math.floor(walker.height/4);
const wc=walkerCell.getContext('2d')!;wc.drawImage(walker,0,0);
const personBounds=opaqueBounds(wc.getImageData(0,0,walkerCell.width,walkerCell.height).data,walkerCell.width,walkerCell.height);
const personWidth=personBounds.width/personBounds.height*22;
for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
  if (filter && !filter.includes(kind)) continue;
  for (const tier of (kind === "house"
    ? tierFilter
      ? [tierFilter]
      : [1, 2, 3]
    : [1]) as HouseTier[]) {
    const image = new Image();
    image.src = `/${buildingArt(kind, 0, tier).texture}.png`;
    await image.decode();
    for (let rotation = 0; rotation < 4; rotation++) {
      const art = resolvedBuildingArt(kind, rotation, tier,image),
        [w, h] = dimensions(kind, rotation),
        fit = artTransform(art, w, h);
      const article = document.createElement("article"),
        title = document.createElement("h2"),
        canvas = document.createElement("canvas");
      title.textContent = `${BUILDINGS[kind].name}${kind === "house" ? " tier " + tier : ""} · ${FRONT_NAMES[rotation]} · ${w}×${h}`;
      canvas.width = 400;
      canvas.height = 390;
      article.append(title, canvas);
      document.querySelector("main")!.append(article);
      const ctx = canvas.getContext("2d")!;
      const sprite = document.createElement("canvas");
      const { left, top, right, bottom } = plotBounds(art, w, h);
      sprite.width = (right - left) * 4;
      sprite.height = (bottom - top) * 4;
      const sc = sprite.getContext("2d")!;
      sc.scale(4, 4);
      sc.translate(-left, -top);
      const sail = () => {
        if (kind === "mill") {
          const p = fit.point(...art.mechanism!);
          drawRotor(sc, rotor, p.x, p.y, fit.scale * 0.7, rotation, 0.5);
        }
      };
      if (rotorView(rotation).rear) sail();
      drawPlot(sc, image, art, w, h, benches, stone, wood,true,meadow,earth);
      if (!rotorView(rotation).rear) sail();
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
        if (kind === "fishery")
          for (const p of fisheryCells(0, 0, rotation)) {
            if (p.kind === "water")
              poly(
                [
                  iso(p.x - 0.5, p.y - 0.5),
                  iso(p.x + 0.5, p.y - 0.5),
                  iso(p.x + 0.5, p.y + 0.5),
                  iso(p.x - 0.5, p.y + 0.5),
                ],
                "#40a7ac",
                "#a5cbd0",
              );
          }
        ctx.drawImage(sprite, left, top, right - left, bottom - top);
        const person=iso(w-.1,h-.1);
        ctx.drawImage(walker,personBounds.x,personBounds.y,personBounds.width,personBounds.height,person.x-personWidth/2,person.y-22,personWidth,22);
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
}
