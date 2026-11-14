export type Resource =
  "grain" | "flour" | "bread" | "wood" | "stone" | "metal" | "planks" | "tools";
export type BuildingKind =
  | "house"
  | "farm"
  | "mill"
  | "bakery"
  | "forester"
  | "sawmill"
  | "workshop"
  | "warehouse"
  | "park"
  | "quarry"
  | "mine";
export type DecorationKind =
  | "oak"
  | "pine"
  | "birch"
  | "blossom"
  | "bench"
  | "streetlight"
  | "planter"
  | "fence";
export const DECORATIONS: Record<
  DecorationKind,
  { name: string; cost: number; texture: string; frame: number; height: number }
> = {
  oak: { name: "Oak tree", cost: 18, texture: "garden", frame: 0, height: 62 },
  pine: {
    name: "Pine tree",
    cost: 18,
    texture: "garden",
    frame: 1,
    height: 66,
  },
  birch: {
    name: "Birch tree",
    cost: 16,
    texture: "garden",
    frame: 2,
    height: 62,
  },
  blossom: {
    name: "Blossom tree",
    cost: 24,
    texture: "garden",
    frame: 3,
    height: 54,
  },
  bench: {
    name: "Park bench",
    cost: 12,
    texture: "props",
    frame: 0,
    height: 15,
  },
  streetlight: {
    name: "Copper streetlight",
    cost: 20,
    texture: "props",
    frame: 1,
    height: 33,
  },
  planter: {
    name: "Flower planter",
    cost: 10,
    texture: "props",
    frame: 2,
    height: 14,
  },
  fence: {
    name: "Garden fence",
    cost: 8,
    texture: "props",
    frame: 3,
    height: 18,
  },
};
export type Tool =
  BuildingKind | DecorationKind | "road" | "bridge" | "bulldoze" | "inspect";
export const isBuilding = (kind: string): kind is BuildingKind =>
  Object.hasOwn(BUILDINGS, kind);
export const isDecoration = (kind: string): kind is DecorationKind =>
  Object.hasOwn(DECORATIONS, kind);
