import Phaser from "phaser";
import {
  BUILDINGS,
  SIZE,
  FOOTPRINTS,
  STEP,
  AGENT_SPEED,
  footprint,
  type Tool,
  type BuildingKind,
} from "./catalog.js";
import {
  facing,
  opaqueBounds,
  iso,
  fitGround,
  agentPose,
} from "./rendering.js";
import { buildingArt, atlasContentWidth } from "./building-art.js";
import { TerrainArt } from "./terrain-art.js";
import {
  TownAnimation,
  createRotorFrames,
  walkFrame,
  ROTOR_SCALE,
} from "./animation.js";
import {
  Simulation,
  key,
  terrain,
  inside,
  DEPOSITS,
  type Point,
  type Building,
} from "./simulation.js";
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
  private terrainArt!: TerrainArt;
  private gridCache!: Phaser.GameObjects.RenderTexture;
  private overlay!: Phaser.GameObjects.Graphics;
  private trees: Phaser.GameObjects.Image[] = [];
  private buildings = new Map<number, Phaser.GameObjects.Image>();
  private people = new Map<number, Phaser.GameObjects.Image>();
  private waterEffects!: Phaser.GameObjects.Graphics;
  private waterPoints: Point[] = [];
  private animation!: TownAnimation;
  private ghost?: Phaser.GameObjects.Image;
  private ghostRotor?: Phaser.GameObjects.Image;
  private atlasBounds = new Map<
    string,
    { x: number; y: number; cellWidth: number }
  >();
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
    this.load.image("walkers", "/pedestrian-walk.png");
    this.load.image("surfaces", "/alpine-surfaces.png");
    this.load.image("deposits", "/alpine-deposits.png");
    this.load.image("brook", "/clear-brook-water.png");
    this.load.image("mill", "/windmill-parts.png");
  }
  create() {
    this.trimAtlas("buildings", 3, 3);
    this.trimAtlas("houses", 2, 2);
    this.trimAtlas("vehicles", 4, 4);
    this.trimAtlas("walkers", 8, 4);
    this.trimAtlas("deposits", 4, 2);
    this.trimAtlas("mill", 2, 1);
    createRotorFrames(this);
    this.animation = new TownAnimation(this, (b, x, y) =>
      this.artPoint(b, x, y),
    );
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
    this.terrainArt = new TerrainArt(this);
    this.add
      .image(-SIZE * 32, -16, "terrain-art")
      .setOrigin(0, 0)
      .setDepth(-1000);
    this.gridCache = this.add
      .renderTexture(-SIZE * 32, -16, SIZE * 64, SIZE * 32 + 32)
      .setOrigin(0, 0)
      .setDepth(-999)
      .setVisible(false);
    const grid = this.add.graphics().lineStyle(0.5, 0xe8e9ca, 0.3);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const p = iso(x, y);
        grid.strokePoints(
          [
            { x: p.x, y: p.y - 16 },
            { x: p.x + 32, y: p.y },
            { x: p.x, y: p.y + 16 },
            { x: p.x - 32, y: p.y },
          ],
          true,
        );
      }
    this.gridCache.draw(grid, SIZE * 32, 16);
    grid.destroy();
    this.overlay = this.add.graphics().setDepth(5000);
    this.waterEffects = this.add.graphics().setDepth(-998);
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
      const hover = inside(t.x, t.y) ? t : null;
      if (hover?.x !== this.hover?.x || hover?.y !== this.hover?.y) {
        this.hover = hover;
        this.onHover(this.hover);
        this.drawOverlay();
      }
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
      const contentWidth = atlasContentWidth(name, i, w);
      const bounds = opaqueBounds(
        context.getImageData(x, y, contentWidth, h).data,
        contentWidth,
        h,
      );
      texture.add(
        i,
        0,
        x + bounds.x,
        y + bounds.y,
        bounds.width,
        bounds.height,
      );
      this.atlasBounds.set(`${name}:${i}`, {
        x: bounds.x,
        y: bounds.y,
        cellWidth: w,
      });
    }
  }
  private placeSprite(
    sprite: Phaser.GameObjects.Image,
    kind: BuildingKind,
    x: number,
    y: number,
    rotation = 0,
  ) {
    const [w, h] = FOOTPRINTS[kind];
    const art = buildingArt(kind, rotation);
    const bounds = this.atlasBounds.get(`${art.texture}:${art.frame}`)!;
    const fit = fitGround(art.ground, w, h);
    const scale = (fit.scale * art.cellSize) / bounds.cellWidth;
    const origin = iso(x, y);
    sprite
      .setTexture(art.texture, art.frame)
      .setOrigin(0, 0)
      .setScale(scale)
      .setPosition(
        origin.x + fit.x + bounds.x * scale,
        origin.y + fit.y + bounds.y * scale,
      );
  }
  private artPoint(b: Building, x: number, y: number) {
    const sprite = this.buildings.get(b.id)!;
    return this.spritePoint(sprite, b.kind, b.rotation, x, y);
  }
  private spritePoint(
    sprite: Phaser.GameObjects.Image,
    kind: BuildingKind,
    rotation: number,
    x: number,
    y: number,
  ) {
    const art = buildingArt(kind, rotation);
    const bounds = this.atlasBounds.get(`${art.texture}:${art.frame}`)!;
    const scale = (sprite.scaleX * bounds.cellWidth) / art.cellSize;
    return {
      x: sprite.x - bounds.x * sprite.scaleX + x * scale,
      y: sprite.y - bounds.y * sprite.scaleY + y * scale,
      scale,
      depth: sprite.depth,
    };
  }
  redraw() {
    this.renderRevision = this.simulation.state.revision;
    this.terrainArt.redraw(this.simulation);
    this.trees.forEach((t) => t.destroy());
    this.trees = [];
    this.waterPoints = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const p = iso(x, y),
          h = hash(x, y),
          water = terrain(x, y) === "water",
          road = this.simulation.roads.has(key({ x, y }));
        const occupied = this.simulation.buildingAt(x, y);
        if (water && !road && h > 0.45) this.waterPoints.push(p);
        if (water || road || occupied) continue;
        if (DEPOSITS[key({ x, y })]) {
          const frame =
            (DEPOSITS[key({ x, y })] === "metal" ? 4 : 0) + Math.floor(h * 4);
          const rock = this.add.image(0, 0, "deposits", frame).setOrigin(0, 0);
          const w = rock.frame.width,
            ht = rock.frame.height;
          const fit = fitGround(
            [
              [0, ht * 0.8],
              [w * 0.43, ht],
              [w, ht * 0.8],
            ],
            1,
            1,
          );
          rock
            .setScale(fit.scale)
            .setPosition(p.x + fit.x, p.y + fit.y)
            .setDepth((x + y) * 32 + 6);
          this.trees.push(rock);
          continue;
        }
        const wilderness = x < 4 || y < 3 || y > 23 || x > 22;
        const closeRoad = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ].some((p) => this.simulation.roads.has(key(p)));
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
          this.trees.push(
            this.add
              .image(p.x, p.y + 8, "garden", frame)
              .setOrigin(0.5, 1)
              .setDisplaySize(size, size)
              .setDepth((x + y) * 32 + 5),
          );
        } else if (closeRoad && h > 0.52 && h < 0.61) {
          this.trees.push(
            this.add
              .image(p.x, p.y + 4, "garden", h > 0.56 ? 12 : 13)
              .setOrigin(0.5, 1)
              .setDisplaySize(31, 31)
              .setDepth((x + y) * 32 + 5),
          );
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
    this.ghostRotor?.setVisible(false);
    this.gridCache.setVisible(this.showGrid);
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
        if (this.tool === "mill") {
          this.ghostRotor ??= this.add
            .image(0, 0, "mill-rotor", 0)
            .setDepth(5002);
          const p = this.spritePoint(this.ghost, "mill", 0, 425, 320);
          this.ghostRotor
            .setVisible(true)
            .setPosition(p.x, p.y)
            .setScale(p.scale / ROTOR_SCALE)
            .setAlpha(0.6)
            .setTint(valid ? 0xffffff : 0xe99385);
        }
      }
    }
  }
  update(_time: number, delta: number) {
    if (!this.ready) return;
    this.acc += (Math.min(delta, 100) * this.speed) / 1000;
    while (this.acc >= STEP) {
      this.simulation.step();
      this.acc -= STEP;
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
      const p = agentPose(a, this.acc),
        direction = facing(p.dx, p.dy);
      const texture = a.kind === "person" ? "walkers" : "vehicles";
      const row =
        a.kind === "person"
          ? a.id % 4
          : a.kind === "truck"
            ? 2 + (a.id % 2)
            : a.id % 2;
      const walk = walkFrame(
        direction,
        a.id % 2,
        a.segment +
          a.progress +
          (a.wait > 0 ? 0 : this.acc * AGENT_SPEED.person),
        a.wait > 0,
      );
      const frame = a.kind === "person" ? walk.frame : row * 4 + direction;
      if (!s) {
        s = this.add.image(0, 0, texture, frame).setOrigin(0.5, 1);
        this.people.set(a.id, s);
      }
      if (
        s.texture.key !== texture ||
        Number(s.frame.name) !== frame ||
        !s.getData("sized")
      ) {
        s.setTexture(texture, frame)
          .setScale(
            a.kind === "person"
              ? 22 / s.frame.height
              : (a.kind === "truck" ? 37 : 32) / s.frame.width,
          )
          .setData("sized", true);
      }
      const v = iso(p.x, p.y),
        bob =
          a.kind === "person" && a.wait <= 0
            ? Math.sin(
                (this.simulation.state.tick + this.acc / STEP) * 1.1 + a.id,
              ) * 0.55
            : 0;
      s.setPosition(
        Math.round(v.x) + (a.kind === "person" ? 10 : 0),
        Math.round(v.y) + (a.kind === "person" ? 3 : 0) + bob,
      )
        .setDepth((p.x + p.y) * 32 + 16)
        .setFlipX(a.kind === "person" && walk.flip);
      if (a.kind !== "person")
        this.animation.vehicle(
          a,
          s,
          direction,
          this.simulation.state.tick * STEP + this.acc,
        );
    }
    const time = this.simulation.state.tick * STEP + this.acc;
    this.animation.update(
      this.simulation,
      time,
      (Math.min(delta, 100) * this.speed) / 1000,
      (id) => this.buildings.has(id),
    );
    this.waterEffects.clear();
    for (const p of this.waterPoints) {
      const phase = (time * 0.22 + hash(p.x, p.y)) % 1;
      this.waterEffects.lineStyle(
        1,
        0xe1f2cc,
        Math.sin(phase * Math.PI) * 0.25,
      );
      this.waterEffects.lineBetween(
        p.x - 6 + phase * 5,
        p.y + phase * 3,
        p.x + 3 + phase * 5,
        p.y + phase * 3,
      );
    }
  }
  replace(simulation: Simulation) {
    this.simulation = simulation;
    this.animation.clear();
    this.acc = 0;
    this.selected = null;
    this.people.forEach((p) => p.destroy());
    this.people.clear();
    this.buildings.forEach((b) => b.destroy());
    this.buildings.clear();
    this.redraw();
  }
}
