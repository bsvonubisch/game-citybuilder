import Phaser from "phaser";
import { SIZE } from "./catalog.js";
import { daylight, warmEmission } from "./daylight.js";
import { windowGround, paintLightField, NIGHT_AMBIENT, type Lamp } from "./lighting.js";
import { groundHeight } from "./terrain.js";
import { iso } from "./rendering.js";
import { plazaLayout } from "./park-art.js";
import type { Simulation } from "./simulation.js";

type LightArt = { texture: string; points: { x: number; y: number }[] };

/** World-space illumination follows camera movement without rebuilding textures. */
export class NightArt {
  private lights = new Map<
    Phaser.GameObjects.Image,
    Phaser.GameObjects.Image
  >();
  private cache = new Map<string, LightArt>();
  private field: Phaser.Textures.CanvasTexture;
  private shade: Phaser.GameObjects.Image;
  private outside: Phaser.GameObjects.Graphics;
  private signature = "unpainted";
  private sourceStamp = "";
  private sources?: Phaser.GameObjects.Image[];
  private preparedAll = false;
  private left = -SIZE * 32 - 160;
  private top = -320;
  private scale = 0.5;
  lamps: Lamp[] = [];
  constructor(private scene: Phaser.Scene) {
    this.field = scene.textures.createCanvas(
      "town-light-field",
      (SIZE * 64 + 320) * this.scale,
      (SIZE * 32 + 640) * this.scale,
    )!;
    this.shade = scene.add
      .image(this.left, this.top, this.field.key)
      .setOrigin(0)
      .setScale(1 / this.scale)
      .setDepth(4989)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(false);
    // Continue the same ambient colour beyond the atlas, including off-map space.
    // The camera background stays untinted, so empty space is never darkened twice.
    const right = this.left + this.field.width / this.scale, bottom = this.top + this.field.height / this.scale;
    this.outside = scene.add.graphics().setDepth(4989).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    this.outside.fillStyle(Phaser.Display.Color.GetColor(...NIGHT_AMBIENT))
      .fillRect(-10000, -10000, 20000, this.top + 10000)
      .fillRect(-10000, bottom, 20000, 10000 - bottom)
      .fillRect(-10000, this.top, this.left + 10000, bottom - this.top)
      .fillRect(right, this.top, 10000 - right, bottom - this.top);
  }
  private lightTexture(sprite: Phaser.GameObjects.Image) {
    const frame = sprite.frame,
      key = `emission-${sprite.texture.key}-${frame.name}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
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
    const bins = new Map<number, { x: number; y: number; weight: number }>();
    for (let i = 0; i < pixels.data.length; i += 4) {
      const d = pixels.data,
        x = (i / 4) % frame.cutWidth,
        y = Math.floor(i / 4 / frame.cutWidth);
      const strength =
        y < frame.cutHeight * (sprite.getData("bridgeLantern") ? 1 : sprite.getData("streetlight") ? 0.55 : 0.82)
          ? warmEmission(d[i], d[i + 1], d[i + 2], d[i + 3])
          : 0;
      if (strength > 0.25) {
        const index =
          Math.floor((x / frame.cutWidth) * 10) +
          Math.floor((y / frame.cutHeight) * 12) * 10;
        const bin = bins.get(index) ?? { x: 0, y: 0, weight: 0 };
        bin.x += x * strength;
        bin.y += y * strength;
        bin.weight += strength;
        bins.set(index, bin);
      }
      d[i] = 255;
      d[i + 1] = 198;
      d[i + 2] = 95;
      d[i + 3] = Math.round(strength * 245);
    }
    ctx.putImageData(pixels, 0, 0);
    const points: LightArt["points"] = [];
    for (const bin of [...bins.values()].sort((a, b) => b.weight - a.weight)) {
      if (bin.weight < 3) continue;
      const p = { x: bin.x / bin.weight, y: bin.y / bin.weight };
      if (
        points.some(
          (q) =>
            Math.hypot(
              (p.x - q.x) / frame.cutWidth,
              (p.y - q.y) / frame.cutHeight,
            ) < 0.12,
        )
      )
        continue;
      points.push(p);
      if (points.length >= (sprite.getData("streetlight") ? 1 : 5)) break;
    }
    const halo = document.createElement("canvas");
    halo.width = tex.width;
    halo.height = tex.height;
    const h = halo.getContext("2d")!;
    h.filter = "blur(12px)";
    h.drawImage(tex.canvas, 0, 0);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(halo, 0, 0);
    ctx.globalAlpha = 1;
    tex.refresh();
    const result = { texture: key, points };
    this.cache.set(key, result);
    return result;
  }
  update(sim: Simulation, time: number, sources: Phaser.GameObjects.Image[]) {
    const stamp=String(sim.state.revision);
    const darkness=daylight(time*4).darkness;
    if(this.preparedAll&&this.sources===sources&&this.sourceStamp===stamp){
      for(const [source,light] of this.lights)light.setVisible(source.visible&&darkness>.01).setAlpha(darkness*(light.getData('power')??1));
      this.shade.setVisible(darkness>0).setAlpha(darkness);
      this.outside.setVisible(darkness>0).setAlpha(darkness);
      return;
    }
    this.sources=sources;this.sourceStamp=stamp;this.preparedAll=true;
    const dark = daylight(time * 4).darkness,
      keep = new Set(sources);
    for (const [source, light] of this.lights)
      if (!keep.has(source) || !source.active) {
        light.destroy();
        this.lights.delete(source);
      }
    const lamps: Lamp[] = [];
    let prepared = 0;
    for (const sprite of sources) {
      const buildingId = sprite.getData("buildingId"),
        b = buildingId&&!sprite.getData("plazaPart") ? sim.building(buildingId) : undefined;
      if (b?.construction||b?.kind==='farm') {
        this.lights.get(sprite)?.setVisible(false);
        continue;
      }
      const key = `emission-${sprite.texture.key}-${sprite.frame.name}`;
      // Prepare at most one mask per frame, even in daylight, avoiding a dusk hitch.
      if (!this.cache.has(key) && prepared++ > 0) {this.preparedAll=false;continue;}
      const art = this.lightTexture(sprite);
      const power =
        b && !["house", "park", "tavern"].includes(b.kind) ? 0.72 : 1;
      if (b?.kind === "park") {
        for (const item of plazaLayout(b.rotation).filter(
          (p) => p.kind === "lamp",
        )) {
          const p = iso(b.x + item.x, b.y + item.y);
          p.y -= groundHeight(b.x, b.y, sim.state.terrain);
          lamps.push({
            x: p.x,
            y: p.y - 24,
            groundX: p.x,
            groundY: p.y,
            radius: 53,
            power: 1,
          });
        }
      } else
        for (const point of art.points) {
          const x =
            sprite.x +
            (point.x - sprite.originX * sprite.frame.width) * sprite.scaleX;
          const y =
            sprite.y +
            (point.y - sprite.originY * sprite.frame.height) * sprite.scaleY;
          const ground = b
            ? windowGround(b, x, groundHeight(b.x, b.y, sim.state.terrain))
            : sprite.getData("lampGround") ?? { x: sprite.x, y: sprite.y - 3 };
          lamps.push({
            x,
            y,
            groundX: ground.x,
            groundY: ground.y,
            radius: b ? 38 : 62,
            power,
          });
        }
      let light = this.lights.get(sprite);
      if (!light) {
        light = this.scene.add
          .image(0, 0, art.texture)
          .setData("emission", true)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.lights.set(sprite, light);
      }
      light
        .setData('power',power)
        .setTexture(art.texture)
        .setOrigin(sprite.originX, sprite.originY)
        .setScale(sprite.scaleX, sprite.scaleY)
        .setPosition(sprite.x, sprite.y)
        .setDepth(sprite.depth + 0.001)
        .setVisible(sprite.visible && dark > 0.01)
        .setAlpha(dark * power);
    }
    const signature = lamps
      .map(
        (p) =>
          `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.groundY.toFixed(2)},${p.power}`,
      )
      .join(";");
    if (signature !== this.signature) {
      this.signature = signature;
      this.lamps = lamps;
      paintLightField(
        this.field.context,
        this.field.width,
        this.field.height,
        lamps,
        this.left,
        this.top,
        this.scale,
      );
      this.field.refresh();
    }
    this.shade.setVisible(dark > 0).setAlpha(dark);
    this.outside.setVisible(dark > 0).setAlpha(dark);
    if(this.preparedAll){
      const used=new Set([...this.lights.values()].map(light=>light.texture.key));
      for(const [key,art] of this.cache)if(!used.has(art.texture)){this.scene.textures.remove(art.texture);this.cache.delete(key);}
    }
  }
  clear() {
    for (const light of this.lights.values()) light.destroy();
    this.lights.clear();
    this.signature = "unpainted";
    this.preparedAll=false;this.sources=undefined;
    this.lamps = [];
  }
}
