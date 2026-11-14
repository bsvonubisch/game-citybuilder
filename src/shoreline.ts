import { SIZE } from "./catalog.js";
import { terrainCell, type TerrainMap } from "./terrain.js";

/** Land is always on the entrance side; the fishing dock occupies the other half. */
export function fisheryLayout(rotation: number) {
  const land = [
    { x: 0, y: 1, width: 2, height: 1 },
    { x: 1, y: 0, width: 1, height: 2 },
    { x: 0, y: 0, width: 2, height: 1 },
    { x: 0, y: 0, width: 1, height: 2 },
  ][rotation];
  const water = [
    { x: 0, y: 0, width: 2, height: 1 },
    { x: 0, y: 0, width: 1, height: 2 },
    { x: 0, y: 1, width: 2, height: 1 },
    { x: 1, y: 0, width: 1, height: 2 },
  ][rotation];
  return { land, water };
}
export function fisheryCells(x: number, y: number, rotation: number) {
  const layout = fisheryLayout(rotation);
  return (["land", "water"] as const).flatMap((kind) => {
    const r = layout[kind];
    return Array.from({ length: r.width * r.height }, (_, i) => ({
      x: x + r.x + (i % r.width),
      y: y + r.y + Math.floor(i / r.width),
      kind,
    }));
  });
}
export function fisherySiteError(
  x: number,
  y: number,
  rotation: number,
  terrain?: TerrainMap,
) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    ![0, 1, 2, 3].includes(rotation)
  )
    return "Choose a valid shoreline tile and direction.";
  const cells = fisheryCells(x, y, rotation);
  if (cells.some((p) => p.x < 0 || p.y < 0 || p.x >= SIZE || p.y >= SIZE))
    return "The whole fishery must fit inside the valley.";
  if (cells.some((p) => terrainCell(p.x, p.y, terrain).kind !== p.kind))
    return "Fishery needs two land tiles at the entrance and two water tiles behind. Rotate with R to follow the shore.";
  if (cells.some((p) => terrainCell(p.x, p.y, terrain).height !== 0))
    return "Lower the shore to water level before building a fishery.";
  return null;
}