export interface Definition {
  name: string;
  cost: number;
  jobs: number;
  frame: number;
  materials?: Partial<Record<Resource, number>>;
  description: string;
  category: "homes" | "production" | "town";
  recipe?: {
    input?: Resource;
    amount?: number;
    output: Resource;
    count: number;
    seconds: number;
  };
}
export const BUILDINGS: Record<BuildingKind, Definition> = {
  house: {
    name: "Timber cottage",
    cost: 90,
    jobs: 0,
    frame: 0,
    materials: { wood: 5 },
    category: "homes",
    description:
      "A warm place for three residents. Connect to a warehouse by road.",
  },
  farm: {
    name: "Wheat farm",
    cost: 150,
    jobs: 2,
    frame: 1,
    category: "production",
    description: "Golden fields, busy hands. Grows grain for the flour mill.",
    recipe: { output: "grain", count: 3, seconds: 8 },
  },
  mill: {
    name: "Flour mill",
    cost: 220,
    jobs: 2,
    frame: 2,
    materials: { wood: 8, stone: 5 },
    category: "production",
    description:
      "Turns grain into flour. Deliveries arrive automatically by road.",
    recipe: {
      input: "grain",
      amount: 3,
      output: "flour",
      count: 2,
      seconds: 7,
    },
  },
  bakery: {
    name: "Village bakery",
    cost: 240,
    jobs: 2,
    frame: 3,
    category: "production",
    description: "Fresh bread for the whole town. Needs flour from a mill.",
    recipe: {
      input: "flour",
      amount: 2,
      output: "bread",
      count: 5,
      seconds: 8,
    },
  },
  forester: {
    name: "Forester lodge",
    cost: 140,
    jobs: 2,
    frame: 4,
    category: "production",
    description: "Sustainably harvests wood for building and the sawmill.",
    recipe: { output: "wood", count: 3, seconds: 8 },
  },
  sawmill: {
    name: "Sawmill",
    cost: 220,
    jobs: 2,
    frame: 5,
    materials: { wood: 8, stone: 5 },
    category: "production",
    description: "Cuts wood into planks for your workshop.",
    recipe: {
      input: "wood",
      amount: 3,
      output: "planks",
      count: 2,
      seconds: 7,
    },
  },
  workshop: {
    name: "Copper workshop",
    cost: 320,
    jobs: 3,
    frame: 6,
    materials: { wood: 10, stone: 10, metal: 8 },
    category: "production",
    description: "Crafts tools from planks. Delivered tools sell for 35 gold.",
    recipe: {
      input: "planks",
      amount: 2,
      output: "tools",
      count: 1,
      seconds: 10,
    },
  },
  warehouse: {
    name: "Warehouse",
    cost: 200,
    jobs: 0,
    frame: 7,
    category: "town",
    description:
      "The heart of a road network. Receives bread and exports tools.",
  },
  park: {
    name: "Fountain square",
    cost: 65,
    jobs: 0,
    frame: 8,
    materials: { stone: 5 },
    category: "town",
    description: "A little place to slow down. Improves the town’s happiness.",
  },
  quarry: {
    name: "Stone quarry",
    cost: 180,
    jobs: 2,
    frame: 4,
    category: "production",
    description:
      "Build on a stone deposit. Delivers building stone to a warehouse.",
    recipe: { output: "stone", count: 3, seconds: 10 },
  },
  mine: {
    name: "Metal mine",
    cost: 260,
    jobs: 3,
    frame: 6,
    materials: { wood: 8, stone: 5 },
    category: "production",
    description:
      "Build on a metal deposit. Extracts metal for advanced construction.",
    recipe: { output: "metal", count: 2, seconds: 12 },
  },
};
export const RESOURCES: Resource[] = [
  "wood",
  "stone",
  "metal",
  "grain",
  "flour",
  "bread",
  "planks",
  "tools",
];
export const RESOURCE_NAMES: Record<Resource, string> = {
  grain: "Grain",
  flour: "Flour",
  bread: "Bread",
  wood: "Wood",
  stone: "Stone",
  metal: "Metal",
  planks: "Planks",
  tools: "Tools",
};
export const FOOTPRINTS: Record<BuildingKind, readonly [number, number]> = {
  house: [2, 2],
  farm: [3, 2],
  mill: [2, 2],
  bakery: [2, 2],
  forester: [2, 2],
  sawmill: [3, 2],
  workshop: [3, 2],
  warehouse: [3, 2],
  park: [2, 2],
  quarry: [2, 2],
  mine: [2, 2],
};
export const dimensions = (
  kind: BuildingKind,
  rotation = 0,
  plot?: readonly [number, number],
): readonly [number, number] =>
  plot ??
  (rotation % 2
    ? [FOOTPRINTS[kind][1], FOOTPRINTS[kind][0]]
    : FOOTPRINTS[kind]);
export const footprint = (
  kind: BuildingKind,
  x: number,
  y: number,
  rotation = 0,
  plot?: readonly [number, number],
) => {
  const [w, h] = dimensions(kind, rotation, plot);
  return Array.from({ length: w * h }, (_, i) => ({
    x: x + (i % w),
    y: y + Math.floor(i / w),
  }));
};
export const FRONT_DIRECTIONS = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
] as const;
export const FRONT_NAMES = [
  "southwest",
  "southeast",
  "northeast",
  "northwest",
] as const;
export function frontage(
  kind: BuildingKind,
  x: number,
  y: number,
  rotation = 0,
  plot?: readonly [number, number],
) {
  const [w, h] = dimensions(kind, rotation, plot),
    d = FRONT_DIRECTIONS[rotation];
  return d.x
    ? Array.from({ length: h }, (_, i) => ({
        x: x + (d.x > 0 ? w : -1),
        y: y + i,
      }))
    : Array.from({ length: w }, (_, i) => ({
        x: x + i,
        y: y + (d.y > 0 ? h : -1),
      }));
}
export const SIZE = 28;
export const STEP = 0.25;
export const AGENT_SPEED = { person: 0.75, car: 1.4, truck: 1.05 } as const;
