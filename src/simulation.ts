import {
  BUILDINGS,
  RESOURCES,
  SIZE,
  STEP,
  AGENT_SPEED,
  FOOTPRINTS,
  footprint,
  type BuildingKind,
  type Resource,
  type Tool,
} from "./catalog.js";
export interface Point {
  x: number;
  y: number;
}
export interface Building extends Point {
  id: number;
  kind: BuildingKind;
  inventory: Partial<Record<Resource, number>>;
  progress: number;
  workers: number;
  connected: boolean;
  enabled: boolean;
  produced: number;
  rotation: 0 | 1 | 2 | 3;
}
export interface Resident {
  id: number;
  name: string;
  home: number;
  job: number | null;
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
}
export interface World {
  version: 2;
  tick: number;
  revision: number;
  nextId: number;
  money: number;
  roads: string[];
  buildings: Building[];
  residents: Resident[];
  agents: Agent[];
  deposits: Record<string, number>;
  delivered: number;
  exported: number;
  food: number;
  history: string[];
}
export type Command =
  | {
      type: "place";
      kind: Exclude<Tool, "inspect" | "bulldoze">;
      x: number;
      y: number;
      rotation?: 0 | 1 | 2 | 3;
    }
  | { type: "demolish"; x: number; y: number }
  | { type: "toggle"; id: number }
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
const dirs = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
export const key = (p: Point) => `${p.x},${p.y}`;
export function terrain(x: number, y: number): "land" | "water" {
  return x >= 23 + Math.floor(Math.sin(y * 0.37) * 1.6) || (y < 2 && x > 18)
    ? "water"
    : "land";
}
export const inside = (x: number, y: number) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < SIZE &&
  y < SIZE;
