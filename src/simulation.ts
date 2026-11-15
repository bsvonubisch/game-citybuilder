import {isHome} from "./catalog.js";
import {parkVisitDuration} from "./park-visitors.js";
import {fenceKey,fenceNeighbour,canonicalFence} from "./fences.js";
import { planRoad } from "./road-stroke.js";
import { stepForestry, forestTargets, landTimber, validForestTrip, harvestable, type ForestTrip } from "./forestry.js";
import { stepMining, miningTargets, landOre, validMiningTrip, type MiningTrip } from "./mining.js";
import { depositAt, exposedDeposit, nearbyDeposit, buildingDeposit, expandReserves } from "./deposits.js";
import { ROCK_CLEARING_WORK } from "./construction.js";
import {planRemoval} from "./removal.js";
import {roadEdges,reconcileRoadLamps} from "./streetlights.js";
import { ROAD_TYPES, BRIDGE_TYPES, isRoadType, roadTypeAt, type RoadType, type RoadTypes } from "./roads.js";
import {
  BUILDINGS,
  RESOURCES,
  SIZE,
  STARTING_SIZE,
  STEP,
  AGENT_SPEED,
  FOOTPRINTS,
  dimensions,
  frontage,
  DECORATIONS,
  isBuilding,
  isDecoration,
  footprint,
  HOUSE_TIERS,
  houseCapacity,
  buildingName,
  buildingInvestment,
  type HouseTier,
  type BuildingKind,
  type Resource,
  type Tool,
} from "./catalog.js";
import { initialDecorations, type Decoration } from "./decorations.js";
import { daylight, DAY_TICKS, lengthenDays } from "./daylight.js";
import {
  buildingLevel,
  nextUpgrade,
  productionRate,
  outputCapacity,
} from "./upgrades.js";
import {
  MAX_COMMUTE,
  isLeisure,
  serviceCoverage,
  serviceOpen,
} from "./proximity.js";
import {
  DEPOSITS,
  INITIAL_RESERVE,
  deeperLayer,
  isExtractor,
} from "./deposits.js";
export { DEPOSITS } from "./deposits.js";
import { Traffic } from "./traffic.js";
import { canSupply } from "./logistics.js";
import { fisherySiteError } from "./shoreline.js";
import {
  stepFishing,
  landCatch,
  fishingRoute,
  fishingStatus,
  validFishingTrip,
  boatBerths,
  type FishingTrip,
} from "./fishing.js";
import {
  builderCapacity,
  constructionWork,
  type Construction,
} from "./construction.js";
import {
  terrainCell,
  groundHeight,
  planTerrain,
  validateTerrain,
  type TerrainMap,
  type TerrainCommand,
} from "./terrain.js";
export interface Point {
  x: number;
  y: number;
}
export interface Building extends Point {
  forestry?: ForestTrip[];
  mining?: MiningTrip[];
  deposit?: string;
  id: number;
  kind: BuildingKind;
  inventory: Partial<Record<Resource, number>>;
  progress: number;
  workers: number;
  connected: boolean;
  enabled: boolean;
  produced: number;
  rotation: 0 | 1 | 2 | 3;
  plot?: readonly [number, number];
  houseTier?: HouseTier;
  level?: HouseTier;
  construction?: Construction;
  fishing?: FishingTrip;
}
export interface Resident {
  id: number;
  name: string;
  home: number;
  job: number | null;
  leisure?: number;
}
export interface Agent {
  id: number;
  kind: "person" | "car" | "truck";
  path: Point[];
  segment: number;
  progress: number;
  resident: number | null;
  source: number;
  target: number;
  cargo: Resource | null;
  amount: number;
  returning: boolean;
  wait: number;
  move?: number;
  active?: boolean;
  trafficWait?: boolean;
  queuedTicks?: number;
  onsite?: number;
  parkSlot?:number;
}
export interface World {
  bridgeVersion?:1;
  version: 3;
  tick: number;
  revision: number;
  nextId: number;
  money: number;
  roads: string[];
  roadTypes?: RoadTypes;
  decorations: Decoration[];
  buildings: Building[];
  residents: Resident[];
  agents: Agent[];
  deposits: Record<string, number>;
  delivered: number;
  exported: number;
  food: number;
  history: string[];
  terrain?: TerrainMap;
  valleyVersion?: 2;
  depositDepths?: Record<string, number>;
  geologyVersion?: 2;
  clockVersion?: 2;
  clearedDeposits?: string[];
}
export type Command =
  | {type:"removeDecoration";id:number}
  | {type:"removeStroke";from:Point;to:Point}
  | { type: "roadStroke"; from: Point; to: Point; roadType?: RoadType }
  | TerrainCommand
  | { type: "undoTerrain" }
  | {
      type: "place";
      kind: Exclude<Tool, "inspect" | "bulldoze" | "terrain" | "move">;
      x: number;
      y: number;
      rotation?: 0 | 1 | 2 | 3;
    }
  | { type: "demolish"; x: number; y: number }
  | { type: "toggle"; id: number }
  | { type: "upgrade"; id: number }
  | { type: "deepen"; id: number }
  | { type: "move"; id: number; x: number; y: number; rotation?: 0 | 1 | 2 | 3 }
  | { type: "rotate"; id: number };
export interface CommandEnvelope {
  id: string;
  actorId: string;
  expectedRevision: number;
  command: Command;
}
export interface Result {
  ok: boolean;
  message: string;
  revision: number;
}
export interface BuildingAlert {
  kind:
    | "road"
    | "warehouse"
    | "paused"
    | "depleted"
    | "workers"
    | "output"
    | "input"
    | "leisure"
    | "construction";
  title: string;
  message: string;
}
const dirs = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
export const key = (p: Point) => `${p.x},${p.y}`;
export function terrain(
  x: number,
  y: number,
  map?: TerrainMap,
): "land" | "water" {
  return terrainCell(x, y, map).kind;
}
export const inside = (x: number, y: number) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < SIZE &&
  y < SIZE;
