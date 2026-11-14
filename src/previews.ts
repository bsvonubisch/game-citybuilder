import { buildingArt } from "./building-art.js";
import { dimensions, type BuildingKind, type HouseTier } from "./catalog.js";
import { drawPlot, plotBounds } from "./plot-art.js";
import { plotTransform } from "./rendering.js";
import { drawRotor, rotorView } from "./windmill.js";

const images = new Map<string, Promise<HTMLImageElement>>();
export function artImage(path: string) {
  let promise = images.get(path);
  if (!promise) {
    const image = new Image();
    image.src = path;
    promise = image.decode().then(() => image);
    images.set(path, promise);
  }
  return promise;
}
const previews = new Map<string, Promise<string>>();
export function buildingPreview(
  kind: BuildingKind,
  rotation = 0,
  tier: HouseTier = 1,
) {
  const key = `${kind}-${rotation}-${tier}`;
  let promise = previews.get(key);
  if (!promise) {
    promise = (async () => {
      const art = buildingArt(kind, rotation, tier),
        [w, h] = dimensions(kind, rotation);
      const [image, benches, rotor, stone] = await Promise.all([
        artImage(`/${art.texture}.png`),
        kind === "park" ? artImage("/park-benches.png") : undefined,
        kind === "mill" ? artImage("/windmill-parts.png") : undefined,
        artImage("/foundation-stone.png"),
      ]);
      const bounds = plotBounds(art, w, h),
        canvas = document.createElement("canvas");
      canvas.width = (bounds.right - bounds.left + 16) * 3;
      canvas.height = (bounds.bottom - bounds.top + 32) * 3;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(3, 3);
      ctx.translate(-bounds.left + 8, -bounds.top + 24);
      const t = plotTransform(art.ground, w, h),
        p = art.mechanism ? t.point(...art.mechanism) : null;
      const sail = () => {
        if (rotor && p)
          drawRotor(ctx, rotor, p.x, p.y, t.scale * 0.7, rotation, 0.5);
      };
      if (rotorView(rotation).rear) sail();
      drawPlot(ctx, image, art, w, h, benches, stone);
      if (!rotorView(rotation).rear) sail();
      return canvas.toDataURL();
    })();
    previews.set(key, promise);
  }
  return { key, promise };
}
