import {lampPlacement} from "./streetlights.js";
import type Phaser from "phaser";
import { dimensions } from "./catalog.js";
import { castShadow, type Lamp } from "./lighting.js";
import { daylight } from "./daylight.js";
import { iso, cameraViewport } from "./rendering.js";
import { groundHeight } from "./terrain.js";
import type { Simulation } from "./simulation.js";

/** Ground-only soft silhouettes: cached by plot size and light direction. */
export class ShadowArt {
  private images = new Map<
    Phaser.GameObjects.Image,
    Phaser.GameObjects.Image
  >();
  private stamp = "";
  private textures = new Map<
    string,
    { key: string; left: number; top: number }
  >();
  constructor(private scene: Phaser.Scene) {}
  update(
    sim: Simulation,
    time: number,
    casters: Phaser.GameObjects.Image[],
    lamps: readonly Lamp[],
  ) {
    const camera = this.scene.cameras.main,
      v = cameraViewport(camera);
    const stamp = `${sim.state.revision}:${Math.floor(time * 4)}:${Math.floor(v.x / 32)}:${Math.floor(v.y / 16)}:${camera.zoom}:${lamps.length}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    const live = new Set(casters),
      dark = daylight(time * 4).darkness;
    for (const [source, shadow] of this.images)
      if (!live.has(source) || !source.active) {
        shadow.destroy();
        this.images.delete(source);
      }
    for (const source of casters) {
      const b = sim.building(source.getData("buildingId")),
        d = source.getData("decoration");
      if (!b && (!d || d.kind === "fence" || d.kind === "planter")) continue;
      // The ground-shadow pass cannot clip to a narrow elevated deck.
      if(d?.kind === "streetlight" && lampPlacement(sim,d).bridge)continue;
      const [w, h] = b
        ? dimensions(b.kind, b.rotation, b.plot)
        : d.kind === "bench"
          ? [0.7, 0.4]
          : [0.45, 0.45];
      const gx = b ? b.x + (w - 1) / 2 : d.x,
        gy = b ? b.y + (h - 1) / 2 : d.y;
      const p = iso(gx, gy),
        z = groundHeight(b?.x ?? d.x, b?.y ?? d.y, sim.state.terrain);
      p.y -= z;
      const visible =
        source.visible &&
        p.x > v.x - 160 &&
        p.x < v.x + v.width + 160 &&
        p.y > v.y - 160 &&
        p.y < v.y + v.height + 160;
      if (!visible) {
        this.images.get(source)?.setVisible(false);
        continue;
      }
      const sun = castShadow(p.x, p.y, lamps, false),
        lamp = castShadow(p.x, p.y, lamps, true);
      const dx = Math.round((sun.x * (1 - dark) + lamp.x * dark) / 4) * 4;
      const dy = Math.round((sun.y * (1 - dark) + lamp.y * dark) / 4) * 4;
      const shape = `${w}-${h}-${dx}-${dy}`,
        key = `ground-shadow-${shape}`;
      let texture = this.textures.get(shape);
      if (!texture) {
        const rx = (w + h) * 17,
          ry = (w + h) * 8.5;
        const left = Math.floor(-rx - 8 + Math.min(0, dx)),
          top = Math.floor(-ry - 8 + Math.min(0, dy));
        const width = Math.ceil(rx * 2 + 16 + Math.abs(dx)),
          height = Math.ceil(ry * 2 + 16 + Math.abs(dy));
        const tex = this.scene.textures.createCanvas(
          key,
          width * 2,
          height * 2,
        )!;
        const c = tex.context;
        c.scale(2, 2);
        c.translate(-left, -top);
        const corners = [
          iso(-w / 2, -h / 2),
          iso(w / 2, -h / 2),
          iso(w / 2, h / 2),
          iso(-w / 2, h / 2),
        ];
        c.fillStyle = "#0f1b24";
        c.shadowColor = "#0f1b24";
        c.shadowBlur = 5;
        // Extrude the ground silhouette a short distance away from the light.
        for (let t = 0; t <= 1; t += 0.2) {
          c.beginPath();
          corners.forEach((q, i) =>
            i
              ? c.lineTo(q.x + dx * t, q.y + dy * t)
              : c.moveTo(q.x + dx * t, q.y + dy * t),
          );
          c.closePath();
          c.fill();
        }
        tex.refresh();
        texture = { key, left, top };
        this.textures.set(shape, texture);
      }
      let shadow = this.images.get(source);
      if (!shadow) {
        shadow = this.scene.add
          .image(0, 0, texture.key)
          .setOrigin(0)
          .setScale(0.5);
        this.images.set(source, shadow);
      }
      shadow
        .setTexture(texture.key)
        .setPosition(p.x + texture.left, p.y + texture.top)
        .setDepth(z === 0 ? -990 : (gx + gy) * 32 - 9)
        .setAlpha(sun.alpha * (1 - dark) + lamp.alpha * dark)
        .setVisible(true);
    }
  }
  clear() {
    for (const image of this.images.values()) image.destroy();
    this.images.clear();
    this.stamp = "";
  }
}