const NAMES = [
  "Ada",
  "Finn",
  "Mila",
  "Theo",
  "Nora",
  "Owen",
  "Iris",
  "Hugo",
  "Alma",
  "Leo",
  "Cleo",
  "Otis",
  "Elin",
  "Jules",
  "Luca",
  "Wren",
  "Emil",
  "Rosa",
  "Arlo",
  "Elsa",
  "Noel",
  "June",
  "Otto",
  "Maya",
];
export class Simulation {
  state: World;
  private traffic = new Traffic();
  private leisureByResident = new Map<number, Building[]>();
  private roadSet = new Set<string>();
  private processed = new Map<string, Result>();
  private terrainUndo?: {
    revision: number;
    map: TerrainMap;
    decorations: Decoration[];
    cost: number;
  };
  canUndoTerrain() {
    return this.terrainUndo?.revision === this.state.revision;
  }
  constructor(saved?: World) {
    this.state = saved
      ? structuredClone(saved)
      : {
          version: 3,
          valleyVersion: 2,
          geologyVersion: 2,
          clockVersion: 2,
          depositDepths: {},
          tick: 0,
          revision: 0,
          nextId: 1,
          money: 2400,
          roads: [],
          decorations: [],
          buildings: [],
          residents: [],
          agents: [],
          deposits: Object.fromEntries(
            Object.keys(DEPOSITS).map((k) => [k, INITIAL_RESERVE]),
          ),
          delivered: 0,
          exported: 0,
          food: 100,
          history: [],
        };
    if (!saved) {
      this.seed();
      for (const b of this.state.buildings) {
        b.plot = FOOTPRINTS[b.kind];
        const facing = [0, 1, 2, 3].find((r) =>
          frontage(b.kind, b.x, b.y, r, b.plot).some((p) =>
            this.state.roads.includes(key(p)),
          ),
        );
        if (facing !== undefined) b.rotation = facing as 0 | 1 | 2 | 3;
      }
    }
    if (!saved || !saved.decorations)
      this.state.decorations = initialDecorations(
        new Set(this.state.roads),
        (x, y) =>
          terrain(x, y, this.state.terrain) === "water" ||
          !!this.buildingAt(x, y) ||
          !!depositAt({ x, y }),
        () => this.state.nextId++,
      );
    expandValley(this.state);
    expandReserves(this.state);
    lengthenDays(this.state);
    if(this.state.bridgeVersion!==1){this.state.roadTypes??={};for(const k of this.state.roads){const [x,y]=k.split(",").map(Number);if(terrain(x,y,this.state.terrain)==="water"&&!this.state.roadTypes[k])this.state.roadTypes[k]="dirt";}this.state.bridgeVersion=1;}
    for(const b of this.state.buildings)if(isExtractor(b.kind))b.deposit=buildingDeposit(b);
    this.state.decorations=this.state.decorations.filter(d=>!d.natural||!depositAt(d));
    for(const d of this.state.decorations)if(d.kind==="fence"&&d.side===undefined)d.side=this.state.decorations.some(n=>n.kind==="fence"&&n.x===d.x&&Math.abs(n.y-d.y)===1)?0:1;
    for(const d of this.state.decorations)if(d.kind==="fence")Object.assign(d,canonicalFence(d));
    this.reconnect();
  }
  private seed() {
    const road = (x: number, y: number) => {
      if (!this.state.roads.includes(key({ x, y })))
        this.state.roads.push(key({ x, y }));
    };
    for (let x = 4; x <= 25; x++) road(x, 10);
    for (let x = 4; x <= 23; x++) road(x, 18);
    for (let y = 3; y <= 23; y++) {
      road(6, y);
      road(13, y);
      road(21, y);
    }
    const add = (kind: BuildingKind, x: number, y: number) => {
      this.state.buildings.push({
        id: this.state.nextId++,
        kind,
        x,
        y,
        inventory: {},
        progress: 0,
        workers: 0,
        connected: false,
        enabled: true,
        produced: 0,
        rotation: kind === "house" && x === 7 ? 2 : 0,
        ...(kind === "house" ? { houseTier: 1 as const } : {}),
      });
    };
    [
      [7, 3],
      [7, 5],
      [7, 7],
      [11, 3],
      [11, 5],
      [11, 7],
      [4, 4],
      [4, 6],
      [4, 8],
      [7, 11],
      [7, 13],
      [7, 15],
    ].forEach(([x, y]) => add("house", x, y));
    add("warehouse", 11, 11);
    add("park", 11, 15);
    add("park", 4, 13);
    add("farm", 14, 4);
    add("mill", 14, 7);
    add("bakery", 14, 11);
    add("forester", 14, 14);
    add("sawmill", 19, 11);
    add("workshop", 19, 14);
    add("quarry", 19, 4);
    add("mine", 19, 7);
    this.state.buildings.find((b) => b.kind === "warehouse")!.inventory = {
      bread: 45,
      wood: 60,
      stone: 45,
      metal: 25,
    };
    this.state.history = [
      "Your first settlers have arrived. Welcome to Pinehaven.",
    ];
  }
  get roads() {
    return this.roadSet;
  }
  buildingAt(x: number, y: number) {
    return this.state.buildings.find(
      (b) =>
        x >= b.x &&
        y >= b.y &&
        x < b.x + dimensions(b.kind, b.rotation, b.plot)[0] &&
        y < b.y + dimensions(b.kind, b.rotation, b.plot)[1],
    );
  }
  decorationAt(x: number, y: number) {
    return this.state.decorations.find((d) => d.x === x && d.y === y);
  }
  building(id: number) {
    return this.state.buildings.find((b) => b.id === id);
  }
  adjacent(p: Point) {
    const kind = (p as Partial<Building>).kind;
    if (kind) {
      const b = p as Building;
      return frontage(kind, b.x, b.y, b.rotation, b.plot).filter(
        (n) =>
          this.roadSet.has(key(n)) &&
          groundHeight(n.x, n.y, this.state.terrain) ===
            groundHeight(b.x, b.y, this.state.terrain),
      );
    }
    const cells = kind
      ? footprint(kind, p.x, p.y, (p as Building).rotation)
      : [p];
    const perimeter = new Map<string, Point>();
    for (const cell of cells)
      for (const d of dirs) {
        const n = { x: cell.x + d.x, y: cell.y + d.y };
        if (this.roadSet.has(key(n))) perimeter.set(key(n), n);
      }
    return [...perimeter.values()];
  }
  path(start: Point, end: Point, kind:Agent["kind"]="person"): Point[] | null {
    const allowed=(p:Point)=>kind==="person"||roadTypeAt(this.state.roadTypes,p)!=="pavement";
    if(!allowed(start)||!allowed(end))return null;
    if (!this.roadSet.has(key(start)) || !this.roadSet.has(key(end)))
      return null;
    const queue = [start],
      parents = new Map<string, Point | null>([[key(start), null]]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (key(p) === key(end)) {
        const out: Point[] = [];
        let cur: Point | null = p;
        while (cur) {
          out.push(cur);
          cur = parents.get(key(cur)) ?? null;
        }
        return out.reverse();
      }
      for (const d of dirs) {
        const n = { x: p.x + d.x, y: p.y + d.y },
          k = key(n);
        if (
          this.roadSet.has(k) && allowed(n) &&
          !parents.has(k) &&
          Math.abs(
            groundHeight(n.x, n.y, this.state.terrain) -
              groundHeight(p.x, p.y, this.state.terrain),
          ) <= 8
        ) {
          parents.set(k, p);
          queue.push(n);
        }
      }
    }
    return null;
  }
  route(a: Point, b: Point, kind:Agent["kind"]="person") {
    for (const from of this.adjacent(a))
      for (const to of this.adjacent(b)) {
        const p = this.path(from, to,kind);
        if (p) return p;
      }
    return null;
  }
  reconnect(preserveTravel = false) {
    const travellers = preserveTravel ? [...this.state.agents] : [];
    this.roadSet = new Set(this.state.roads);
    this.traffic.configure(this.roadSet, this.state.roadTypes);
    for(const a of travellers)if(a.kind==="car"&&a.path.slice(a.segment).some(p=>roadTypeAt(this.state.roadTypes,p)==="pavement"))a.kind="person";
    const warehouses = this.state.buildings.filter(
      (b) =>
        b.kind === "warehouse" &&
        (!b.construction || b.construction.upgradeLevel),
    );
    for (const b of this.state.buildings) {
      b.connected = warehouses.some((w) => !!this.route(b, w));
      b.workers = 0;
    }
    const homes = this.state.buildings.filter(
      (b) =>
        isHome(b.kind) && (!b.construction || b.construction.upgradeTo || b.construction.upgradeLevel),
    );
    this.state.residents = this.state.residents.filter((r) =>
      homes.some((h) => h.id === r.home),
    );
    for (const h of homes.filter((h) => h.connected)) {
      while (
        this.state.residents.filter((r) => r.home === h.id).length <
        houseCapacity(h)
      ) {
        const id = this.state.nextId++;
        this.state.residents.push({
          id,
          home: h.id,
          job: null,
          name: NAMES[id % NAMES.length],
        });
      }
    }
    const jobs = this.state.buildings.filter(
      (b) =>
        !b.construction &&
        b.connected &&
        b.enabled &&
        BUILDINGS[b.kind].jobs > 0,
    );
    for (const r of this.state.residents) {
      const h = this.building(r.home)!;
      r.leisure ??= 60;
      const nearby = jobs
        .map((b) => ({ b, path: this.route(h, b) }))
        .filter((j) => j.path && j.path.length - 1 <= MAX_COMMUTE)
        .sort((a, b) => a.path!.length - b.path!.length || a.b.id - b.b.id)
        .map((j) => j.b);
      const previous = nearby.find(
        (b) =>
          b.id === r.job &&
          b.workers < BUILDINGS[b.kind].jobs &&
          this.route(h, b),
      );
      const job =
        (preserveTravel ? previous : undefined) ??
        nearby.find(
          (b) => b.workers < BUILDINGS[b.kind].jobs && this.route(h, b),
        );
      r.job = job?.id ?? null;
      if (job) job.workers++;
    }
    const sites = this.state.buildings.filter(
      (b) => b.construction && b.connected && b.enabled,
    );
    for (const r of this.state.residents.filter((r) => r.job === null)) {
      const home = this.building(r.home)!;
      const site = sites.find(
        (b) => b.workers < builderCapacity(b) && this.route(home, b),
      );
      if (site) {
        r.job = site.id;
        site.workers++;
      }
    }
    this.leisureByResident.clear();
    for (const service of this.state.buildings.filter(
      (b) =>
        isLeisure(b.kind) &&
        !b.construction &&
        b.enabled &&
        b.connected &&
        b.workers >= BUILDINGS[b.kind].jobs,
    ))
      for (const h of serviceCoverage(this, service).homes)
        for (const r of this.state.residents
          .filter((r) => r.home === h.home.id)
          .slice(0, h.served)) {
          const choices = this.leisureByResident.get(r.id) ?? [];
          choices.push(service);
          this.leisureByResident.set(r.id, choices);
        }
    this.state.agents = this.state.agents.filter((a) => {
      if (a.kind !== "truck") return false;
      const sourceBuilding = this.building(a.source),
        targetBuilding = this.building(a.target);
      if (
        preserveTravel &&
        targetBuilding?.connected &&
        this.retarget(a, targetBuilding)
      )
        return true;
      const valid =
        sourceBuilding?.connected &&
        targetBuilding?.connected &&
        this.adjacent(sourceBuilding).some((p) => key(p) === key(a.path[0])) &&
        this.adjacent(targetBuilding).some(
          (p) => key(p) === key(a.path[a.path.length - 1]),
        ) &&
        a.path.slice(a.segment).every((p) => this.roadSet.has(key(p))&&roadTypeAt(this.state.roadTypes,p)!=="pavement");
      if (!valid && a.cargo) {
        const source = this.building(a.source) ?? warehouses[0];
        if (source)
          source.inventory[a.cargo] =
            (source.inventory[a.cargo] ?? 0) + a.amount;
      }
      return !!valid;
    });
    for (const r of this.state.residents) {
      const home = this.building(r.home)!,
        retained = travellers.find(
          (a) =>
            a.resident === r.id &&
            a.source === home.id &&
            this.building(a.target)?.connected,
        ),
        destination =
          (retained && this.building(retained.target)) ??
          this.residentDestination(r) ??
          this.leisureByResident.get(r.id)?.[0] ??
          warehouses.find((w) => this.route(home, w));
      if (!destination) continue;
      const p = this.route(home, destination);
      const existing = travellers.find(
        (a) =>
          a.resident === r.id &&
          a.source === home.id &&
          a.target === destination.id,
      );
      if (
        existing &&
        this.retarget(existing, existing.returning ? home : destination)
      ) {
        if (existing.onsite && !destination.construction && destination.kind !== "forester" && !isExtractor(destination.kind)) {
          delete existing.onsite;
          existing.wait = 0;
          existing.path = this.route(destination, home,existing.kind) ?? existing.path;
          existing.segment = 0;
          existing.progress = 0;
          existing.returning = true;
        }
        this.state.agents.push(existing);
        continue;
      }
      if (p)
        this.state.agents.push({
          id: this.state.nextId++,
          kind: destination.construction || destination.kind === "forester" || isExtractor(destination.kind)
            ? "person"
            : r.id % 4 === 0 && p.every(tile=>roadTypeAt(this.state.roadTypes,tile)!=="pavement")
              ? "car"
              : "person",
          path: p,
          segment: 0,
          progress: 0,
          resident: r.id,
          source: home.id,
          target: destination.id,
          cargo: null,
          amount: 0,
          returning: false,
          wait: (r.id % 12) * 0.45,
        });
    }
    if (!preserveTravel) for (const a of this.state.agents) a.active = false;
    this.traffic.plan(this.state.agents);
  }
  private residentDestination(r: Resident) {
    const hour = daylight(this.state.tick).hour;
    const leisure = (this.leisureByResident.get(r.id) ?? []).filter((b) =>
      serviceOpen(b.kind, hour)&&(b.kind!=="park"||this.state.agents.filter(a=>a.target===b.id&&a.parkSlot!==undefined&&a.returning&&a.wait>0).length<4),
    );
    leisure.sort(
      (a, b) =>
        (this.route(this.building(r.home)!, a)?.length ?? Infinity) -
        (this.route(this.building(r.home)!, b)?.length ?? Infinity),
    );
    const job = this.building(r.job ?? -1);
    if ((r.leisure ?? 60) < 90 && (!job || hour >= 17 || hour < 6))
      return leisure[0] ?? job;
    return job ?? ((r.leisure ?? 60) < 90 ? leisure[0] : undefined);
  }
  leisure() {
    return this.state.residents.length
      ? Math.round(
          this.state.residents.reduce((sum, r) => sum + (r.leisure ?? 60), 0) /
            this.state.residents.length,
        )
      : 100;
  }
  private retarget(a: Agent, destination: Building) {
    const entrances = this.adjacent(destination);
    const remaining=a.path.slice(a.segment);
    const valid=remaining.every(p=>this.roadSet.has(key(p))&&(a.kind==="person"||roadTypeAt(this.state.roadTypes,p)!=="pavement"));
    if(!valid)return false;
    if (entrances.some((p) => key(p) === key(a.path[a.path.length - 1])))
      return true;
    const next = Math.min(a.segment + 1, a.path.length - 1);
    for (const entrance of entrances) {
      const route = this.path(a.path[next], entrance,a.kind);
      if (!route) continue;
      // Keep the current segment intact so a moving vehicle never teleports.
      a.path = [...a.path.slice(0, next), ...route];
      return true;
    }
    return false;
  }
  relocationPlot(
    b: Building,
    rotation = b.rotation,
  ): readonly [number, number] {
    const [w, h] = dimensions(b.kind, b.rotation, b.plot);
    return (rotation - b.rotation) % 2 ? [h, w] : [w, h];
  }
  canMove(
    id: number,
    x: number,
    y: number,
    rotation?: 0 | 1 | 2 | 3,
  ): string | null {
    const b = this.building(id);
    if (!b) return "Select a building to move.";
    if (b.construction?.deeperTo !== undefined && (x !== b.x || y !== b.y))
      return "Finish digging this deposit before moving the building.";
    const facing = rotation ?? b.rotation;
    if (
      ![0, 1, 2, 3].includes(facing) ||
      !Number.isInteger(x) ||
      !Number.isInteger(y)
    )
      return "Choose a valid tile and direction.";
    if (b.kind === "fishery") {
      const error = fisherySiteError(x, y, facing, this.state.terrain);
      if (error) return error;
    }
    for (const p of footprint(
      b.kind,
      x,
      y,
      facing,
      this.relocationPlot(b, facing),
    )) {
      if (
        !inside(p.x, p.y) ||
        (b.kind !== "fishery" &&
          terrain(p.x, p.y, this.state.terrain) !== "land")
      )
        return "The whole footprint needs dry land inside the valley.";
      if (
        groundHeight(p.x, p.y, this.state.terrain) !==
        groundHeight(x, y, this.state.terrain)
      )
        return "Level the whole footprint before moving here.";
      if (
        this.roads.has(key(p)) ||
        (this.buildingAt(p.x, p.y)?.id ?? id) !== id
      )
        return "The footprint overlaps a road or another building.";
      if(exposedDeposit(this.state,p)&&!footprint(b.kind,b.x,b.y,b.rotation,b.plot).some(q=>q.x===p.x&&q.y===p.y))return "Builders must clear these surface rocks before an existing building can move here.";
      if (
        this.state.buildings.some(
          (other) =>
            other.id !== id &&
            other.fishing?.path.some((q) => q.x === p.x && q.y === p.y),
        )
      )
        return "A fishing boat is using this water. Let it return before moving here.";
    }
    if (
      (b.kind === "quarry" || b.kind === "mine") &&
      !nearbyDeposit({...b,x,y,rotation:facing,plot:this.relocationPlot(b,facing)})
    )
      return "Move within 8 tiles of a matching deposit, keeping the building beside the rocks.";
    return null;
  }
  canPlace(
    kind: Exclude<Tool, "inspect" | "bulldoze" | "terrain" | "move">,
    x: number,
    y: number,
    rotation = 0,
  ): string | null {
    if (!inside(x, y)) return "Choose a tile inside the valley.";
    if(kind==="fence"){
      if(!Number.isInteger(rotation)||rotation<0||rotation>3)return "Choose one of the four tile edges.";
      const side=rotation%4,q=fenceNeighbour({x,y},side);
      if(!inside(q.x,q.y)||terrain(x,y,this.state.terrain)==="water"||terrain(q.x,q.y,this.state.terrain)==="water")return "Choose an edge on dry land.";
      if(groundHeight(x,y,this.state.terrain)!==groundHeight(q.x,q.y,this.state.terrain))return "Level both sides of the fence first.";
      if(this.state.decorations.some(d=>d.kind==="fence"&&fenceKey(d,d.side??1)===fenceKey({x,y},side)))return "This edge already has a fence.";
      const a=this.buildingAt(x,y),b=this.buildingAt(q.x,q.y);
      if(a&&b&&a.id===b.id)return "Use the outside edge of the building plot.";
      if(this.roadSet.has(key({x,y}))&&this.roadSet.has(key(q)))return "Keep the route open. Place fences along its outside edge.";
      if((a&&frontage(a.kind,a.x,a.y,a.rotation,a.plot).some(p=>key(p)===key(q)))||(b&&frontage(b.kind,b.x,b.y,b.rotation,b.plot).some(p=>p.x===x&&p.y===y)))return "Keep building entrances clear. Choose another side.";
      return this.state.money<DECORATIONS.fence.cost?"Not enough gold yet.":null;
    }
    const roadLamp=kind==="streetlight"&&this.roadSet.has(key({x,y}));
    if(roadLamp) {
      if(!roadEdges(this.roadSet,{x,y}).includes(rotation))return "Choose an outside curb, away from the crossing.";
      if(this.state.decorations.some(d=>d.x===x&&d.y===y&&d.edge===rotation))return "This curb already has a streetlight.";
    }
    if (kind === "fishery") {
      const error = fisherySiteError(x, y, rotation, this.state.terrain);
      if (error) return error;
    }
    if (kind === "bridge" && terrain(x, y, this.state.terrain) !== "water")
      return "Place bridges over water. Use roads on dry land.";
    const cells = isBuilding(kind)
      ? footprint(kind, x, y, rotation)
      : [{ x, y }];
    if (
      this.state.buildings.some((b) =>
        b.fishing?.path.some((p) =>
          cells.some((c) => c.x === p.x && c.y === p.y),
        ),
      )
    )
      return "A fishing boat is using this water. Let it return before building here.";
    if (
      isBuilding(kind) &&
      cells.some(
        (p) =>
          groundHeight(p.x, p.y, this.state.terrain) !==
          groundHeight(x, y, this.state.terrain),
      )
    )
      return "Level the whole footprint before building here.";
    if (
      (kind === "road" || kind === "bridge") &&
      dirs.some((d) => {
        const nx = x + d.x,
          ny = y + d.y;
        return (
          this.roads.has(key({ x: nx, y: ny })) &&
          (Math.abs(
            groundHeight(x, y, this.state.terrain) -
              groundHeight(nx, ny, this.state.terrain),
          ) > 8 ||
            ((terrain(x, y, this.state.terrain) === "water" ||
              terrain(nx, ny, this.state.terrain) === "water") &&
              groundHeight(x, y, this.state.terrain) !==
                groundHeight(nx, ny, this.state.terrain)))
        );
      })
    )
      return "Roads can climb one height step at a time. Bridge banks must be at water level.";
    for (const p of cells) {
      if (!inside(p.x, p.y))
        return "The whole building must fit inside the valley.";
      if (this.buildingAt(p.x, p.y) || (this.roadSet.has(key(p))&&!roadLamp))
        return "The building footprint overlaps a road or another building.";
      if(exposedDeposit(this.state,p)&&!isBuilding(kind)&&!roadLamp)return "Surface rocks need to be cleared by builders before this tile can be used.";
      if(exposedDeposit(this.state,p)&&isExtractor(kind))return "Place the workplace beside the rocks, within its mining area.";
      if (
        terrain(p.x, p.y, this.state.terrain) === "water" &&
        kind !== "road" &&
        kind !== "bridge" &&
        kind !== "fishery"
        && !roadLamp
      )
        return "The whole building needs dry land. Roads can form bridges.";
    }
    if (
      isDecoration(kind) &&
      !roadLamp && (this.state.decorations.some(d=>d.x===x&&d.y===y&&d.side===undefined) || exposedDeposit(this.state,{x,y}))
    )
      return "Choose an empty land tile for this decoration.";
    if (
      (kind === "quarry" || kind === "mine") &&
      !nearbyDeposit({kind,x,y,rotation})
    )
      return `Place this beside a ${kind === "quarry" ? "stone" : "metal"} deposit within 8 tiles.`;
    const cost =
      kind === "road" || kind === "bridge"
        ? terrain(x, y, this.state.terrain) === "water"
          ? 35
          : 12
        : isDecoration(kind)
          ? DECORATIONS[kind].cost
          : BUILDINGS[kind].cost;
    if (this.state.money < cost) return "Not enough gold yet.";
    if (isBuilding(kind))
      for (const [r, n] of Object.entries(BUILDINGS[kind].materials ?? {})) {
        if (this.stored(r as Resource) < n)
          return `Need ${n} ${r} in warehouses.`;
      }
    return null;
  }
  stored(resource: Resource) {
    return this.state.buildings
      .filter((b) => b.kind === "warehouse")
      .reduce((n, b) => n + (b.inventory[resource] ?? 0), 0);
  }
  private consume(resource: Resource, amount: number) {
    for (const b of this.state.buildings.filter(
      (b) => b.kind === "warehouse",
    )) {
      const n = Math.min(amount, b.inventory[resource] ?? 0);
      b.inventory[resource] = (b.inventory[resource] ?? 0) - n;
      amount -= n;
    }
  }
  canUpgrade(id: number): string | null {
    const b = this.building(id);
    if (!b) return "Select a building to upgrade.";
    if (b.construction) return "Finish the current construction first.";
    if (buildingLevel(b) >= 3)
      return "This building is already at the highest tier.";
    if (!b.connected)
      return "Connect the front entrance to a warehouse road before upgrading.";
    const next = nextUpgrade(b)!;
    if (this.state.money < next.cost)
      return `Need ${next.cost} gold to upgrade.`;
    for (const [r, n] of Object.entries(next.materials)) {
      if (this.stored(r as Resource) < n)
        return `Need ${n} ${r} in warehouses to upgrade.`;
    }
    return null;
  }
  canDeepen(id: number): string | null {
    const b = this.building(id);
    if (!b || !isExtractor(b.kind))
      return "Select a quarry or mine to dig deeper.";
    if (b.construction) return "Finish the current construction first.";
    if (!buildingDeposit(b))
      return "This extractor needs its matching deposit.";
    if(this.state.buildings.some(other=>other.id!==b.id&&other.construction?.deeperTo!==undefined&&buildingDeposit(other)===buildingDeposit(b)))return "Another crew is already digging deeper at this deposit.";
    if (!b.connected)
      return "Connect the entrance to a warehouse road before digging deeper.";
    const next = deeperLayer(this.state.depositDepths?.[buildingDeposit(b)!] ?? 0);
    if (this.state.money < next.cost)
      return `Need ${next.cost} gold to dig deeper.`;
    for (const [r, n] of Object.entries(next.materials))
      if (this.stored(r as Resource) < n)
        return `Need ${n} ${r} in warehouses to dig deeper.`;
    return null;
  }
  execute(envelope: CommandEnvelope): Result {
    const prior = this.processed.get(envelope.id);
    if (prior) return prior;
    if (envelope.expectedRevision !== this.state.revision)
      return {
        ok: false,
        message: "The town changed. Please try again.",
        revision: this.state.revision,
      };
    let c = envelope.command;
    if (
      !c ||
      ![
        "place",
        "roadStroke",
        "removeStroke",
        "removeDecoration",
        "demolish",
        "toggle",
        "rotate",
        "upgrade",
        "deepen",
        "move",
        "terrain",
        "undoTerrain",
      ].includes(c.type)
    )
      return {
        ok: false,
        message: "Unknown action.",
        revision: this.state.revision,
      };
    if(c.type==="place"&&(c.kind==="road"||c.kind==="bridge")){
      const water=terrain(c.x,c.y,this.state.terrain)==="water";
      if(c.kind==="bridge"&&!water)return{ok:false,message:"Bridges need water. Choose a road on land.",revision:this.state.revision};
      c={type:"roadStroke",from:{x:c.x,y:c.y},to:{x:c.x,y:c.y},roadType:water?"dirt":"stone"};
    }
    let message = "",
      networkChanged = true;
    if(c.type==="removeDecoration") {
      const d=this.state.decorations.find(d=>d.id===c.id);
      if(!d)return {ok:false,message:"This decoration is already gone.",revision:this.state.revision};
      this.state.decorations=this.state.decorations.filter(other=>other.id!==d.id);
      this.state.money+=d.natural?0:Math.floor(DECORATIONS[d.kind].cost/2);
      networkChanged=false;message="Decoration removed.";
    } else if(c.type==="removeStroke") {
      const plan=planRemoval(this,c.from,c.to);
      if(plan.error)return {ok:false,message:plan.error,revision:this.state.revision};
      networkChanged=plan.buildings.size>0||plan.roads.size>0;
      const warehouse=this.state.buildings.find(b=>b.kind==="warehouse"&&!plan.buildings.has(b.id))!;
      for(const b of this.state.buildings.filter(b=>plan.buildings.has(b.id))) {
        landCatch(b);landTimber(b);landOre(b);
        for(const r of RESOURCES)warehouse.inventory[r]=(warehouse.inventory[r]??0)+(b.inventory[r]??0);
        this.state.money+=Math.floor(buildingInvestment(b)/2);
      }
      this.state.buildings=this.state.buildings.filter(b=>!plan.buildings.has(b.id));
      for(const k of plan.roads) {
        const [x,y]=k.split(",").map(Number);
        this.state.money+=terrain(x,y,this.state.terrain)==="water"?Math.floor(BRIDGE_TYPES[roadTypeAt(this.state.roadTypes,{x,y})].cost/2):Math.floor(ROAD_TYPES[roadTypeAt(this.state.roadTypes,{x,y})].cost/2);
        if(this.state.roadTypes)delete this.state.roadTypes[k];
      }
      this.state.roads=this.state.roads.filter(k=>!plan.roads.has(k));
      this.state.decorations=this.state.decorations.filter(d=>{
        if(!plan.decorations.has(d.id)&&!(d.edge!==undefined&&plan.roads.has(key(d))))return true;
        this.state.money+=d.natural?0:Math.floor(DECORATIONS[d.kind].cost/2);return false;
      });
      message=`Removed ${plan.buildings.size} buildings, ${plan.roads.size} road tiles and ${plan.decorations.size} decorations. Stock recovered; half the build cost returned.`;
    } else if (c.type === "roadStroke") {
      const roadType = c.roadType ?? "stone";
      const plan = planRoad(this, c.from, c.to, roadType);
      if (plan.error) return { ok: false, message: plan.error, revision: this.state.revision };
      const added = new Set(plan.additions.map(key));
      this.state.roads.push(...added);
      this.state.roadTypes ??= {};
      for (const p of [...plan.additions, ...plan.upgrades]) {
        if (roadType === "stone")
          delete this.state.roadTypes[key(p)];
        else this.state.roadTypes[key(p)] = roadType;
      }
      this.state.decorations = this.state.decorations.filter((d) => d.side!==undefined?!(this.state.roads.includes(key(d))&&this.state.roads.includes(key(fenceNeighbour(d,d.side)))):!added.has(key(d)));
      this.state.money -= plan.cost;
      for(const [r,n] of Object.entries(plan.materials))this.consume(r as Resource,n);
      message = `${ROAD_TYPES[roadType].name} roads · ${plan.additions.length} new tiles${plan.upgrades.length ? ` · ${plan.upgrades.length} upgraded` : ""}${plan.bridges ? ` · ${plan.bridges} bridge tiles` : ""} · ${plan.cost} gold.`;
    } else if (c.type === "terrain") {
      const plan = planTerrain(this.state, c);
      if (plan.error)
        return {
          ok: false,
          message: plan.error,
          revision: this.state.revision,
        };
      this.terrainUndo = {
        revision: this.state.revision + 1,
        map: structuredClone(this.state.terrain ?? {}),
        decorations: structuredClone(this.state.decorations),
        cost: plan.cost,
      };
      this.state.terrain ??= {};
      for (const cell of plan.changes)
        this.state.terrain[key(cell)] = {
          kind: cell.kind,
          height: cell.height,
        };
      this.state.decorations = this.state.decorations.filter(
        (d) =>
          !plan.changes.some(
            (p) => p.kind === "water" && p.x === d.x && p.y === d.y,
          ),
      );
      this.state.money -= plan.cost;
      message = `Terrain reshaped · ${plan.cost} gold.`;
      networkChanged = false;
    } else if (c.type === "undoTerrain") {
      if (!this.canUndoTerrain())
        return {
          ok: false,
          message: "Only the latest terrain edit can be undone.",
          revision: this.state.revision,
        };
      const undo = this.terrainUndo!;
      this.state.terrain = undo.map;
      this.state.decorations = undo.decorations;
      this.state.money += undo.cost;
      this.terrainUndo = undefined;
      message = "Terrain edit undone. Gold returned.";
      networkChanged = false;
    } else if (c.type === "place") {
      if (c.rotation !== undefined && ![0, 1, 2, 3].includes(c.rotation))
        return {
          ok: false,
          message: "Invalid rotation.",
          revision: this.state.revision,
        };
      if (
        c.kind !== "road" &&
        c.kind !== "bridge" &&
        !isBuilding(c.kind) &&
        !isDecoration(c.kind)
      )
        return {
          ok: false,
          message: "Unknown building.",
          revision: this.state.revision,
        };
      const error = this.canPlace(c.kind, c.x, c.y, c.rotation);
      if (error)
        return { ok: false, message: error, revision: this.state.revision };
      const cost =
        c.kind === "road" || c.kind === "bridge"
          ? terrain(c.x, c.y, this.state.terrain) === "water"
            ? 35
            : 12
          : isDecoration(c.kind)
            ? DECORATIONS[c.kind].cost
            : BUILDINGS[c.kind].cost;
      this.state.money -= cost;
      if (isBuilding(c.kind))
        for (const [r, n] of Object.entries(BUILDINGS[c.kind].materials ?? {}))
          this.consume(r as Resource, n);
      const cells = isBuilding(c.kind)
        ? footprint(c.kind, c.x, c.y, c.rotation)
        : [c];
      if(c.kind!=="fence"&&!(c.kind==="streetlight"&&this.roadSet.has(key(c))))this.state.decorations = this.state.decorations.filter(
        (d) => d.side!==undefined?![d,fenceNeighbour(d,d.side)].every(q=>cells.some(p=>p.x===q.x&&p.y===q.y)):!cells.some((p) => p.x === d.x && p.y === d.y),
      );
      if (c.kind === "road" || c.kind === "bridge")
        this.state.roads.push(key(c));
      else if (isDecoration(c.kind)) {
        this.state.decorations.push({
          id: this.state.nextId++,
          kind: c.kind,
          x: c.x,
          y: c.y,
          natural: false,
          ...(c.kind==="streetlight"&&this.roadSet.has(key(c))?{edge:c.rotation??0}:{}),
          ...(c.kind==="fence"?canonicalFence({x:c.x,y:c.y,side:c.rotation??0}):{}),
        });
        networkChanged = false;
      } else
        this.state.buildings.push({
          id: this.state.nextId++,
          kind: c.kind,
          x: c.x,
          y: c.y,
          inventory: {},
          progress: 0,
          workers: 0,
          connected: false,
          enabled: true,
          produced: 0,
          rotation: c.rotation ?? 0,
          plot: dimensions(c.kind, c.rotation),
          ...(c.kind === "house" ? { houseTier: 1 as const } : {}),
          ...(isExtractor(c.kind)?{deposit:nearbyDeposit({kind:c.kind,x:c.x,y:c.y,rotation:c.rotation??0})}:{}),
          construction: (()=>{
            const tiles=footprint(c.kind,c.x,c.y,c.rotation??0).filter(p=>exposedDeposit(this.state,p));
            return {required:constructionWork(c.kind)+tiles.length*ROCK_CLEARING_WORK,completed:0,...(tiles.length?{clearance:{tiles,work:0}}:{})};
          })(),
        });
      message =
        c.kind === "road" || c.kind === "bridge"
          ? terrain(c.x, c.y, this.state.terrain) === "water"
            ? "Bridge built. Connect both ends to roads."
            : "Road laid."
          : isDecoration(c.kind)
            ? `${DECORATIONS[c.kind].name} placed.`
            : `${BUILDINGS[c.kind].name} construction started. Available residents will build it.`;
    } else if (c.type === "demolish") {
      const b = this.buildingAt(c.x, c.y),
        decoration = this.decorationAt(c.x, c.y);
      if (
        b?.kind === "warehouse" &&
        this.state.buildings.filter((b) => b.kind === "warehouse").length === 1
      )
        return {
          ok: false,
          message: "Keep at least one warehouse in your town.",
          revision: this.state.revision,
        };
      if (b) {
        landCatch(b);
        landTimber(b);
        landOre(b);
        const depot = this.state.buildings.find(
          (w) => w.kind === "warehouse" && w.id !== b.id,
        );
        for (const resource of RESOURCES) {
          if (depot)
            depot.inventory[resource] =
              (depot.inventory[resource] ?? 0) + (b.inventory[resource] ?? 0);
        }
        this.state.buildings = this.state.buildings.filter(
          (x) => x.id !== b.id,
        );
        this.state.money += Math.floor(buildingInvestment(b) / 2);
      } else if (this.roadSet.has(key(c))) {
        this.state.decorations=this.state.decorations.filter(d=>{if(d.edge===undefined||key(d)!==key(c))return true;this.state.money+=Math.floor(DECORATIONS[d.kind].cost/2);return false;});
        this.state.roads = this.state.roads.filter((k) => k !== key(c));
        this.state.money +=
          terrain(c.x, c.y, this.state.terrain) === "water" ? Math.floor(BRIDGE_TYPES[roadTypeAt(this.state.roadTypes,c)].cost/2) : Math.floor(ROAD_TYPES[roadTypeAt(this.state.roadTypes, c)].cost / 2);
        if (this.state.roadTypes) delete this.state.roadTypes[key(c)];
      } else if (decoration) {
        this.state.decorations = this.state.decorations.filter(
          (d) => d.id !== decoration.id,
        );
        this.state.money += decoration.natural
          ? 0
          : Math.floor(DECORATIONS[decoration.kind].cost / 2);
        networkChanged = false;
      } else
        return {
          ok: false,
          message: "There is nothing to remove here.",
          revision: this.state.revision,
        };
      message = decoration?.natural
        ? "Decoration removed."
        : "Removed. Half the build cost returned.";
    } else if (c.type === "move") {
      const error = this.canMove(c.id, c.x, c.y, c.rotation);
      if (error)
        return { ok: false, message: error, revision: this.state.revision };
      const b = this.building(c.id)!;
      landCatch(b);
      landTimber(b);
      landOre(b);
      b.plot = this.relocationPlot(b, c.rotation ?? b.rotation);
      b.x = c.x;
      b.y = c.y;
      if(isExtractor(b.kind))b.deposit=nearbyDeposit({...b,rotation:c.rotation??b.rotation});
      b.rotation = c.rotation ?? b.rotation;
      const cells = footprint(b.kind, b.x, b.y, b.rotation, b.plot);
      this.state.decorations = this.state.decorations.filter(
        (d) => d.side!==undefined?![d,fenceNeighbour(d,d.side)].every(q=>cells.some(p=>p.x===q.x&&p.y===q.y)):!cells.some((p) => p.x === d.x && p.y === d.y),
      );
      message = `${buildingName(b)} moved. Stock and progress preserved.`;
    } else if (c.type === "rotate") {
      const b = this.building(c.id);
      if (!b)
        return {
          ok: false,
          message: "Select a building to rotate.",
          revision: this.state.revision,
        };
      const rotation = ((b.rotation + 1) % 4) as 0 | 1 | 2 | 3;
      const cells = footprint(b.kind, b.x, b.y, rotation);
      if (
        (b.kind === "fishery" &&
          fisherySiteError(b.x, b.y, rotation, this.state.terrain)) ||
        cells.some(
          (p) =>
            !inside(p.x, p.y) ||
            groundHeight(p.x, p.y, this.state.terrain) !==
              groundHeight(b.x, b.y, this.state.terrain) ||
            (b.kind !== "fishery" &&
              terrain(p.x, p.y, this.state.terrain) === "water") ||
            this.roads.has(key(p)) ||
            this.state.buildings.some(
              (other) =>
                other.id !== b.id &&
                footprint(
                  other.kind,
                  other.x,
                  other.y,
                  other.rotation,
                  other.plot,
                ).some((q) => p.x === q.x && p.y === q.y),
            ),
        )
      )
        return {
          ok: false,
          message: "The rotated footprint needs more clear land.",
          revision: this.state.revision,
        };
      b.rotation = rotation;
      b.plot = dimensions(b.kind, rotation);
      this.state.decorations = this.state.decorations.filter(
        (d) => d.side!==undefined?![d,fenceNeighbour(d,d.side)].every(q=>cells.some(p=>p.x===q.x&&p.y===q.y)):!cells.some((p) => p.x === d.x && p.y === d.y),
      );
      message = `${buildingName(b)} rotated.`;
    } else if (c.type === "deepen") {
      const error = this.canDeepen(c.id);
      if (error)
        return { ok: false, message: error, revision: this.state.revision };
      const b = this.building(c.id)!;
      const next = deeperLayer(this.state.depositDepths?.[buildingDeposit(b)!] ?? 0);
      landOre(b);
      this.state.money -= next.cost;
      for (const [r, n] of Object.entries(next.materials))
        this.consume(r as Resource, n);
      b.construction = {
        required: next.labour,
        completed: 0,
        deeperTo: next.depth,
      };
      b.enabled = true;
      message = `Digging to layer ${next.depth + 1}. Builders will unlock ${next.reserve.toLocaleString()} more resources here.`;
    } else if (c.type === "upgrade") {
      const error = this.canUpgrade(c.id);
      if (error)
        return { ok: false, message: error, revision: this.state.revision };
      const b = this.building(c.id)!;
      const next = nextUpgrade(b)!,
        tier = next.level;
      landTimber(b);
      landOre(b);
      this.state.money -= next.cost;
      for (const [r, n] of Object.entries(next.materials))
        this.consume(r as Resource, n);
      b.construction = {
        required: next.labour,
        completed: 0,
        ...(b.kind === "house" ? { upgradeTo: tier } : { upgradeLevel: tier }),
      };
      message = `Upgrading to ${next.name.toLowerCase()}. ${isHome(b.kind) ? "Residents keep their home" : "Stored inventory stays here"} while builders work.`;
    } else if (c.type === "toggle") {
      const b = this.building(c.id);
      if (!b)
        return {
          ok: false,
          message: "Building no longer exists.",
          revision: this.state.revision,
        };
      b.enabled = !b.enabled;
      message = b.enabled ? "Production resumed." : "Production paused.";
    }
    if(networkChanged){
      const before=this.state.decorations.length;
      this.state.decorations=reconcileRoadLamps(this.state.decorations,new Set(this.state.roads));
      const removed=before-this.state.decorations.length;
      if(removed){this.state.money+=removed*DECORATIONS.streetlight.cost;message+=` ${removed} streetlights returned at full cost because their curbs became traffic lanes.`;}
    }
    this.state.revision++;
    if (networkChanged)
      this.reconnect(["move", "place", "roadStroke", "upgrade", "deepen"].includes(c.type));
    if (c.type === "move" && !this.building(c.id)?.connected)
      message +=
        " Connect the front entrance to the warehouse road network to resume work.";
    this.state.history.unshift(message);
    this.state.history = this.state.history.slice(0, 20);
    const result = { ok: true, message, revision: this.state.revision };
    this.processed.set(envelope.id, result);
    if (this.processed.size > 1000)
      this.processed.delete(this.processed.keys().next().value!);
    return result;
  }
  step() {
    this.state.tick++;
    const day = daylight(this.state.tick);
    let completed = false;
    for (const b of this.state.buildings) {
      if (!b.construction || !b.connected || !b.enabled) continue;
      const crew = this.state.agents.filter(
        (a) =>
          a.onsite === b.id &&
          this.state.residents.some(
            (r) => r.id === a.resident && r.job === b.id,
          ),
      ).length;
      b.construction.completed = Math.min(
        b.construction.required,
        b.construction.completed + crew * STEP * day.workRate,
      );
      const clearance=b.construction.clearance;
      if(clearance) {
        clearance.work+=crew*STEP*day.workRate;
        while(clearance.tiles.length&&clearance.work>=ROCK_CLEARING_WORK) {
          const tile=key(clearance.tiles.shift()!);
          this.state.clearedDeposits??=[];
          if(!this.state.clearedDeposits.includes(tile))this.state.clearedDeposits.push(tile);
          clearance.work-=ROCK_CLEARING_WORK;
          this.state.revision++;
        }
        if(!clearance.tiles.length){delete b.construction.clearance;this.state.revision++;}
      }
      if (b.construction.completed >= b.construction.required) {
        if (b.construction.upgradeTo) b.houseTier = b.construction.upgradeTo;
        if (b.construction.upgradeLevel) b.level = b.construction.upgradeLevel;
        if (b.construction.deeperTo !== undefined) {
          const depth = b.construction.deeperTo;
          this.state.depositDepths ??= {};
          this.state.depositDepths[buildingDeposit(b)!] = depth;
          this.state.deposits[buildingDeposit(b)!] += deeperLayer(depth - 1).reserve;
        }
        delete b.construction;
        this.state.history.unshift(`${buildingName(b)} construction finished.`);
        completed = true;
      }
    }
    if (completed) {
      this.state.history = this.state.history.slice(0, 20);
      this.state.revision++;
      this.reconnect(true);
    }
    for (const b of this.state.buildings) {
      const recipe = BUILDINGS[b.kind].recipe;
      if (b.kind === "forester") { stepForestry(this,b); continue; }
      if (isExtractor(b.kind)) { stepMining(this,b); continue; }
      if (b.kind === "fishery") {
        stepFishing(this, b);
        continue;
      }
      if (
        b.construction ||
        !recipe ||
        !b.enabled ||
        !b.connected ||
        b.workers < BUILDINGS[b.kind].jobs
      )
        continue;
      if ((b.inventory[recipe.output] ?? 0) >= outputCapacity(b)) continue;
      if (
        recipe.input &&
        (b.inventory[recipe.input] ?? 0) < (recipe.amount ?? 0)
      )
        continue;
      b.progress += STEP * day.workRate * productionRate(b);
      if (b.progress >= recipe.seconds) {
        b.progress -= recipe.seconds;
        if (recipe.input) b.inventory[recipe.input]! -= recipe.amount!;
        b.inventory[recipe.output] =
          (b.inventory[recipe.output] ?? 0) + recipe.count;
        b.produced += recipe.count;
      }
    }
    for (const r of this.state.residents)
      r.leisure = Math.max(0, (r.leisure ?? 60) - 0.04);
    for (const a of [...this.state.agents]) {
      if (
        a.resident !== null &&
        a.active === false &&
        !a.returning &&
        !a.onsite
      ) {
        const r = this.state.residents.find((r) => r.id === a.resident),
          destination = r && this.residentDestination(r),
          home = this.building(a.source);
        if (destination && home && destination.id !== a.target) {
          let path = this.route(home, destination,a.kind);
          if(!path&&a.kind==="car"){a.kind="person";path=this.route(home,destination);}
          if (path) {
            a.target = destination.id;
            a.path = path;
            a.segment = 0;
            a.progress = 0;
          }
        }
        if (!destination) a.wait = Math.max(a.wait, STEP * 2);
      }
      if(a.wait<=0)delete a.parkSlot;
      // Finish journeys already on the road; most residents stay home at night.
      if (
        day.night &&
        a.kind !== "truck" &&
        a.resident !== null &&
        a.resident % 4 !== 0 &&
        !(
          isLeisure(this.building(a.target)?.kind ?? "") &&
          serviceOpen(this.building(a.target)!.kind, day.hour)
        ) &&
        !a.returning &&
        a.active === false &&
        !a.onsite
      )
        a.wait = Math.max(a.wait, STEP * 2);
      if (a.onsite && this.building(a.onsite)?.construction) {
        a.wait = 1;
        a.active = false;
        continue;
      }
      if (a.onsite && (this.building(a.onsite)?.kind === "forester" || isExtractor(this.building(a.onsite)?.kind??""))) {
        const lodge=this.building(a.onsite)!;
        if (lodge.forestry?.some(t=>t.resident===a.resident) || lodge.mining?.some(t=>t.resident===a.resident) || (!day.night && lodge.enabled && lodge.connected && this.state.residents.some(r=>r.id===a.resident&&r.job===lodge.id))) {
          a.wait=1; a.active=false; continue;
        }
        delete a.onsite; a.wait=0;
      }
      if (a.wait > 0) {
        a.wait -= STEP;
        continue;
      }
      const distance =
        a.segment + a.progress + (a.move ?? STEP * AGENT_SPEED[a.kind]);
      a.segment = Math.floor(distance);
      a.progress = distance - a.segment;
      if (distance >= a.path.length - 1 - 1e-8) {
        if (a.kind === "truck") {
          const b = this.building(a.target);
          if (b && a.cargo) {
            b.inventory[a.cargo] = (b.inventory[a.cargo] ?? 0) + a.amount;
            this.state.delivered += a.amount;
            if (b.kind === "warehouse" && a.cargo === "tools") {
              b.inventory.tools! -= a.amount;
              this.state.money +=
                a.amount * Math.round(35 * (1 + ((b.level ?? 1) - 1) * 0.1));
              this.state.exported += a.amount;
            }
          }
          this.state.agents = this.state.agents.filter((x) => x.id !== a.id);
        } else {
          const arrival = this.building(a.target),
            resident = this.state.residents.find((r) => r.id === a.resident);
          let parkSlot:number|undefined;
          if(!a.returning&&arrival?.kind==="park"){const used=new Set(this.state.agents.filter(v=>v.id!==a.id&&v.target===arrival.id&&v.returning&&v.wait>0).map(v=>v.parkSlot));parkSlot=[0,1,2,3].find(slot=>!used.has(slot));}
          if (
            !a.returning &&
            (arrival?.kind!=="park"||parkSlot!==undefined) &&
            resident &&
            arrival &&
            isLeisure(arrival.kind) &&
            serviceOpen(arrival.kind, day.hour) &&
            this.leisureByResident
              .get(resident.id)
              ?.some((b) => b.id === arrival.id)
          )
            resident.leisure = Math.min(
              100,
              (resident.leisure ?? 60) + (arrival.kind === "tavern" ? 45 : 22),
            );
          const home = this.building(a.source),
            destination = this.building(a.target);
          const reverse =
            home && destination
              ? this.route(
                  a.returning ? home : destination,
                  a.returning ? destination : home,
                  a.kind,
                )
              : null;
          a.path = reverse ?? [...a.path].reverse();
          a.segment = 0;
          a.progress = 0;
          a.returning = !a.returning;
          a.parkSlot=parkSlot;
          a.wait = a.returning&&arrival?.kind==="park"?(parkSlot!==undefined?parkVisitDuration(a.id):0):4+(a.id%8);
          a.active = false;
          if (
            a.returning &&
            (this.building(a.target)?.construction || this.building(a.target)?.kind === "forester" || isExtractor(this.building(a.target)?.kind??"")) &&
            this.state.residents.some(
              (r) => r.id === a.resident && r.job === a.target,
            )
          ) {
            a.onsite = a.target;
            a.wait = 1;
          }
        }
      }
    }
    if (this.state.tick % (day.night ? 48 : 12) === 0) this.dispatch();
    this.traffic.plan(this.state.agents);
    if (this.state.tick % DAY_TICKS === 0) {
      this.state.money += this.state.residents.length * 6;
      let demand = Math.ceil(this.state.residents.length / 3);
      const needed = demand;
      for (const w of this.state.buildings.filter(
        (b) => b.kind === "warehouse",
      )) {
        for (const food of ["bread", "fish"] as const) {
          const n = Math.min(demand, w.inventory[food] ?? 0);
          w.inventory[food] = (w.inventory[food] ?? 0) - n;
          demand -= n;
        }
      }
      this.state.food = needed
        ? Math.round(((needed - demand) / needed) * 100)
        : 100;
    }
  }
  private dispatch() {
    for (const b of this.state.buildings) {
      const r = BUILDINGS[b.kind].recipe;
      if (
        b.construction ||
        !r ||
        !b.connected ||
        !b.enabled ||
        (b.inventory[r.output] ?? 0) < r.count
      )
        continue;
      if (
        this.state.agents.some((a) => a.kind === "truck" && a.source === b.id)
      )
        continue;
      const destinations = this.state.buildings
        .filter((t) => t.connected && t.enabled && canSupply(b, t))
        .sort((a, c) => {
          // Reserve one grand-house upgrade's planks before feeding continuous
          // factory demand; faster traffic must not consume every new plank.
          const priority = (target: Building) =>
            r.output === "planks" &&
            target.kind === "warehouse" &&
            this.stored("planks") <
              Math.max(
                16,
                ...this.state.buildings
                  .filter((b) => isExtractor(b.kind))
                  .map(
                    (b) =>
                      deeperLayer(this.state.depositDepths?.[buildingDeposit(b)!] ?? 0)
                        .materials.planks ?? 0,
                  ),
              )
              ? -1
              : (target.inventory[r.output] ?? 0);
          return priority(a) - priority(c);
        });
      for (const dest of destinations) {
        const incoming = this.state.agents
          .filter(
            (a) =>
              a.kind === "truck" &&
              a.target === dest.id &&
              a.cargo === r.output,
          )
          .reduce((n, a) => n + a.amount, 0);
        if (
          (dest.inventory[r.output] ?? 0) + incoming >=
            outputCapacity(dest) + 4 &&
          dest.kind !== "warehouse"
        )
          continue;
        const p = this.route(b, dest,"truck");
        if (!p) continue;
        const amount = Math.min(6, b.inventory[r.output] ?? 0);
        b.inventory[r.output]! -= amount;
        this.state.agents.push({
          id: this.state.nextId++,
          kind: "truck",
          path: p,
          segment: 0,
          progress: 0,
          resident: null,
          source: b.id,
          target: dest.id,
          cargo: r.output,
          amount,
          returning: false,
          wait: 0,
        });
        break;
      }
    }
  }
  totals() {
    return Object.fromEntries(
      RESOURCES.map((r) => [
        r,
        this.state.buildings.reduce(
          (n, b) =>
            n +
            (b.inventory[r] ?? 0) +
            (r === "fish" ? (b.fishing?.cargo ?? 0) : 0) +
            (r === "wood" ? (b.forestry??[]).reduce((total,t)=>total+t.cargo,0) : 0) +
            (r===(b.kind==="quarry"?"stone":b.kind==="mine"?"metal":"")?(b.mining??[]).reduce((total,t)=>total+t.cargo,0):0),
          0,
        ) +
          this.state.agents
            .filter((a) => a.cargo === r)
            .reduce((n, a) => n + a.amount, 0),
      ]),
    ) as Record<Resource, number>;
  }
  happiness() {
    return Math.min(
      100,
      55 +
        Math.round(this.leisure() * 0.25) +
        Math.round(this.state.food * 0.2),
    );
  }
  alert(b: Building): BuildingAlert | null {
    if (b.construction)
      return {
        kind: "construction",
        title: `${b.construction.clearance ? "Clearing rocks" : b.construction.deeperTo !== undefined ? "Digging deeper" : b.construction.upgradeTo || b.construction.upgradeLevel ? "Upgrading" : "Under construction"} · ${Math.floor((b.construction.completed / b.construction.required) * 100)}%`,
        message: !b.enabled
          ? "Construction is paused. Resume it to assign builders."
          : !b.connected
            ? "Connect the front entrance to a warehouse road so builders can reach the site."
            : !b.workers
              ? "Waiting for residents without an assigned job. Free up workers or connect more homes."
              : `${b.workers} builders assigned · ${this.state.agents.filter((a) => a.onsite === b.id).length} on site · ${Math.ceil(b.construction.required - b.construction.completed)} worker-seconds remaining.`,
      };
    const d = BUILDINGS[b.kind];
    if (!b.connected)
      return this.adjacent(b).length === 0
        ? {
            kind: "road",
            title: b.kind === "park" ? "No road connection" : "No front road",
            message:
              b.kind === "park"
                ? "Connect a road to any side of the fountain square."
                : "Build a road along the front entrance, or move the building beside a road.",
          }
        : {
            kind: "warehouse",
            title: "No warehouse connection",
            message:
              "Connect this entrance road to the front entrance of a warehouse.",
          };
    if (!b.enabled && (d.recipe || isLeisure(b.kind)))
      return {
        kind: "paused",
        title: "Production paused",
        message: "Open the building details to resume production.",
      };
    if (
      (b.kind === "quarry" || b.kind === "mine") &&
      (this.state.deposits[buildingDeposit(b)!] ?? 0) <= 0
    )
      return {
        kind: "depleted",
        title: "Deposit exhausted",
        message:
          "This layer is exhausted. Dig deeper here to unlock another large reserve without moving the building.",
      };
    if(d.recipe&&!this.state.buildings.some(w=>w.kind==="warehouse"&&!!this.route(b,w,"truck")))return{kind:"road",title:"No delivery road",message:"People can use pavements, but goods need a dirt, stone or brick road from this entrance to a warehouse."};
    if (d.recipe && (b.inventory[d.recipe.output] ?? 0) >= outputCapacity(b))
      return {
        kind: "output",
        title: "Output storage full",
        message: `Waiting for a delivery to collect ${d.recipe.output}. Check road access and downstream demand.`,
      };
    if (d.jobs > b.workers)
      return {
        kind: "workers",
        title: "Waiting for workers",
        message: `${b.workers} of ${d.jobs} jobs filled. Connect more homes or upgrade a connected house.`,
      };
    if (
      d.recipe?.input &&
      (b.inventory[d.recipe.input] ?? 0) < d.recipe.amount!
    )
      return {
        kind: "input",
        title: `Waiting for ${d.recipe.input}`,
        message: `Needs ${d.recipe.amount} ${d.recipe.input} per cycle. Check the supplying industry and its delivery route.`,
      };
    if (b.kind === "fishery" && !b.fishing && !fishingRoute(this, b))
      return {
        kind: "input",
        title: "Waiting for clear water",
        message:
          "Leave at least three connected open water tiles beyond the pier. Boats avoid land, bridges, other piers and occupied fishing routes.",
      };
    if (b.kind === "forester" && !b.forestry?.length && !forestTargets(this,b).length)
      return {kind:"input", title:"No reachable mature trees", message:"Wait for nearby stumps to regrow, clear a walking route, or move this lodge closer to woodland. Its highlighted area reaches 10 tiles. Planted garden trees are protected."};
    if(isExtractor(b.kind)&&!b.mining?.length&&!miningTargets(this,b).length)return{kind:"input",title:"No reachable rock face",message:"Clear a walking route from the entrance to exposed rocks within 8 tiles, or move the workplace closer. Keep the building and roads beside the deposit."};
    if (isHome(b.kind)) {
      const residents = this.state.residents.filter((r) => r.home === b.id);
      if (residents.length && residents.every((r) => (r.leisure ?? 60) < 25))
        return {
          kind: "leisure",
          title: "Needs nearby leisure",
          message:
            "Residents need a visit to a nearby fountain square or evening tavern. Connect homes and leisure with a short road route.",
        };
    }
    return null;
  }
  status(b: Building) {
    const alert = this.alert(b);
    if (alert) return alert.title;
    if (b.kind === "fishery") return fishingStatus(b);
    if(isExtractor(b.kind))return b.mining?.some(t=>t.phase==="returning")?"Carrying resources to the workplace":b.mining?.some(t=>t.phase==="mining")?"Mining the rock face":daylight(this.state.tick).night?"Miners resting until morning":"Miners walking to the deposit";
    if (b.kind === "forester") return b.forestry?.some(t=>t.phase==="returning") ? "Bringing logs to the lodge" : b.forestry?.some(t=>t.phase==="chopping") ? "Cutting trees" : daylight(this.state.tick).night ? "Foresters resting until morning" : "Workers walking to trees";
    if (isLeisure(b.kind))
      return serviceOpen(b.kind, daylight(this.state.tick).hour)
        ? "Open for nearby visitors"
        : b.kind === "tavern"
          ? "Opens at 17:00"
          : "Opens at 06:00";
    const d = BUILDINGS[b.kind];
    return d.recipe
      ? "Producing"
      : isHome(b.kind)
        ? `${this.state.residents.filter((r) => r.home === b.id).length} residents · tier ${b.houseTier ?? b.level ?? 1} home`
        : "Connected to town";
  }
  snapshot(): World {
    return structuredClone(this.state);
  }
}
export function parseSave(raw: string): World {
  const s = JSON.parse(raw) as Omit<World, "version"> & { version: number };
  const finite = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  if (
    !s ||
    ![1, 2, 3].includes(s.version) ||
    !finite(s.money) ||
    !Number.isInteger(s.tick) ||
    s.tick < 0 ||
    !Number.isInteger(s.nextId) ||
    s.nextId < 1 ||
    !Number.isInteger(s.revision) ||
    s.revision < 0 ||
    !Array.isArray(s.buildings) ||
    s.buildings.length > SIZE * SIZE ||
    !Array.isArray(s.roads) ||
    s.roads.length > SIZE * SIZE ||
    !Array.isArray(s.residents) ||
    s.residents.length > 2400 ||
    !Array.isArray(s.agents) ||
    s.agents.length > 3000 ||
    !Array.isArray(s.history) ||
    !finite(s.food) ||
    !finite(s.delivered) ||
    !finite(s.exported)
  )
    throw new Error("This save is not compatible with this version.");
  const legacy = s.version === 1;
  validateTerrain(s.terrain);
  const occupied = new Set<string>();
  const ids = new Set<number>();
  if (
    !s.deposits ||
    (s.valleyVersion !== undefined && s.valleyVersion !== 2) ||
    (s.geologyVersion !== undefined && s.geologyVersion !== 2) ||
    (s.clockVersion !== undefined && s.clockVersion !== 2) ||
    Object.entries(s.deposits).some(
      ([k, v]) =>
        !Object.hasOwn(DEPOSITS, k) || !finite(v) || !Number.isSafeInteger(v),
    )
  )
    throw new Error("Invalid deposits.");
  if(s.clearedDeposits!==undefined&&(!Array.isArray(s.clearedDeposits)||new Set(s.clearedDeposits).size!==s.clearedDeposits.length||s.clearedDeposits.some(k=>typeof k!=="string"||!depositAt({x:Number(k.split(",")[0]),y:Number(k.split(",")[1])})||k!==k.split(",").map(Number).join(","))))throw new Error("Invalid cleared deposits.");
  if (
    s.depositDepths !== undefined &&
    (!s.depositDepths ||
      typeof s.depositDepths !== "object" ||
      Array.isArray(s.depositDepths) ||
      Object.entries(s.depositDepths).some(
        ([k, v]) =>
          !Object.hasOwn(DEPOSITS, k) || !Number.isSafeInteger(v) || v < 0,
      ))
  )
    throw new Error("Invalid deposit depths.");
  for (const k of s.roads) {
    if (typeof k !== "string") throw new Error("Invalid roads.");
    const [x, y] = k.split(",").map(Number);
    if (!inside(x, y) || key({ x, y }) !== k || occupied.has(k))
      throw new Error("Invalid roads.");
    occupied.add(k);
  }
  if (s.roadTypes !== undefined && (
    !s.roadTypes || typeof s.roadTypes !== "object" || Array.isArray(s.roadTypes) ||
    Object.entries(s.roadTypes).some(([k, type]) => {
      const [x, y] = k.split(",").map(Number);
      return !occupied.has(k) || !isRoadType(type);
    })
  )) throw new Error("Invalid road surfaces.");
  for (const b of s.buildings) {
    const clearance=b.construction?.clearance;
    if(clearance&&(!Array.isArray(clearance.tiles)||!clearance.tiles.length||clearance.tiles.length>16||!finite(clearance.work)||clearance.work>=ROCK_CLEARING_WORK||clearance.tiles.some(p=>!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||!exposedDeposit(s,p)||!footprint(b.kind,b.x,b.y,b.rotation,b.plot).some(q=>q.x===p.x&&q.y===p.y))||new Set(clearance.tiles.map(key)).size!==clearance.tiles.length))throw new Error("Invalid surface clearance.");
    if(b.deposit!==undefined&&(!isExtractor(b.kind)||DEPOSITS[b.deposit] !== (b.kind==="quarry"?"stone":"metal")))throw new Error("Invalid assigned deposit.");
    if(b.mining!==undefined&&(!isExtractor(b.kind)||!Array.isArray(b.mining)||b.mining.length>4||!b.mining.every(t=>validMiningTrip(t)&&t.deposit===buildingDeposit(b))))throw new Error("Invalid mining work.");
    if (b.forestry !== undefined && (b.kind!=="forester" || !Array.isArray(b.forestry) || b.forestry.length>2 || !b.forestry.every(validForestTrip))) throw new Error("Invalid forestry work.");
    b.rotation ??= 0;
    if (b.kind === "house") b.houseTier ??= 1;
    if (s.version < 3) {
      b.plot = FOOTPRINTS[b.kind];
      if (b.plot) {
        const facing = [0, 1, 2, 3].find((r) =>
          frontage(b.kind, b.x, b.y, r, b.plot).some((p) =>
            s.roads.includes(key(p)),
          ),
        );
        if (facing !== undefined) b.rotation = facing as 0 | 1 | 2 | 3;
      }
    }
    // The old six-cell lots were larger than the actual artwork. Shrink only
    // those known lots inside their existing land, retaining road frontage,
    // IDs, inventories and construction/production progress.
    if (
      ["farm", "sawmill", "workshop", "warehouse"].includes(b.kind) &&
      Array.isArray(b.plot) &&
      ["3,2", "2,3"].includes(b.plot.join(",")) &&
      [0, 1, 2, 3].includes(b.rotation)
    ) {
      const [ow, oh] = b.plot,
        oldFront = new Set(
          frontage(b.kind, b.x, b.y, b.rotation, b.plot).map(key),
        );
      const candidates = [];
      for (let dx = 0; dx <= ow - 2; dx++)
        for (let dy = 0; dy <= oh - 2; dy++) {
          const front = frontage(
            b.kind,
            b.x + dx,
            b.y + dy,
            b.rotation,
            [2, 2],
          );
          candidates.push({
            dx,
            dy,
            score: front.reduce(
              (sum, p) =>
                sum +
                (s.roads.includes(key(p)) ? 100 : 0) +
                (oldFront.has(key(p)) ? 1 : 0),
              0,
            ),
          });
        }
      candidates.sort((a, b) => b.score - a.score);
      b.x += candidates[0].dx;
      b.y += candidates[0].dy;
      b.plot = [2, 2];
    }
    if (
      !inside(b.x, b.y) ||
      (b.kind !== "fishery" && terrain(b.x, b.y, s.terrain) !== "land") ||
      !Object.hasOwn(BUILDINGS, b.kind) ||
      !Number.isInteger(b.id) ||
      b.id < 1 ||
      ids.has(b.id) ||
      !b.inventory ||
      (b.construction !== undefined &&
        (!b.construction ||
          !finite(b.construction.completed) ||
          !finite(b.construction.required) ||
          b.construction.required <= 0 ||
          b.construction.required > 10000 ||
          b.construction.completed > b.construction.required ||
          (b.construction.upgradeLevel !== undefined &&
            (b.kind === "house" ||
              ![2, 3].includes(b.construction.upgradeLevel) ||
              b.construction.upgradeLevel !== (b.level ?? 1) + 1 ||
              b.construction.deeperTo !== undefined ||
              b.construction.upgradeTo !== undefined)) ||
          (b.construction.deeperTo !== undefined &&
            (!isExtractor(b.kind) ||
              !buildingDeposit(b) ||
              b.construction.upgradeTo !== undefined ||
              !Number.isSafeInteger(b.construction.deeperTo) ||
              b.construction.deeperTo !==
                (s.depositDepths?.[buildingDeposit(b)!] ?? 0) + 1)) ||
          (b.construction.upgradeTo !== undefined &&
            (b.kind !== "house" ||
              ![2, 3].includes(b.construction.upgradeTo) ||
              b.construction.upgradeTo !== (b.houseTier ?? 1) + 1)))) ||
      !finite(b.progress) ||
      !finite(b.produced) ||
      typeof b.enabled !== "boolean" ||
      ![0, 1, 2, 3].includes(b.rotation) ||
      (b.houseTier !== undefined &&
        (b.kind !== "house" || ![1, 2, 3].includes(b.houseTier))) ||
      (b.level !== undefined &&
        (b.kind === "house" || ![1, 2, 3].includes(b.level))) ||
      (b.plot !== undefined &&
        (!Array.isArray(b.plot) ||
          b.plot.length !== 2 ||
          ![
            FOOTPRINTS[b.kind].join(","),
            [...FOOTPRINTS[b.kind]].reverse().join(","),
          ].includes(b.plot.join(","))))
    )
      throw new Error("Invalid building.");
    if (
      b.fishing !== undefined &&
      (b.kind !== "fishery" || b.construction || !validFishingTrip(b.fishing))
    )
      throw new Error("Invalid fishing boat.");
    if (
      b.kind === "fishery" &&
      fisherySiteError(b.x, b.y, b.rotation, s.terrain)
    )
      throw new Error("Invalid fishery shoreline.");
    for (const [k, v] of Object.entries(b.inventory)) {
      if (!RESOURCES.includes(k as Resource) || !finite(v))
        throw new Error("Invalid inventory.");
    }
    ids.add(b.id);
    for (const p of legacy
      ? [b]
      : footprint(b.kind, b.x, b.y, b.rotation, b.plot)) {
      if (
        !inside(p.x, p.y) ||
        groundHeight(p.x, p.y, s.terrain) !==
          groundHeight(b.x, b.y, s.terrain) ||
        (b.kind !== "fishery" && terrain(p.x, p.y, s.terrain) !== "land") ||
        occupied.has(key(p))
      )
        throw new Error("Building footprint overlaps.");
      occupied.add(key(p));
    }
  }
  const boatWater = new Set<string>();
  for (const b of s.buildings)
    if (b.fishing) {
      if (!boatBerths(b).some((p) => key(p) === key(b.fishing!.path[0])))
        throw new Error("Invalid fishing berth.");
      for (const p of b.fishing.path) {
        if (
          occupied.has(key(p)) ||
          boatWater.has(key(p)) ||
          terrain(p.x, p.y, s.terrain) !== "water"
        )
          throw new Error("Invalid fishing waterway.");
        boatWater.add(key(p));
      }
    }
  if (legacy) {
    const taken = new Set(s.roads);
    for (const b of [...s.buildings].sort(
      (a, b) =>
        Number(["quarry", "mine"].includes(b.kind)) -
        Number(["quarry", "mine"].includes(a.kind)),
    )) {
      const candidates = Array.from({ length: SIZE * SIZE }, (_, i) => ({
        x: i % SIZE,
        y: Math.floor(i / SIZE),
      })).sort(
        (a, c) =>
          Math.abs(a.x - b.x) +
          Math.abs(a.y - b.y) -
          (Math.abs(c.x - b.x) + Math.abs(c.y - b.y)),
      );
      const p = candidates.find(
        (p) =>
          !(
            (b.kind === "quarry" || b.kind === "mine") &&
            DEPOSITS[key(p)] !== (b.kind === "quarry" ? "stone" : "metal")
          ) &&
          footprint(b.kind, p.x, p.y, b.rotation, b.plot).every(
            (c) =>
              inside(c.x, c.y) &&
              terrain(c.x, c.y, s.terrain) === "land" &&
              !taken.has(key(c)),
          ),
      );
      if (!p)
        throw new Error(
          "This older town needs more space to migrate its footprints.",
        );
      if (b.kind === "quarry" || b.kind === "mine")
        s.deposits[key(p)] = s.deposits[key(b)] ?? 600;
      b.x = p.x;
      b.y = p.y;
      const facing = [0, 1, 2, 3].find((r) =>
        frontage(b.kind, b.x, b.y, r, b.plot).some((p) =>
          s.roads.includes(key(p)),
        ),
      );
      if (facing !== undefined) b.rotation = facing as 0 | 1 | 2 | 3;
      footprint(b.kind, b.x, b.y, b.rotation, b.plot).forEach((c) =>
        taken.add(key(c)),
      );
    }
    for (const k of Object.keys(DEPOSITS)) s.deposits[k] ??= 600;
    s.history.unshift(
      "Building footprints upgraded. Existing buildings were moved clear of roads.",
    );
    s.revision++;
    occupied.clear();
    for (const k of taken) occupied.add(k);
  }
  if (s.decorations !== undefined) {
    if (!Array.isArray(s.decorations) || s.decorations.length > SIZE * SIZE * 5)
      throw new Error("Invalid decorations.");
    for (const d of s.decorations) {
      const roadLamp=d.kind==="streetlight"&&d.edge!==undefined&&[0,1,2,3].includes(d.edge)&&s.roads.includes(key(d));
      const fence=d.kind==="fence"&&d.side!==undefined&&[0,1,2,3].includes(d.side);
      const occupancyKey=fence?`fence:${fenceKey(d,d.side!)}`:roadLamp?`${key(d)}:lamp:${d.edge}`:key(d);
      if (
        !Number.isInteger(d.id) ||
        d.id < 1 ||
        ids.has(d.id) ||
        !inside(d.x, d.y) ||
        (terrain(d.x, d.y, s.terrain) === "water"&&!roadLamp) ||
        !isDecoration(d.kind) ||
        typeof d.natural !== "boolean" ||
        (d.cutAt !== undefined && (!harvestable(d) || !Number.isInteger(d.cutAt) || d.cutAt<0 || d.cutAt>s.tick)) ||
        (d.edge!==undefined&&!roadLamp) ||
        (d.side!==undefined&&!fence) ||
        (fence&&!inside(fenceNeighbour(d,d.side!).x,fenceNeighbour(d,d.side!).y)) ||
        occupied.has(occupancyKey) ||
        (!fence&&!roadLamp&&DEPOSITS[key(d)]&&!s.clearedDeposits?.includes(key(d)))
      )
        throw new Error("Invalid decoration.");
      ids.add(d.id);
      occupied.add(occupancyKey);
    }
  }
  if (!s.buildings.some((b) => b.kind === "warehouse"))
    throw new Error("Save needs a warehouse.");
  // Restore cargo before rebuilding routes; never trust persisted movement or worker assignments.
  for (const a of s.agents) {
    if (
      a.kind === "truck" &&
      a.cargo &&
      RESOURCES.includes(a.cargo) &&
      finite(a.amount)
    ) {
      const source =
        s.buildings.find((b) => b.id === a.source) ??
        s.buildings.find((b) => b.kind === "warehouse")!;
      source.inventory[a.cargo] = (source.inventory[a.cargo] ?? 0) + a.amount;
    }
  }
  s.agents = [];
  // Like delivery trucks, restore carried timber before resident journeys are rebuilt.
  for (const b of s.buildings) landTimber(b);
  for (const b of s.buildings) landOre(b);
  s.residents = s.residents.filter(
    (r) =>
      Number.isInteger(r.id) &&
      r.id > 0 &&
      !ids.has(r.id) &&
      typeof r.name === "string" &&
      r.name.length <= 40 &&
      s.buildings.some((b) => b.id === r.home && isHome(b.kind)),
  );
  s.history = s.history.filter((x) => typeof x === "string").slice(0, 20);
  for (const r of s.residents)
    r.leisure = finite(r.leisure) ? Math.min(100, r.leisure!) : 60;
  s.nextId = Math.max(s.nextId, ...ids, ...s.residents.map((r) => r.id)) + 1;
  s.decorations ??= initialDecorations(
    new Set(s.roads),
    (x, y) =>
      terrain(x, y, s.terrain) === "water" ||
      occupied.has(key({ x, y })) ||
      !!DEPOSITS[key({ x, y })],
    () => s.nextId++,
  );
  s.version = 3;
  expandValley(s as World);
  expandReserves(s as World);
  lengthenDays(s);
  return s as World;
}

