import Phaser from "phaser";
import { daylight, warmEmission } from "./daylight.js";
import type { Simulation } from "./simulation.js";

/** Tint the world, then restore warm light at the art's own painted pixels.
 * Lights share their source object's position, scale and depth every frame. */
export class NightArt {
  private lights = new Map<
    Phaser.GameObjects.Image,
    Phaser.GameObjects.Image
  >();
  private tintTick = "";
  constructor(private scene: Phaser.Scene) {}
  private lightTexture(sprite: Phaser.GameObjects.Image) {
    const frame = sprite.frame,
      key = `emission-${sprite.texture.key}-${frame.name}`;
    if (this.scene.textures.exists(key)) return key;
    const tex = this.scene.textures.createCanvas(
      key,
      frame.cutWidth,
      frame.cutHeight,
    )!;
    const ctx = tex.context;
    ctx.drawImage(
      sprite.texture.getSourceImage() as CanvasImageSource,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      0,
      0,
      frame.cutWidth,
      frame.cutHeight,
    );
    const pixels = ctx.getImageData(0, 0, frame.cutWidth, frame.cutHeight);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const d = pixels.data,
        strength = warmEmission(d[i], d[i + 1], d[i + 2], d[i + 3]);
      d[i] = 255;
      d[i + 1] = 178;
      d[i + 2] = 65;
      const y = Math.floor(i / 4 / frame.cutWidth);
      d[i + 3] =
        y < frame.cutHeight * (sprite.getData("streetlight") ? 0.5 : 0.78)
          ? Math.round(strength * 210)
          : 0;
    }
    ctx.putImageData(pixels, 0, 0);
    const halo = document.createElement("canvas");
    halo.width = tex.width;
    halo.height = tex.height;
    const h = halo.getContext("2d")!;
    h.filter = "blur(9px)";
    h.drawImage(tex.canvas, 0, 0);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(halo, 0, 0);
    ctx.globalAlpha = 1;
    tex.refresh();
    return key;
  }
  update(sim: Simulation, time: number, sources: Phaser.GameObjects.Image[]) {
    const day = daylight(time * 4),
      dark = day.darkness;
    const tick = `${Math.floor(time * 12)}:${this.scene.children.list.length}`;
    if (tick !== this.tintTick) {
      this.tintTick = tick;
      const color = Phaser.Display.Color.GetColor(
        Math.round(255 - dark * 133),
        Math.round(255 - dark * 117),
        Math.round(255 - dark * 78),
      );
      for (const obj of this.scene.children.list) {
        const image = obj as Phaser.GameObjects.Image;
        if (
          typeof image.setTint === "function" &&
          !image.getData("emission") &&
          image.depth < 4990
        )
          image.setTint(color);
      }
      this.scene.cameras.main.setBackgroundColor(
        Phaser.Display.Color.GetColor(
          Math.round(167 - dark * 86),
          Math.round(185 - dark * 87),
          Math.round(173 - dark * 65),
        ),
      );
    }
    const keep = new Set(sources);
    for (const [source, light] of this.lights)
      if (!keep.has(source) || !source.active) {
        light.destroy();
        this.lights.delete(source);
      }
    for (const sprite of sources) {
      const buildingId = sprite.getData("buildingId"),
        b = buildingId ? sim.building(buildingId) : undefined;
      if (b?.construction) {
        this.lights.get(sprite)?.setVisible(false);
        continue;
      }
      if (!dark) {
        this.lights.get(sprite)?.setVisible(false);
        continue;
      }
      const texture = this.lightTexture(sprite);
      let light = this.lights.get(sprite);
      if (!light) {
        light = this.scene.add
          .image(0, 0, texture)
          .setData("emission", true)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.lights.set(sprite, light);
      }
      const quiet =
        b && b.kind !== "house" && b.kind !== "park" && b.kind !== "tavern"
          ? 0.45
          : 1;
      light
        .setTexture(texture)
        .setOrigin(sprite.originX, sprite.originY)
        .setScale(sprite.scaleX, sprite.scaleY)
        .setPosition(sprite.x, sprite.y)
        .setDepth(sprite.depth + 0.15)
        .setVisible(sprite.visible)
        .setAlpha(dark * quiet * 0.95);
    }
  }
  clear() {
    for (const light of this.lights.values()) light.destroy();
    this.lights.clear();
    this.tintTick = "";
  }
}
