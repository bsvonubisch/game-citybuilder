import Phaser from "phaser";
import {
  BUILDINGS,
  SIZE,
  FOOTPRINTS,
  footprint,
  type Tool,
  type BuildingKind,
} from "./catalog.js";
import { facing, opaqueBounds } from "./rendering.js";
import {
  Simulation,
  key,
  terrain,
  inside,
  DEPOSITS,
  type Point,
  type Agent,
} from "./simulation.js";
export const iso = (x: number, y: number) => ({
  x: (x - y) * 32,
  y: (x + y) * 16,
});
export const fromIso = (x: number, y: number) => ({
  x: Math.round(x / 64 + y / 32),
  y: Math.round(y / 32 - x / 64),
});
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const poly = (
  g: Phaser.GameObjects.Graphics,
  color: number,
  pts: number[],
  alpha = 1,
) => {
  g.fillStyle(color, alpha);
  g.fillPoints(
    Array.from(
      { length: pts.length / 2 },
      (_, i) => new Phaser.Geom.Point(pts[i * 2], pts[i * 2 + 1]),
    ),
    true,
  );
};
export class TownScene extends Phaser.Scene {
  simulation: Simulation;
  tool: Tool = "inspect";
  selected: number | null = null;
  showGrid = false;
  rotation: 0 | 1 | 2 | 3 = 0;
  onTile: (p: Point) => void = () => {};
  onSelect: (id: number) => void = () => {};
  onHover: (p: Point | null) => void = () => {};
  onCamera: () => void = () => {};
  private terrainLayer!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private trees: Phaser.GameObjects.Image[] = [];
  private buildings = new Map<number, Phaser.GameObjects.Image>();
  private people = new Map<number, Phaser.GameObjects.Image>();
  private smoke!: Phaser.GameObjects.Graphics;
  private ghost?: Phaser.GameObjects.Image;
  private groundOrigins = new Map<string, number>();
  private hover: Point | null = null;
  private dragging = false;
  private moved = 0;
  private lastPointer = { x: 0, y: 0 };
  private acc = 0;
  private renderRevision = -1;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  speed = 1;
  ready = false;
  constructor(simulation: Simulation) {
    super("Town");
    this.simulation = simulation;
  }
  preload() {
    this.load.image("buildings", "/buildings.png");
    this.load.image("garden", "/garden-sprites.png");
    this.load.image("houses", "/house-rotations.png");
    this.load.image("vehicles", "/vehicles-directions.png");
    this.load.image("villagers", "/people-directions.png");
  }
  create() {
    this.trimAtlas("buildings", 3, 3);
    this.trimAtlas("houses", 2, 2);
    this.trimAtlas("vehicles", 4, 4);
    this.trimAtlas("villagers", 4, 4);
    const garden = this.textures.get("garden"),
      gardenImage = garden.getSourceImage() as HTMLImageElement;
    for (let i = 0; i < 16; i++)
      garden.add(
        i,
        0,
        Math.floor(((i % 4) * gardenImage.width) / 4),
        Math.floor((Math.floor(i / 4) * gardenImage.height) / 4),
        Math.floor(gardenImage.width / 4),
        Math.floor(gardenImage.height / 4),
      );
    this.terrainLayer = this.add.graphics().setDepth(-1000);
    this.overlay = this.add.graphics().setDepth(5000);
    this.smoke = this.add.graphics().setDepth(4000);
    this.cameras.main.setBackgroundColor("#a7b9ad");
    this.cameras.main.setRoundPixels(true);
    this.redraw();
    this.centerTown();
    this.ready = true;
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging =
        p.rightButtonDown() ||
        p.middleButtonDown() ||
        this.keys.SPACE.isDown ||
        this.tool === "inspect";
      this.moved = 0;
      this.lastPointer = { x: p.x, y: p.y };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown && this.dragging) {
        const dx = p.x - this.lastPointer.x,
          dy = p.y - this.lastPointer.y;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
        this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
        this.lastPointer = { x: p.x, y: p.y };
        this.clampCamera();
      }
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const t = fromIso(wp.x, wp.y);
      this.hover = inside(t.x, t.y) ? t : null;
      this.onHover(this.hover);
      this.drawOverlay();
    });
    this.input.on(
      "pointerup",
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (this.moved < 6 && p.button === 0 && !this.keys.SPACE.isDown) {
          const hit =
            this.tool === "inspect"
              ? over.find((o) => o.getData("buildingId"))
              : null;
          if (hit) this.onSelect(hit.getData("buildingId"));
          else {
            const wp = this.cameras.main.getWorldPoint(p.x, p.y),
              t = fromIso(wp.x, wp.y);
            if (inside(t.x, t.y)) this.onTile(t);
          }
        }
        this.dragging = false;
      },
    );
    this.input.on("gameout", () => {
      this.hover = null;
      this.drawOverlay();
    });
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) =>
        this.zoomBy(dy > 0 ? -0.12 : 0.12),
    );
    this.scale.on("resize", () => this.onCamera());
  }
  centerTown() {
    this.cameras.main.setZoom(
      Math.min(1.5, Math.max(0.65, this.scale.width / 1000)),
    );
    const center = iso(13.5, 11);
    this.cameras.main.centerOn(center.x, center.y - 15);
    this.onCamera();
  }
  zoomBy(d: number) {
    const c = this.cameras.main,
      center = c.midPoint.clone();
    c.setZoom(Phaser.Math.Clamp(c.zoom + d, 0.55, 2.7));
    c.centerOn(center.x, center.y);
    this.onCamera();
  }
  private clampCamera() {
    const c = this.cameras.main;
    c.scrollX = Phaser.Math.Clamp(c.scrollX, -1100, 600);
    c.scrollY = Phaser.Math.Clamp(c.scrollY, -500, 800);
  }
  private trimAtlas(name: string, columns: number, rows: number) {
    const texture = this.textures.get(name),
      source = texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    for (let i = 0; i < columns * rows; i++) {
      const x = Math.floor(((i % columns) * source.width) / columns),
        y = Math.floor((Math.floor(i / columns) * source.height) / rows),
        w = Math.floor(source.width / columns),
        h = Math.floor(source.height / rows);
      const bounds = opaqueBounds(context.getImageData(x, y, w, h).data, w, h);
      texture.add(
        i,
        0,
        x + bounds.x,
        y + bounds.y,
        bounds.width,
        bounds.height,
      );
      this.groundOrigins.set(`${name}:${i}`, bounds.groundX / bounds.width);
    }
  }
  private placeSprite(
    sprite: Phaser.GameObjects.Image,
    kind: BuildingKind,
    x: number,
    y: number,
    rotation = 0,
  ) {
    const [w, h] = FOOTPRINTS[kind],
      front = iso(x + w - 0.5, y + h - 0.5),
      width = (w + h) * 32 * 0.98;
    const texture =
        kind === "house" && this.textures.exists("houses")
          ? "houses"
          : "buildings",
      frame =
        texture === "houses" ? [1, 0, 2, 3][rotation] : BUILDINGS[kind].frame;
    sprite
      .setTexture(texture, frame)
      .setOrigin(this.groundOrigins.get(`${texture}:${frame}`) ?? 0.5, 1)
      .setScale(width / sprite.frame.width)
      .setPosition(front.x, front.y - 1);
  }
  redraw() {
    this.renderRevision = this.simulation.state.revision;
    const g = this.terrainLayer;
    g.clear();
    this.trees.forEach((t) => t.destroy());
    this.trees = [];
    const roads = this.simulation.roads;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const p = iso(x, y),
          h = hash(x, y),
          water = terrain(x, y) === "water",
          road = roads.has(key({ x, y }));
        const color = water
          ? [0x68938e, 0x729b94, 0x78a29a][Math.floor(h * 3)]
          : [0x88a275, 0x8da778, 0x91aa7c, 0x86a174][Math.floor(h * 4)];
        poly(g, color, [
          p.x,
          p.y - 16,
          p.x + 32,
          p.y,
          p.x,
          p.y + 16,
          p.x - 32,
          p.y,
        ]);
        if (x === SIZE - 1 || y === SIZE - 1) {
          poly(g, water ? 0x527c78 : 0x647e58, [
            p.x - 32,
            p.y,
            p.x,
            p.y + 16,
            p.x + 32,
            p.y,
            p.x + 32,
            p.y + 9,
            p.x,
            p.y + 25,
            p.x - 32,
            p.y + 9,
          ]);
          poly(g, color, [
            p.x,
            p.y - 16,
            p.x + 32,
            p.y,
            p.x,
            p.y + 16,
            p.x - 32,
            p.y,
          ]);
        }
        if (water && !road) {
          g.lineStyle(1, 0xb9d3bc, 0.35);
          g.lineBetween(p.x - 12 + h * 10, p.y, p.x + 5 + h * 10, p.y);
          if (h > 0.6) g.lineBetween(p.x - 7, p.y + 6, p.x + 10, p.y + 6);
        }
        if (!water && !road) {
          for (let i = 0; i < 4; i++) {
            g.fillStyle(h > 0.5 ? 0xb5c18a : 0x6f8f65, 0.6);
            g.fillRect(
              p.x - 14 + ((h * 120 + i * 11) % 28),
              p.y - 6 + ((h * 80 + i * 5) % 12),
              2,
              1,
            );
          }
        }
        if (road) {
          poly(g, water ? 0x927c5d : 0x898c7c, [
            p.x,
            p.y - 16,
            p.x + 32,
            p.y,
            p.x,
            p.y + 16,
            p.x - 32,
            p.y,
          ]);
          if (water) {
            for (let i = 0; i < 8; i++) {
              const z = iso(i / 8 - 0.5, -0.5),
                end = iso(i / 8 - 0.5, 0.5);
              g.lineStyle(3, i % 2 ? 0xc2a478 : 0xa38c66);
              g.lineBetween(p.x + z.x, p.y + z.y, p.x + end.x, p.y + end.y);
            }
          } else {
            const palette = [0xb5b2a1, 0xa5a898, 0xc0bba8, 0x999f90, 0xb4b39f];
            for (let a = 0; a < 8; a++)
              for (let b = 0; b < 8; b++) {
                const v = iso((a + 0.5) / 8 - 0.5, (b + 0.5) / 8 - 0.5),
                  n = hash(x * 8 + a, y * 8 + b);
                poly(g, palette[Math.floor(n * 5)], [
                  p.x + v.x,
                  p.y + v.y - 1.65,
                  p.x + v.x + 3.65,
                  p.y + v.y,
                  p.x + v.x,
                  p.y + v.y + 1.65,
                  p.x + v.x - 3.65,
                  p.y + v.y,
                ]);
                if (n > 0.7) {
                  g.fillStyle(0xd5cfb7, 0.6);
                  g.fillRect(p.x + v.x - 1, p.y + v.y - 1, 2, 1);
                }
              }
            const edges = [
              { dx: 1, dy: 0, a: [32, 0], b: [0, 16] },
              { dx: 0, dy: 1, a: [0, 16], b: [-32, 0] },
              { dx: -1, dy: 0, a: [-32, 0], b: [0, -16] },
              { dx: 0, dy: -1, a: [0, -16], b: [32, 0] },
            ];
            for (const e of edges)
              if (!roads.has(key({ x: x + e.dx, y: y + e.dy }))) {
                g.lineStyle(5, 0xc1b897);
                g.lineBetween(
                  p.x + e.a[0],
                  p.y + e.a[1],
                  p.x + e.b[0],
                  p.y + e.b[1],
                );
                g.lineStyle(1, 0xddd5b7);
                g.lineBetween(
                  p.x + e.a[0],
                  p.y + e.a[1] - 1,
                  p.x + e.b[0],
                  p.y + e.b[1] - 1,
                );
                for (let i = 1; i < 8; i++) {
                  const xx = p.x + e.a[0] + ((e.b[0] - e.a[0]) * i) / 8,
                    yy = p.y + e.a[1] + ((e.b[1] - e.a[1]) * i) / 8;
                  g.fillStyle(0x8d947b);
                  g.fillRect(xx, yy, 1, 2);
                }
              }
          }
        }
        const occupied = this.simulation.buildingAt(x, y);
        if (DEPOSITS[key({ x, y })]) {
          const metal = DEPOSITS[key({ x, y })] === "metal";
          for (let i = 0; i < 5; i++) {
            const ox = -20 + i * 9,
              oy = (i % 2) * 7;
            poly(g, metal ? 0x92836c : 0x9fa8a0, [
              p.x + ox,
              p.y + oy - 6,
              p.x + ox + 9,
              p.y + oy - 12,
              p.x + ox + 15,
              p.y + oy - 3,
              p.x + ox + 7,
              p.y + oy + 2,
            ]);
            g.fillStyle(metal ? 0xc99560 : 0xc3c8b3);
            g.fillRect(p.x + ox + 5, p.y + oy - 8, 4, 3);
          }
        }
        if (!water && !road && !occupied && !DEPOSITS[key({ x, y })]) {
          const wilderness = x < 4 || y < 3 || y > 23 || x > 22;
          const closeRoad = [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
          ].some((p) => roads.has(key(p)));
          if (h > (wilderness ? 0.4 : closeRoad ? 0.97 : 0.84)) {
            const frame = wilderness
              ? h > 0.68
                ? 1
                : 0
              : h > 0.96
                ? 3
                : h > 0.9
                  ? 2
                  : 0;
            const size = 62 + h * 30;
            const t = this.add
              .image(p.x, p.y + 8, "garden", frame)
              .setOrigin(0.5, 1)
              .setDisplaySize(size, size)
              .setDepth((x + y) * 32 + 5);
            this.trees.push(t);
          } else if (closeRoad && h > 0.52 && h < 0.61) {
            const t = this.add
              .image(p.x, p.y + 4, "garden", h > 0.56 ? 12 : 13)
              .setOrigin(0.5, 1)
              .setDisplaySize(31, 31)
              .setDepth((x + y) * 32 + 5);
            this.trees.push(t);
          }
        }
      }
    for (const [id, sprite] of this.buildings) {
      if (!this.simulation.building(id)) {
        sprite.destroy();
        this.buildings.delete(id);
      }
    }
    for (const b of this.simulation.state.buildings) {
      let s = this.buildings.get(b.id);
      const [w, h] = FOOTPRINTS[b.kind];
      if (!s) {
        s = this.add
          .image(0, 0, "buildings", BUILDINGS[b.kind].frame)
          .setOrigin(0.5, 1)
          .setData("buildingId", b.id)
          .setInteractive({ pixelPerfect: true });
        this.buildings.set(b.id, s);
      }
      this.placeSprite(s, b.kind, b.x, b.y, b.rotation);
      s.setDepth((b.x + b.y + w + h - 2) * 32 + 12).setAlpha(
        b.enabled ? 1 : 0.55,
      );
      if (b.kind === "quarry") s.setTint(0xc3c1b3);
      if (b.kind === "mine") s.setTint(0xc7ad8f);
    }
    this.drawOverlay();
  }
  private diamond(p: Point, color: number, alpha: number) {
    const v = iso(p.x, p.y);
    poly(
      this.overlay,
      color,
      [v.x, v.y - 16, v.x + 32, v.y, v.x, v.y + 16, v.x - 32, v.y],
      alpha,
    );
    this.overlay.lineStyle(1, color, 0.9);
    this.overlay.strokePoints(
      [
        { x: v.x, y: v.y - 16 },
        { x: v.x + 32, y: v.y },
        { x: v.x, y: v.y + 16 },
        { x: v.x - 32, y: v.y },
        { x: v.x, y: v.y - 16 },
      ],
      false,
    );
  }
  drawOverlay() {
    if (!this.overlay) return;
    this.overlay.clear();
    this.ghost?.setVisible(false);
    if (this.showGrid) {
      this.overlay.lineStyle(0.5, 0xe8e9ca, 0.3);
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const p = iso(x, y);
          this.overlay.strokePoints(
            [
              { x: p.x, y: p.y - 16 },
              { x: p.x + 32, y: p.y },
              { x: p.x, y: p.y + 16 },
              { x: p.x - 32, y: p.y },
              { x: p.x, y: p.y - 16 },
            ],
            false,
          );
        }
    }
    if (this.selected) {
      const b = this.simulation.building(this.selected);
      if (b)
        for (const p of footprint(b.kind, b.x, b.y))
          this.diamond(p, 0xf3ce7b, 0.23);
    }
    if (this.hover) {
      const valid =
        this.tool === "inspect" ||
        this.tool === "bulldoze" ||
        !this.simulation.canPlace(this.tool, this.hover.x, this.hover.y);
      const b = this.simulation.buildingAt(this.hover.x, this.hover.y);
      const cells =
        this.tool === "bulldoze" && b
          ? footprint(b.kind, b.x, b.y)
          : this.tool !== "inspect" &&
              this.tool !== "bulldoze" &&
              this.tool !== "road"
            ? footprint(this.tool, this.hover.x, this.hover.y)
            : [this.hover];
      for (const p of cells) this.diamond(p, valid ? 0xffe5a4 : 0xd78069, 0.3);
      if (
        this.tool !== "inspect" &&
        this.tool !== "bulldoze" &&
        this.tool !== "road"
      ) {
        this.ghost ??= this.add.image(0, 0, "buildings", 0).setDepth(5001);
        this.placeSprite(
          this.ghost,
          this.tool,
          this.hover.x,
          this.hover.y,
          this.rotation,
        );
        this.ghost
          .setVisible(true)
          .setAlpha(0.6)
          .setTint(valid ? 0xffffff : 0xe99385);
      }
    }
  }
  position(a: Agent) {
    const from = a.path[Math.min(a.segment, a.path.length - 1)],
      to = a.path[Math.min(a.segment + 1, a.path.length - 1)];
    return {
      x: from.x + (to.x - from.x) * a.progress,
      y: from.y + (to.y - from.y) * a.progress,
      dx: to.x - from.x,
      dy: to.y - from.y,
    };
  }
  update(_time: number, delta: number) {
    if (!this.ready) return;
    this.acc += (Math.min(delta, 100) * this.speed) / 1000;
    while (this.acc >= 0.25) {
      this.simulation.step();
      this.acc -= 0.25;
    }
    if (this.simulation.state.revision !== this.renderRevision) this.redraw();
    const c = this.cameras.main,
      move = (Math.min(delta, 40) * 0.6) / c.zoom;
    if (this.keys.W.isDown || this.keys.UP.isDown) c.scrollY -= move;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) c.scrollY += move;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) c.scrollX -= move;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) c.scrollX += move;
    const live = new Set(this.simulation.state.agents.map((a) => a.id));
    for (const [id, s] of this.people)
      if (!live.has(id)) {
        s.destroy();
        this.people.delete(id);
      }
    for (const a of this.simulation.state.agents) {
      let s = this.people.get(a.id);
      const p = this.position(a),
        direction = facing(p.dx, p.dy);
      const texture = a.kind === "person" ? "villagers" : "vehicles";
      const row =
        a.kind === "person"
          ? a.id % 4
          : a.kind === "truck"
            ? 2 + (a.id % 2)
            : a.id % 2;
      const frame = row * 4 + direction;
      if (!s) {
        s = this.add.image(0, 0, texture, frame).setOrigin(0.5, 1);
        this.people.set(a.id, s);
      }
      s.setTexture(texture, frame).setScale(
        a.kind === "person"
          ? 22 / s.frame.height
          : (a.kind === "truck" ? 37 : 32) / s.frame.width,
      );
      const v = iso(p.x, p.y),
        bob =
          a.kind === "person" && a.wait <= 0
            ? Math.sin(this.simulation.state.tick * 1.1 + a.id) * 0.55
            : 0;
      s.setPosition(
        Math.round(v.x) + (a.kind === "person" ? 10 : 0),
        Math.round(v.y) + (a.kind === "person" ? 3 : 0) + bob,
      ).setDepth((p.x + p.y) * 32 + 16);
    }
    this.smoke.clear();
    for (const b of this.simulation.state.buildings) {
      if (
        !["bakery", "workshop", "sawmill"].includes(b.kind) ||
        !b.enabled ||
        !b.connected
      )
        continue;
      const p = iso(b.x, b.y);
      for (let i = 0; i < 3; i++) {
        const phase = (this.simulation.state.tick * 0.15 + i * 4) % 14;
        this.smoke.fillStyle(0xe8e4ca, 0.32 * (1 - phase / 14));
        this.smoke.fillRect(
          p.x - 14 + phase * 0.5,
          p.y - 60 - phase * 2,
          4 + phase * 0.3,
          3 + phase * 0.3,
        );
      }
    }
  }
  replace(simulation: Simulation) {
    this.simulation = simulation;
    this.selected = null;
    this.people.forEach((p) => p.destroy());
    this.people.clear();
    this.buildings.forEach((b) => b.destroy());
    this.buildings.clear();
    this.redraw();
  }
}
