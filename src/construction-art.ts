import type Phaser from "phaser";
import { dimensions } from "./catalog.js";
import { iso, plotOutline } from "./rendering.js";
import { groundHeight } from "./terrain.js";
import type { Building, Simulation } from "./simulation.js";
import { fisheryLayout } from "./shoreline.js";
import { drawFisheryDock } from "./fishery-art.js";

/** Modular scaffold props keep their proportions; only the dirt plot changes size. */
export class ConstructionArt {
  private fronts = new Map<number, Phaser.GameObjects.Image>();
  constructor(private scene: Phaser.Scene) {}
  private texture(
    w: number,
    h: number,
    front: boolean,
    shoreRotation?: number,
    clearing = false,
  ) {
    const name = `construction-${w}-${h}-${front}-${shoreRotation ?? "land"}-${clearing}`;
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
      if(clearing){
        for(let x=0;x<w;x++)for(let y=0;y<h;y++){
          const p=iso(x,y),corners=plotOutline(1,1);
          ctx.beginPath();corners.forEach((v,i)=>i?ctx.lineTo(p.x+v.x,p.y+v.y):ctx.moveTo(p.x+v.x,p.y+v.y));ctx.closePath();
          ctx.fillStyle="#ffd1791c";ctx.fill();ctx.strokeStyle="#ffe2a1aa";ctx.lineWidth=.65;ctx.stroke();
        }
        const corners=plotOutline(w,h);
        ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.strokeStyle="#483721";ctx.lineWidth=3;ctx.stroke();
        ctx.strokeStyle="#ffdc89";ctx.lineWidth=1.6;ctx.setLineDash([5,2]);ctx.stroke();ctx.setLineDash([]);
        texture.refresh();
        return {name,left,top};
      }
      if (!front) {
        const land =
          shoreRotation === undefined
            ? { x: 0, y: 0, width: w, height: h }
            : fisheryLayout(shoreRotation).land;
        if (shoreRotation !== undefined)
          drawFisheryDock(
            ctx,
            shoreRotation,
            this.scene.textures
              .get("bridge-wood")
              .getSourceImage() as HTMLImageElement,
            0,
          );
        const offset = iso(land.x, land.y);
        const corners = plotOutline(land.width, land.height).map((p) => ({
          x: p.x + offset.x,
          y: p.y + offset.y,
        }));
        ctx.beginPath();
        corners.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.fillStyle = "#705137";
        ctx.fill();
        ctx.save();
        ctx.clip();
        // A detailed painted earth material, at the same scale on every plot.
        // Project its ground plane only; scaffolding and workers remain rigid.
        const earth = this.scene.textures
          .get("construction-earth")
          .getSourceImage() as HTMLImageElement;
        const origin = iso(-0.5, -0.5);
        ctx.transform(32, 16, -32, 16, origin.x, origin.y);
        for (let x = 0; x < w; x += 2)
          for (let y = 0; y < h; y += 2) ctx.drawImage(earth, x, y, 2, 2);
        ctx.restore();
        ctx.strokeStyle = "#8d683e";
        ctx.lineWidth = 0.4;
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
    if(b.construction?.clearance) {
      const p=iso(b.x,b.y),[w,h]=dimensions(b.kind,b.rotation,b.plot),t=this.texture(w,h,false,undefined,true);
      sprite.setTexture(t.name).setOrigin(0,0).setScale(.25)
        .setPosition(p.x+t.left,p.y+t.top-groundHeight(b.x,b.y,sim.state.terrain)).setVisible(true);
      this.fronts.get(b.id)?.setVisible(false);
      return;
    }
    sprite.setVisible(true);
    const [w, h] = dimensions(b.kind, b.rotation, b.plot),
      p = iso(b.x, b.y);
    const height = groundHeight(b.x, b.y, sim.state.terrain);
    const place = (s: Phaser.GameObjects.Image, front: boolean) => {
      const t = this.texture(
        w,
        h,
        front,
        b.kind === "fishery" ? b.rotation : undefined,
      );
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
    f.setVisible(true);
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
