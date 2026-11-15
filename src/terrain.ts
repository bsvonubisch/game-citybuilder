import { SIZE, STARTING_SIZE, footprint } from "./catalog.js";
import { depositAt } from "./deposits.js";
import type { World, Point } from "./simulation.js";

export type TerrainCell = { kind: "land" | "water"; height: number };
export type TerrainMap = Record<string, TerrainCell>;
export type TerrainMode = "raise" | "lower" | "level" | "water" | "land";
export type TerrainCommand = {
  type: "terrain";
  x: number;
  y: number;
  size: number;
  mode: TerrainMode;
  steps?: number;
  level?: number;
};
export const HEIGHT_STEP = 8,
  MIN_HEIGHT = -3,
  MAX_HEIGHT = 6;
const key = (x: number, y: number) => `${x},${y}`;
export const baseTerrain = (x: number, y: number): "land" | "water" => {
  const bank = 23 + Math.floor(Math.sin(y * 0.37) * 1.6);
  // Keep every original tile intact, including the two existing bridge ends.
  if (x < STARTING_SIZE && y < STARTING_SIZE)
    return x >= bank || (y < 2 && x > 18) ? "water" : "land";
  const river = x >= bank && x < 30 + Math.floor(Math.sin(y * 0.19) * 1.5);
  const lake = ((x - 51) / 6) ** 2 + ((y - 45) / 6) ** 2 < 1;
  return river || lake || (y < 2 && x > 18 && x < 31) ? "water" : "land";
};
export function terrainCell(
  x: number,
  y: number,
  map?: TerrainMap,
): TerrainCell {
  return (
    map?.[key(Math.round(x), Math.round(y))] ?? {
      kind: baseTerrain(Math.round(x), Math.round(y)),
      height: 0,
    }
  );
}
export const groundHeight = (x: number, y: number, map?: TerrainMap) =>
  terrainCell(x, y, map).height * HEIGHT_STEP;
export function brushCells(x: number, y: number, size: number): Point[] {
  const start = Math.floor((size - 1) / 2),
    cells: Point[] = [];
  for (let j = y - start; j < y - start + size; j++)
    for (let i = x - start; i < x - start + size; i++)
      if (i >= 0 && j >= 0 && i < SIZE && j < SIZE) cells.push({ x: i, y: j });
  return cells;
}
export interface TerrainPlan {
  changes: (Point & TerrainCell)[];
  cost: number;
  error: string | null;
}
/** Raise the lowest selected terrace, or lower the highest, like a land brush.
 * Validate the entire edit before charging gold or changing the saved map. */
export function planTerrain(
  world: World,
  command: TerrainCommand,
): TerrainPlan {
  const fail = (error: string): TerrainPlan => ({
    changes: [],
    cost: 0,
    error,
  });
  const { x, y, size, mode } = command,
    steps = command.steps ?? 1;
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= SIZE ||
    y >= SIZE ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 5 ||
    !["land", "water", "raise", "lower", "level"].includes(mode) ||
    !Number.isInteger(steps) ||
    steps < 1 ||
    steps > 9
  )
    return fail("Choose a terrain brush inside the valley.");
  const cells = brushCells(x, y, size).map((p) => ({
    ...p,
    ...terrainCell(p.x, p.y, world.terrain),
  }));
  const level = command.level ?? terrainCell(x, y, world.terrain).height;
  if (!Number.isInteger(level) || level < MIN_HEIGHT || level > MAX_HEIGHT)
    return fail("That height is outside the valley limits.");
  if (
    (mode === "raise" || mode === "lower" || mode === "level") &&
    cells.some((c) => c.kind === "water")
  )
    return fail("Fill water with Ground before changing its height.");
  if (mode === "raise" || mode === "lower") {
    for (let s = 0; s < steps; s++) {
      const edge = (mode === "raise" ? Math.min : Math.max)(
        ...cells.map((c) => c.height),
      );
      for (const c of cells)
        if (c.height === edge) c.height += mode === "raise" ? 1 : -1;
    }
  } else
    for (const c of cells) {
      if (mode === "level") c.height = level;
      else if (mode === "water") {
        c.kind = "water";
        c.height = 0;
      } else if (c.kind === "water") {
        c.kind = "land";
        c.height = 0;
      }
    }
  if (mode === "water") {
    // Water spreads through connected depressions below river level, rather
    // than leaving a vertical wall of water beside a lower, dry tile.
    const visited = new Set(cells.map((c) => key(c.x, c.y)));
    for (let i = 0; i < cells.length; i++)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cells[i].x + dx,
          ny = cells[i].y + dy,
          k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || visited.has(k))
          continue;
        const c = terrainCell(nx, ny, world.terrain);
        if (c.kind === "land" && c.height < 0) {
          visited.add(k);
          cells.push({ x: nx, y: ny, kind: "water", height: 0 });
        }
      }
  }
  const changes = cells.filter((c) => {
    const before = terrainCell(c.x, c.y, world.terrain);
    return c.kind !== before.kind || c.height !== before.height;
  });
  if (!changes.length) return fail("This ground already matches the brush.");
  const occupied = new Set(
    world.buildings.flatMap((b) =>
      footprint(b.kind, b.x, b.y, b.rotation, b.plot).map((p) => key(p.x, p.y)),
    ),
  );
  const roads = new Set(world.roads);
  const cost = changes.reduce((sum, c) => {
    const old = terrainCell(c.x, c.y, world.terrain);
    return (
      sum +
      Math.abs(c.height - old.height) * 8 +
      (c.kind !== old.kind ? (c.kind === "water" ? 18 : 14) : 0)
    );
  }, 0);
  let error: string | null = null;
  for (const c of changes) {
    if (c.height < MIN_HEIGHT || c.height > MAX_HEIGHT)
      error = "Height limit reached (−3 to 6).";
    if (occupied.has(key(c.x, c.y)) || roads.has(key(c.x, c.y)))
      error =
        "Move or remove buildings and roads before reshaping their ground.";
    if (
      world.buildings.some((b) =>
        b.fishing?.path.some((p) => p.x === c.x && p.y === c.y),
      )
    )
      error =
        "A fishing boat is using this water. Let it return before reshaping the waterway.";
    if (
      c.kind === "water" &&
      world.decorations.some((d) => d.x === c.x && d.y === c.y && !d.natural)
    )
      error = "Remove garden objects before adding water.";
    if (c.kind === "water" && depositAt(c))
      error = "Keep resource deposits on dry ground.";
  }
  if (world.money < cost) error = `Need ${cost} gold for this terrain edit.`;
  return { changes, cost, error };
}
export function validateTerrain(
  value: unknown,
): asserts value is TerrainMap | undefined {
  if (value === undefined) return;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > SIZE * SIZE
  )
    throw new Error("Invalid terrain.");
  for (const [k, c] of Object.entries(value)) {
    const [x, y] = k.split(",").map(Number);
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= SIZE ||
      y >= SIZE ||
      key(x, y) !== k ||
      !c ||
      typeof c !== "object" ||
      !["land", "water"].includes(c.kind) ||
      !Number.isInteger(c.height) ||
      c.height < MIN_HEIGHT ||
      c.height > MAX_HEIGHT ||
      (c.kind === "water" && c.height !== 0)
    )
      throw new Error("Invalid terrain cell.");
  }
}
