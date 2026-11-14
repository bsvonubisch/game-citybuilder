import { BUILDINGS, FOOTPRINTS, type BuildingKind } from "../src/catalog.js";
import { buildingArt, atlasContentWidth } from "../src/building-art.js";
import { fitGround, iso, opaqueBounds } from "../src/rendering.js";

const images = new Map<string, HTMLImageElement>();
for (const texture of ["buildings", "houses"]) {
  const image = new Image();
  image.src = texture === "houses" ? "/house-rotations.png" : "/buildings.png";
  await image.decode();
  images.set(texture, image);
}
const cases = Object.keys(BUILDINGS).flatMap((kind) =>
  Array.from({ length: kind === "house" ? 4 : 1 }, (_, rotation) => ({
    kind: kind as BuildingKind,
    rotation,
  })),
);
const contacts = document.querySelector<HTMLInputElement>("#contacts")!;
const before = document.querySelector<HTMLInputElement>("#before")!;
const drawCases: (() => void)[] = [];
for (const { kind, rotation } of cases) {
  const article = document.createElement("article");
  const title = document.createElement("h2");
  const [w, h] = FOOTPRINTS[kind];
  title.textContent = `${BUILDINGS[kind].name}${kind === "house" ? " · " + ["SE", "SW", "NW", "NE"][rotation] : ""} · ${w}×${h}`;
  const canvas = document.createElement("canvas");
  canvas.width = 380;
  canvas.height = 380;
  article.append(title, canvas);
  document.querySelector("main")!.append(article);
  const ctx = canvas.getContext("2d")!;
  const art = buildingArt(kind, rotation);
  const img = images.get(art.texture)!;
  const columns = art.texture === "houses" ? 2 : 3;
  const cell = Math.floor(img.width / columns);
  const sx = (art.frame % columns) * cell,
    sy = Math.floor(art.frame / columns) * cell;
  const scratch = document.createElement("canvas");
  scratch.width = cell;
  scratch.height = cell;
  const sc = scratch.getContext("2d")!;
  sc.drawImage(img, sx, sy, cell, cell, 0, 0, cell, cell);
  const bounds = opaqueBounds(
    sc.getImageData(0, 0, cell, cell).data,
    cell,
    cell,
  );
  const fit = fitGround(art.ground, w, h);
  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#8da778";
    ctx.fillRect(0, 0, 380, 380);
    ctx.imageSmoothingEnabled = false;
    const center = iso((w - 1) / 2, (h - 1) / 2);
    ctx.translate(190 - center.x * 1.75, 276 - center.y * 1.75);
    ctx.scale(1.75, 1.75);
    const polygon = (
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
      for (let y = -1; y <= h; y++) {
        const road = x < 0 || y < 0 || x === w || y === h;
        polygon(
          [
            iso(x - 0.5, y - 0.5),
            iso(x + 0.5, y - 0.5),
            iso(x + 0.5, y + 0.5),
            iso(x - 0.5, y + 0.5),
          ],
          road ? "#b5b2a1" : "#8da778",
          road ? "#d7cfb8" : "#a5b789",
        );
      }
    polygon(
      [
        iso(-0.5, -0.5),
        iso(w - 0.5, -0.5),
        iso(w - 0.5, h - 0.5),
        iso(-0.5, h - 0.5),
      ],
      "#dbc47525",
      "#ffe5a4",
    );
    let scale = (fit.scale * art.cellSize) / cell,
      tx = fit.x,
      ty = fit.y;
    if (before.checked) {
      scale = ((w + h) * 32 * 0.98) / bounds.width;
      const front = iso(w - 0.5, h - 0.5);
      tx = front.x - (bounds.x + bounds.groundX) * scale;
      ty = front.y - 1 - (bounds.y + bounds.height) * scale;
    }
    const contentWidth = atlasContentWidth(art.texture, art.frame, cell);
    ctx.drawImage(
      img,
      sx,
      sy,
      contentWidth,
      cell,
      tx,
      ty,
      contentWidth * scale,
      cell * scale,
    );
    if (contacts.checked) {
      const points = art.ground.map(([x, y]) => ({
        x: tx + ((x * cell) / art.cellSize) * scale,
        y: ty + ((y * cell) / art.cellSize) * scale,
      }));
      polygon(points, "#5af9e212", "#5af9e2");
    }
  };
  drawCases.push(draw);
  draw();
}
contacts.onchange = before.onchange = () => drawCases.forEach((draw) => draw());
