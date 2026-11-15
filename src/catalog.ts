export type Resource =
  | "grain"
  | "flour"
  | "bread"
  | "fish"
  | "wood"
  | "stone"
  | "metal"
  | "planks"
  | "tools";
export type BuildingKind =
  | "house"
  | "farm"
  | "fishery"
  | "mill"
  | "bakery"
  | "forester"
  | "sawmill"
  | "workshop"
  | "warehouse"
  | "park"
  | "tavern"
  | "quarry"
  | "mine";
export type HouseTier = 1 | 2 | 3;
export const HOUSE_TIERS: Record<
  HouseTier,
  {
    name: string;
    capacity: number;
    description: string;
    cost: number;
    materials: Partial<Record<Resource, number>>;
  }
> = {
  1: {
    name: "Timber cottage",
    capacity: 3,
    description: "A warm first home for three residents.",
    cost: 90,
    materials: { wood: 5 },
  },
  2: {
    name: "Townhouse",
    capacity: 6,
    description:
      "An extra floor and a flower balcony make room for six residents.",
    cost: 180,
    materials: { wood: 12, stone: 10 },
  },
  3: {
    name: "Grand house",
    capacity: 9,
    description:
      "A spacious town home with fine stonework, dormers and room for nine residents.",
    cost: 420,
    materials: { planks: 16, stone: 20, metal: 8 },
  },
};
export const buildingName = (b: {
  kind: BuildingKind;
  houseTier?: HouseTier;
}) =>
  b.kind === "house"
    ? HOUSE_TIERS[b.houseTier ?? 1].name
    : BUILDINGS[b.kind].name;
export const houseCapacity = (b: {
  kind: BuildingKind;
  houseTier?: HouseTier;
}) => (b.kind === "house" ? HOUSE_TIERS[b.houseTier ?? 1].capacity : 0);
export const buildingInvestment = (b: {
  kind: BuildingKind;
  houseTier?: HouseTier;
  level?: HouseTier;
}) =>
  b.kind === "house"
    ? ([1, 2, 3] as HouseTier[])
        .filter((t) => t <= (b.houseTier ?? 1))
        .reduce((sum, t) => sum + HOUSE_TIERS[t].cost, 0)
    : BUILDINGS[b.kind].cost *
      ((b.level ?? 1) === 3 ? 6 : (b.level ?? 1) === 2 ? 3 : 1);
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
  | "move"
  | BuildingKind
  | DecorationKind
  | "road"
  | "bridge"
  | "terrain"
  | "bulldoze"
  | "inspect";
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
  fishery: {
    name: "Shoreline fishery",
    cost: 180,
    jobs: 2,
    frame: 0,
    materials: { wood: 12, planks: 4, stone: 6 },
    category: "production",
    description:
      "Fresh fish for the town. Place two tiles on shore and two in water, with the entrance facing land.",
    recipe: { output: "fish", count: 3, seconds: 10 },
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
      "The heart of a road network. Receives food and materials, and exports tools.",
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
  tavern: {
    name: "Copper Mug tavern",
    cost: 280,
    jobs: 2,
    frame: 0,
    materials: { wood: 12, planks: 8, stone: 10 },
    category: "town",
    description:
      "A warm evening meeting place. Serves nearby homes within 14 road tiles, from 17:00 to 02:00. Needs two staff.",
  },
  quarry: {
    name: "Stone quarry",
    cost: 180,
    jobs: 2,
    frame: 4,
    category: "production",
    description:
      "Build beside a stone deposit, within 8 tiles. Miners carry stone back for warehouse deliveries.",
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
      "Build beside a metal deposit, within 8 tiles. Miners carry ore back for advanced construction.",
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
  "fish",
  "planks",
  "tools",
];
export const RESOURCE_NAMES: Record<Resource, string> = {
  grain: "Grain",
  flour: "Flour",
  bread: "Bread",
  fish: "Fish",
  wood: "Wood",
  stone: "Stone",
  metal: "Metal",
  planks: "Planks",
  tools: "Tools",
};
export const FOOTPRINTS: Record<BuildingKind, readonly [number, number]> = {
  house: [2, 2],
  farm: [2, 2],
  fishery: [2, 2],
  mill: [2, 2],
  bakery: [2, 2],
  forester: [2, 2],
  sawmill: [2, 2],
  workshop: [2, 2],
  warehouse: [2, 2],
  park: [2, 2],
  tavern: [2, 2],
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
  if (kind === "park")
    return [
      ...Array.from({ length: w }, (_, i) => ({ x: x + i, y: y - 1 })),
      ...Array.from({ length: w }, (_, i) => ({ x: x + i, y: y + h })),
      ...Array.from({ length: h }, (_, i) => ({ x: x - 1, y: y + i })),
      ...Array.from({ length: h }, (_, i) => ({ x: x + w, y: y + i })),
    ];
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
export const STARTING_SIZE = 28;
export const SIZE = 64;
export const STEP = 0.25;
export const AGENT_SPEED = { person: 0.75, car: 1.4, truck: 1.05 } as const;
