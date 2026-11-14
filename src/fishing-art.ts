import type Phaser from "phaser";
import { FRONT_DIRECTIONS } from "./catalog.js";
import { boatBerths, boatPose, fishingActive, openWater } from "./fishing.js";
import { iso } from "./rendering.js";
import type { Simulation } from "./simulation.js";

/** Cached direction sprites and small water effects; no per-frame texture uploads. */
export class FishingArt {
  private boats = new Map<
    number,
    { sprite: Phaser.GameObjects.Image; wake: Phaser.GameObjects.Graphics }
  >();
  private route: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.route = scene.add.graphics().setDepth(4997);
  }
  update(
    sim: Simulation,
    elapsed: number,
    time: number,
    selected: number | null,
  ) {
    this.route.clear();
    const fisheries = sim.state.buildings.filter(
      (b) => b.kind === "fishery" && !b.construction,
    );
    const live = new Set(fisheries.map((b) => b.id));
    for (const [id, art] of this.boats)
      if (!live.has(id)) {
        art.sprite.destroy();
        art.wake.destroy();
        this.boats.delete(id);
      }
    for (const b of fisheries) {
      const berth = boatBerths(b).find((p) => openWater(sim, p));
      let art = this.boats.get(b.id);
      if (!berth && !b.fishing) {
        art?.sprite.setVisible(false);
        art?.wake.clear();
        continue;
      }
      if (!art) {
        const sprite = this.scene.add
          .image(0, 0, "fishing-boats", 0)
          .setInteractive({ pixelPerfect: true, alphaTolerance: 64 })
          .setData("boatId", b.id);
        art = { sprite, wake: this.scene.add.graphics() };
        this.boats.set(b.id, art);
      }
      const d = FRONT_DIRECTIONS[b.rotation];
      const pose = b.fishing
        ? boatPose(b.fishing, fishingActive(b) ? elapsed : 0)
        : {
            ...berth!,
            dx: -d.x,
            dy: -d.y,
            frame: -d.x > 0 ? 0 : -d.y > 0 ? 1 : -d.x < 0 ? 2 : 3,
          };
      const p = iso(pose.x, pose.y),
        v = iso(pose.dx, pose.dy),
        length = Math.hypot(v.x, v.y);
      const s = art.sprite;
      s.setTexture("fishing-boats", pose.frame)
        .setScale(42 / s.frame.width)
        .setOrigin(0.5, 0.76)
        .setPosition(p.x, p.y)
        .setDepth((pose.x + pose.y) * 32 + 16)
        .setVisible(true);
      const g = art.wake;
      g.clear().setDepth(s.depth - 0.1);
      const moving =
        b.fishing && b.fishing.phase !== "fishing" && fishingActive(b);
      if (moving) {
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.7 + i / 3) % 1,
            offset = 10 + t * 12,
            spread = 3 + t * 5;
          const x = p.x - (v.x / length) * offset,
            y = p.y - (v.y / length) * offset;
          g.lineStyle(0.8, 0xc9f2d7, (1 - t) * 0.45).lineBetween(
            x - (v.y / length) * spread,
            y + (v.x / length) * spread,
            x + (v.y / length) * spread,
            y - (v.x / length) * spread,
          );
        }
      } else if (b.fishing?.phase === "fishing") {
        const t = (time * 0.3) % 1;
        g.lineStyle(0.7, 0xc9f2d7, (1 - t) * 0.55).strokeEllipse(
          p.x + 12,
          p.y + 5,
          4 + t * 12,
          2 + t * 6,
        );
      }
      if (selected === b.id) {
        this.route.lineStyle(1.5, 0x8ee5eb, 0.8);
        const points = b.fishing?.path.map((q) => iso(q.x, q.y)) ?? [p];
        this.route.strokePoints(points, false);
        this.route
          .lineStyle(1.5, 0xffe3a1, 0.9)
          .strokeEllipse(p.x, p.y, 35, 17);
      }
    }
  }
  clear() {
    for (const art of this.boats.values()) {
      art.sprite.destroy();
      art.wake.destroy();
    }
    this.boats.clear();
    this.route.clear();
  }
}
