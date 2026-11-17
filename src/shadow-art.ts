import {weather} from "./weather.js";
import {isLivestock} from './livestock.js';
import {lampPlacement} from "./streetlights.js";
import type Phaser from "phaser";
import { dimensions } from "./catalog.js";
import { castShadow, type Lamp } from "./lighting.js";
import { daylight } from "./daylight.js";
import { iso, cameraViewport } from "./rendering.js";
import { groundHeight } from "./terrain.js";
import {fisheryLayout} from './shoreline.js';
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
    const cloud=weather(time*4).cloud;
    const used = new Set<string>();
    for (const [source, shadow] of this.images)
      if (!live.has(source) || !source.active) {
        shadow.destroy();
        this.images.delete(source);
      }
    for (const source of casters) {
      const b = sim.building(source.getData("buildingId")),
        d = source.getData("decoration");
      if(b&&(b.kind==='farm'||isLivestock(b.kind)))continue;
      if (!b && (!d || d.kind === "fence" || d.kind === "planter")) continue;
      // The ground-shadow pass cannot clip to a narrow elevated deck.
      const pole = d?.kind === "streetlight" ? lampPlacement(sim, d) : undefined;
      if(pole?.bridge)continue;
      // Only the hut casts a land shadow; its pier shades the lower water in
      // the shared bridge/pier pass, beneath pilings, boats and decks.
      const land=b?.kind==='fishery'?fisheryLayout(b.rotation).land:undefined;
      const [w, h] = b
        ? land?[land.width,land.height]:dimensions(b.kind, b.rotation, b.plot)
        : pole
          ? [0.055, 0.055]
          : d.kind === "bench"
          ? [0.7, 0.4]
          : [0.45, 0.45];
      const gx = b ? b.x + (land?.x??0) + (w - 1) / 2 : pole?.point.x ?? d.x,
        gy = b ? b.y + (land?.y??0) + (h - 1) / 2 : pole?.point.y ?? d.y;
      const z = pole?.elevation ?? groundHeight(b?.x ?? d.x, b?.y ?? d.y, sim.state.terrain);
      const p = pole ? {...pole.screen} : iso(gx, gy);
      if (!pole) p.y -= z;
      const visible =
        source.visible &&
        p.x > v.x - 160 &&
        p.x < v.x + v.width + 160 &&
        p.y > v.y - 160 &&
        p.y < v.y + v.height + 160;
      if (!visible) {
        this.images.get(source)?.destroy();
        this.images.delete(source);
        continue;
      }
      const sun = castShadow(p.x, p.y, lamps, false),
        // A building's own windows illuminate its doorstep. They must not
        // project the entire foundation across the street as a solid block.
        lamp = b ? {x: 0, y: 2, alpha: 0.1} : castShadow(p.x, p.y, lamps, true);
      const dx = Math.round((sun.x * (1 - dark) + lamp.x * dark) / 4) * 4;
      const dy = Math.round((sun.y * (1 - dark) + lamp.y * dark) / 4) * 4;
      const shape = `${w}-${h}-${dx}-${dy}`,
        key = `ground-shadow-${shape}`;
      used.add(shape);
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
        // One continuous silhouette, blurred including its edge. Stamping
        // opaque diamonds with shadowBlur leaves hard, overlapping steps.
        const points = [...corners, ...corners.map(q => ({x:q.x + dx, y:q.y + dy}))]
          .sort((a,b) => a.x-b.x || a.y-b.y);
        const cross = (a:typeof p,b:typeof p,c:typeof p) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
        const half = (points:typeof corners) => {
          const result:typeof corners = [];
          for (const point of points) {
            while (result.length > 1 && cross(result[result.length-2],result[result.length-1],point) <= 0) result.pop();
            result.push(point);
          }
          return result.slice(0,-1);
        };
        const outline = [...half(points), ...half([...points].reverse())];
        c.filter = `blur(${pole ? 1.5 : 5}px)`;
        c.beginPath();
        outline.forEach((q,i) => i ? c.lineTo(q.x,q.y) : c.moveTo(q.x,q.y));
        c.closePath();
        c.fill();
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
        .setAlpha(sun.alpha * (1 - dark) * (1-cloud*.7) + lamp.alpha * dark)
        .setVisible(true);
    }
    // Dusk/dawn create different direction variants. Only current variants need
    // GPU memory; invisible shadows are recreated from the same geometry.
    for(const [shape,texture] of this.textures)if(!used.has(shape)){
      this.scene.textures.remove(texture.key);
      this.textures.delete(shape);
    }
  }
  clear() {
    for (const image of this.images.values()) image.destroy();
    this.images.clear();
    for(const texture of this.textures.values())this.scene.textures.remove(texture.key);
    this.textures.clear();
    this.stamp = "";
  }
}