export const DEPOSITS: Record<string, "stone" | "metal"> = {
  "19,4": "stone",
  "19,7": "metal",
  "17,5": "stone",
  "19,5": "metal",
  "4,19": "stone",
  "20,20": "metal",
  "9,22": "stone",
  "15,3": "metal",
};
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
  private roadSet = new Set<string>();
  private processed = new Map<string, Result>();
  constructor(saved?: World) {
    this.state = saved
      ? structuredClone(saved)
      : {
          version: 2,
          tick: 0,
          revision: 0,
          nextId: 1,
          money: 2400,
          roads: [],
          buildings: [],
          residents: [],
          agents: [],
          deposits: Object.fromEntries(
            Object.keys(DEPOSITS).map((k) => [k, 600]),
          ),
          delivered: 0,
          exported: 0,
          food: 100,
          history: [],
        };
    if (!saved) this.seed();
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
    add("warehouse", 10, 11);
    add("park", 11, 15);
    add("park", 4, 13);
    add("farm", 14, 4);
    add("mill", 14, 7);
    add("bakery", 14, 11);
    add("forester", 14, 14);
    add("sawmill", 18, 11);
    add("workshop", 18, 14);
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
        x < b.x + FOOTPRINTS[b.kind][0] &&
        y < b.y + FOOTPRINTS[b.kind][1],
    );
  }
  building(id: number) {
    return this.state.buildings.find((b) => b.id === id);
  }
  adjacent(p: Point) {
    const kind = (p as Partial<Building>).kind;
    const cells = kind ? footprint(kind, p.x, p.y) : [p];
    const perimeter = new Map<string, Point>();
    for (const cell of cells)
      for (const d of dirs) {
        const n = { x: cell.x + d.x, y: cell.y + d.y };
        if (this.roadSet.has(key(n))) perimeter.set(key(n), n);
      }
    return [...perimeter.values()];
  }
  path(start: Point, end: Point): Point[] | null {
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
        if (this.roadSet.has(k) && !parents.has(k)) {
          parents.set(k, p);
          queue.push(n);
        }
      }
    }
    return null;
  }
  route(a: Point, b: Point) {
    for (const from of this.adjacent(a))
      for (const to of this.adjacent(b)) {
        const p = this.path(from, to);
        if (p) return p;
      }
    return null;
  }
  reconnect() {
    this.roadSet = new Set(this.state.roads);
    const warehouses = this.state.buildings.filter(
      (b) => b.kind === "warehouse",
    );
    for (const b of this.state.buildings) {
      b.connected = warehouses.some((w) => !!this.route(b, w));
      b.workers = 0;
    }
    const homes = this.state.buildings.filter(
      (b) => b.kind === "house" && b.connected,
    );
    this.state.residents = this.state.residents.filter((r) =>
      homes.some((h) => h.id === r.home),
    );
    for (const h of homes) {
      while (this.state.residents.filter((r) => r.home === h.id).length < 3) {
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
      (b) => b.connected && b.enabled && BUILDINGS[b.kind].jobs > 0,
    );
    for (const r of this.state.residents) {
      const h = this.building(r.home)!;
      const job = jobs.find(
        (b) => b.workers < BUILDINGS[b.kind].jobs && this.route(h, b),
      );
      r.job = job?.id ?? null;
      if (job) job.workers++;
    }
    this.state.agents = this.state.agents.filter((a) => {
      if (a.kind !== "truck") return false;
      const valid =
        this.building(a.target) &&
        a.path.slice(a.segment).every((p) => this.roadSet.has(key(p)));
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
        destination =
          this.building(r.job ?? -1) ??
          this.state.buildings.find(
            (b) => b.kind === "park" && b.connected && this.route(home, b),
          ) ??
          warehouses.find((w) => this.route(home, w));
      if (!destination) continue;
      const p = this.route(home, destination);
      if (p)
        this.state.agents.push({
          id: this.state.nextId++,
          kind: r.id % 4 === 0 ? "car" : "person",
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
  }
  canPlace(
    kind: Exclude<Tool, "inspect" | "bulldoze">,
    x: number,
    y: number,
  ): string | null {
    if (!inside(x, y)) return "Choose a tile inside the valley.";
    const cells = kind === "road" ? [{ x, y }] : footprint(kind, x, y);
    for (const p of cells) {
      if (!inside(p.x, p.y))
        return "The whole building must fit inside the valley.";
      if (this.buildingAt(p.x, p.y) || this.roadSet.has(key(p)))
        return "The building footprint overlaps a road or another building.";
      if (terrain(p.x, p.y) === "water" && kind !== "road")
        return "The whole building needs dry land. Roads can form bridges.";
    }
    if (
      (kind === "quarry" || kind === "mine") &&
      DEPOSITS[key({ x, y })] !== (kind === "quarry" ? "stone" : "metal")
    )
      return `Place this on a ${kind === "quarry" ? "stone" : "metal"} deposit.`;
    const cost =
      kind === "road"
        ? terrain(x, y) === "water"
          ? 35
          : 12
        : BUILDINGS[kind].cost;
    if (this.state.money < cost) return "Not enough gold yet.";
    if (kind !== "road")
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
  execute(envelope: CommandEnvelope): Result {
    const prior = this.processed.get(envelope.id);
    if (prior) return prior;
    if (envelope.expectedRevision !== this.state.revision)
      return {
        ok: false,
        message: "The town changed. Please try again.",
        revision: this.state.revision,
      };
    const c = envelope.command;
    if (!c || !["place", "demolish", "toggle", "rotate"].includes(c.type))
      return {
        ok: false,
        message: "Unknown action.",
        revision: this.state.revision,
      };
    let message = "";
    if (c.type === "place") {
      if (c.rotation !== undefined && ![0, 1, 2, 3].includes(c.rotation))
        return {
          ok: false,
          message: "Invalid rotation.",
          revision: this.state.revision,
        };
      if (c.kind !== "road" && !Object.hasOwn(BUILDINGS, c.kind))
        return {
          ok: false,
          message: "Unknown building.",
          revision: this.state.revision,
        };
      const error = this.canPlace(c.kind, c.x, c.y);
      if (error)
        return { ok: false, message: error, revision: this.state.revision };
      const cost =
        c.kind === "road"
          ? terrain(c.x, c.y) === "water"
            ? 35
            : 12
          : BUILDINGS[c.kind].cost;
      this.state.money -= cost;
      if (c.kind !== "road")
        for (const [r, n] of Object.entries(BUILDINGS[c.kind].materials ?? {}))
          this.consume(r as Resource, n);
      if (c.kind === "road") this.state.roads.push(key(c));
      else
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
          rotation: c.kind === "house" ? (c.rotation ?? 0) : 0,
        });
      message =
        c.kind === "road" ? "Road laid." : `${BUILDINGS[c.kind].name} built.`;
    } else if (c.type === "demolish") {
      const b = this.buildingAt(c.x, c.y);
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
        this.state.money += Math.floor(BUILDINGS[b.kind].cost / 2);
      } else if (this.roadSet.has(key(c))) {
        this.state.roads = this.state.roads.filter((k) => k !== key(c));
        this.state.money += terrain(c.x, c.y) === "water" ? 17 : 6;
      } else
        return {
          ok: false,
          message: "There is nothing to remove here.",
          revision: this.state.revision,
        };
      message = "Removed. Half the build cost returned.";
    } else if (c.type === "rotate") {
      const b = this.building(c.id);
      if (!b || b.kind !== "house")
        return {
          ok: false,
          message: "Select a cottage to rotate.",
          revision: this.state.revision,
        };
      b.rotation = ((b.rotation + 1) % 4) as 0 | 1 | 2 | 3;
      message = "Cottage rotated.";
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
    this.state.revision++;
    if (c.type !== "rotate") this.reconnect();
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
    for (const b of this.state.buildings) {
      const recipe = BUILDINGS[b.kind].recipe;
      if (
        !recipe ||
        !b.enabled ||
        !b.connected ||
        b.workers < BUILDINGS[b.kind].jobs
      )
        continue;
      if (
        (b.kind === "quarry" || b.kind === "mine") &&
        (this.state.deposits[key(b)] ?? 0) < recipe.count
      )
        continue;
      if ((b.inventory[recipe.output] ?? 0) >= 20) continue;
      if (
        recipe.input &&
        (b.inventory[recipe.input] ?? 0) < (recipe.amount ?? 0)
      )
        continue;
      b.progress += STEP;
      if (b.progress >= recipe.seconds) {
        b.progress -= recipe.seconds;
        if (recipe.input) b.inventory[recipe.input]! -= recipe.amount!;
        if (b.kind === "quarry" || b.kind === "mine")
          this.state.deposits[key(b)] -= recipe.count;
        b.inventory[recipe.output] =
          (b.inventory[recipe.output] ?? 0) + recipe.count;
        b.produced += recipe.count;
      }
    }
    for (const a of [...this.state.agents]) {
      if (a.wait > 0) {
        a.wait -= STEP;
        continue;
      }
      a.progress += STEP * AGENT_SPEED[a.kind];
      if (a.progress >= 1) {
        a.segment++;
        a.progress -= 1;
      }
      if (a.segment >= a.path.length - 1) {
        if (a.kind === "truck") {
          const b = this.building(a.target);
          if (b && a.cargo) {
            b.inventory[a.cargo] = (b.inventory[a.cargo] ?? 0) + a.amount;
            this.state.delivered += a.amount;
            if (b.kind === "warehouse" && a.cargo === "tools") {
              b.inventory.tools! -= a.amount;
              this.state.money += a.amount * 35;
              this.state.exported += a.amount;
            }
          }
          this.state.agents = this.state.agents.filter((x) => x.id !== a.id);
        } else {
          a.path.reverse();
          a.segment = 0;
          a.progress = 0;
          a.returning = !a.returning;
          a.wait = 4 + (a.id % 8);
        }
      }
    }
    if (this.state.tick % 12 === 0) this.dispatch();
    if (this.state.tick % 240 === 0) {
      this.state.money += this.state.residents.length * 6;
      let demand = Math.ceil(this.state.residents.length / 3);
      const needed = demand;
      for (const w of this.state.buildings.filter(
        (b) => b.kind === "warehouse",
      )) {
        const n = Math.min(demand, w.inventory.bread ?? 0);
        w.inventory.bread = (w.inventory.bread ?? 0) - n;
        demand -= n;
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
        .filter(
          (t) =>
            t.connected &&
            t.enabled &&
            t.id !== b.id &&
            (BUILDINGS[t.kind].recipe?.input === r.output ||
              (["bread", "tools", "wood", "stone", "metal"].includes(
                r.output,
              ) &&
                t.kind === "warehouse")),
        )
        .sort(
          (a, c) => (a.inventory[r.output] ?? 0) - (c.inventory[r.output] ?? 0),
        );
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
          (dest.inventory[r.output] ?? 0) + incoming >= 24 &&
          dest.kind !== "warehouse"
        )
          continue;
        const p = this.route(b, dest);
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
        this.state.buildings.reduce((n, b) => n + (b.inventory[r] ?? 0), 0) +
          this.state.agents
            .filter((a) => a.cargo === r)
            .reduce((n, a) => n + a.amount, 0),
      ]),
    ) as Record<Resource, number>;
  }
  happiness() {
    return Math.min(
      100,
      60 +
        this.state.buildings.filter((b) => b.kind === "park" && b.connected)
          .length *
          6 +
        Math.round(this.state.food * 0.2),
    );
  }
  status(b: Building) {
    const d = BUILDINGS[b.kind];
    if (!b.connected) return "Needs a road to a warehouse";
    if (!b.enabled) return "Production paused";
    if (
      (b.kind === "quarry" || b.kind === "mine") &&
      (this.state.deposits[key(b)] ?? 0) < d.recipe!.count
    )
      return "Deposit exhausted";
    if (d.jobs > b.workers) return "Waiting for workers";
    if (
      d.recipe?.input &&
      (b.inventory[d.recipe.input] ?? 0) < d.recipe.amount!
    )
      return `Waiting for ${d.recipe.input}`;
    if (d.recipe && (b.inventory[d.recipe.output] ?? 0) >= 20)
      return "Output storage full";
    return d.recipe
      ? "Producing"
      : b.kind === "house"
        ? "3 residents at home"
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
    ![1, 2].includes(s.version) ||
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
  const occupied = new Set<string>();
  const ids = new Set<number>();
  if (
    !s.deposits ||
    Object.entries(s.deposits).some(
      ([k, v]) => !Object.hasOwn(DEPOSITS, k) || !finite(v) || v > 600,
    )
  )
    throw new Error("Invalid deposits.");
  for (const k of s.roads) {
    if (typeof k !== "string") throw new Error("Invalid roads.");
    const [x, y] = k.split(",").map(Number);
    if (!inside(x, y) || key({ x, y }) !== k || occupied.has(k))
      throw new Error("Invalid roads.");
    occupied.add(k);
  }
  for (const b of s.buildings) {
    b.rotation ??= 0;
    if (
      !inside(b.x, b.y) ||
      terrain(b.x, b.y) !== "land" ||
      !Object.hasOwn(BUILDINGS, b.kind) ||
      !Number.isInteger(b.id) ||
      b.id < 1 ||
      ids.has(b.id) ||
      !b.inventory ||
      !finite(b.progress) ||
      !finite(b.produced) ||
      typeof b.enabled !== "boolean" ||
      ![0, 1, 2, 3].includes(b.rotation)
    )
      throw new Error("Invalid building.");
    for (const [k, v] of Object.entries(b.inventory)) {
      if (!RESOURCES.includes(k as Resource) || !finite(v))
        throw new Error("Invalid inventory.");
    }
    ids.add(b.id);
    for (const p of legacy ? [b] : footprint(b.kind, b.x, b.y)) {
      if (
        !inside(p.x, p.y) ||
        terrain(p.x, p.y) !== "land" ||
        occupied.has(key(p))
      )
        throw new Error("Building footprint overlaps.");
      occupied.add(key(p));
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
          footprint(b.kind, p.x, p.y).every(
            (c) =>
              inside(c.x, c.y) &&
              terrain(c.x, c.y) === "land" &&
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
      footprint(b.kind, b.x, b.y).forEach((c) => taken.add(key(c)));
    }
    for (const k of Object.keys(DEPOSITS)) s.deposits[k] ??= 600;
    s.history.unshift(
      "Building footprints upgraded. Existing buildings were moved clear of roads.",
    );
    s.revision++;
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
  s.residents = s.residents.filter(
    (r) =>
      Number.isInteger(r.id) &&
      r.id > 0 &&
      !ids.has(r.id) &&
      typeof r.name === "string" &&
      r.name.length <= 40 &&
      s.buildings.some((b) => b.id === r.home && b.kind === "house"),
  );
  s.history = s.history.filter((x) => typeof x === "string").slice(0, 20);
  s.nextId = Math.max(s.nextId, ...ids, ...s.residents.map((r) => r.id)) + 1;
  s.version = 2;
  return s as World;
}
