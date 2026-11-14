import type Phaser from "phaser";
import { dimensions } from "./catalog.js";
import { iso, plotOutline } from "./rendering.js";
import { groundHeight } from "./terrain.js";
import type { Building, Simulation } from "./simulation.js";

/** Modular scaffold props keep their proportions; only the dirt plot changes size. */
export class ConstructionArt {
  private fronts = new Map<number, Phaser.GameObjects.Image>();
  constructor(private scene: Phaser.Scene) {}
  private texture(w: number, h: number, front: boolean) {
    const name = `construction-${w}-${h}-${front}`;
    const left = -h * 32 - 3,
      top = -64,
      width = (w + h) * 32 + 6,
      height = (w + h) * 16 + 72;
    if (!this.scene.textures.exists(name)) {
      const texture = this.scene.textures.createCanvas(
        name,
        width * 4,
        height * 4,
      )!;
      const ctx = texture.context;
      ctx.scale(4, 4);
      ctx.translate(-left, -top);
      ctx.imageSmoothingEnabled = false;
      if (!front) {
        const corners = plotOutline(w, h);
        ctx.beginPath();
        corners.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.fillStyle = "#705137";
        ctx.fill();
        ctx.save();
        ctx.clip();
        // Deterministic earth flecks remain crisp even at close zoom.
        for (let y = -16; y < (w + h) * 16; y += 1.5)
          for (let x = -h * 32; x < w * 32; x += 1.5) {
            const n = Math.abs(Math.sin(x * 71.3 + y * 37.9));
            ctx.fillStyle =
              n > 0.87
                ? "#aa8660"
                : n > 0.58
                  ? "#91704d"
                  : n > 0.27
                    ? "#80603f"
                    : "#684c34";
            ctx.fillRect(x, y, 1.5, 1);
          }
        ctx.restore();
        ctx.strokeStyle = "#bda380";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const source = this.scene.textures
        .get("construction-props")
        .getSourceImage() as HTMLImageElement;
      const cell = source.width / 2,
        cellH = source.height / 2;
      const prop = (frame: number, x: number, y: number, size: number) => {
        const p = iso(x, y);
        ctx.drawImage(
          source,
          (frame % 2) * cell,
          Math.floor(frame / 2) * cellH,
          cell,
          cellH,
          p.x - size / 2,
          p.y - size * 0.94,
          size,
          size,
        );
      };
      if (!front) {
        for (let x = 0; x < w; x++) prop(1, x, -0.25, 51);
        for (let y = 0; y < h; y++) prop(0, -0.25, y, 51);
        prop(2, w * 0.45 - 0.25, h * 0.3 - 0.25, 39);
        prop(3, w * 0.7 - 0.25, h * 0.6 - 0.25, 34);
      } else {
        // A low front workbench leaves the workers and their tasks visible.
        prop(1, w - 1, h - 0.35, 35);
        prop(0, w - 0.35, 0, 35);
      }
      texture.refresh();
    }
    return { name, left, top };
  }
  place(sprite: Phaser.GameObjects.Image, b: Building, sim: Simulation) {
    const [w, h] = dimensions(b.kind, b.rotation, b.plot),
      p = iso(b.x, b.y);
    const height = groundHeight(b.x, b.y, sim.state.terrain);
    const place = (s: Phaser.GameObjects.Image, front: boolean) => {
      const t = this.texture(w, h, front);
      s.setTexture(t.name)
        .setOrigin(0, 0)
        .setScale(0.25)
        .setPosition(p.x + t.left, p.y + t.top - height);
    };
    place(sprite, false);
    let f = this.fronts.get(b.id);
    if (!f) {
      f = this.scene.add.image(0, 0, "construction-props");
      this.fronts.set(b.id, f);
    }
    place(f, true);
    f.setDepth((b.x + b.y + w + h - 2) * 32 + 12.5);
  }
  sync(sim: Simulation) {
    for (const [id, s] of this.fronts)
      if (!sim.building(id)?.construction) {
        s.destroy();
        this.fronts.delete(id);
      }
  }
}