/** Add wilderness only outside the original map. Never replant cleared starter
 * tiles or reset extracted quantities on subsequent saves. */
function expandValley(s: World) {
  if (s.valleyVersion === 2) return;
  for (const k of Object.keys(DEPOSITS)) {
    const [x, y] = k.split(",").map(Number);
    s.deposits[k] =
      x < STARTING_SIZE && y < STARTING_SIZE
        ? Math.max(0, INITIAL_RESERVE - 600 + (s.deposits[k] ?? 600))
        : INITIAL_RESERVE;
  }
  const occupied = new Set([
    ...s.roads,
    ...s.decorations.map(key),
    ...s.buildings.flatMap((b) =>
      footprint(b.kind, b.x, b.y, b.rotation, b.plot).map(key),
    ),
  ]);
  s.decorations.push(
    ...initialDecorations(
      new Set(s.roads),
      (x, y) =>
        (x < STARTING_SIZE && y < STARTING_SIZE) ||
        occupied.has(key({ x, y })) ||
        terrain(x, y, s.terrain) === "water" ||
        !!DEPOSITS[key({ x, y })],
      () => s.nextId++,
    ),
  );
  s.depositDepths ??= {};
  s.valleyVersion = 2;
  s.geologyVersion = 2;
  s.revision++;
  s.history.unshift(
    "The valley has expanded. Original town preserved; deposits now have larger reserves and repeatable deeper layers.",
  );
  s.history = s.history.slice(0, 20);
}
