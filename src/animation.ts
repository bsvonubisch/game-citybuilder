import {smokePuffs,weather} from "./weather.js";
import {sawmillMotion} from './sawmill-motion.js';
import {isHome,isPark} from "./catalog.js";
import type Phaser from "phaser";
import { BUILDINGS,fullProductionOutput } from "./catalog.js";
import { daylight } from "./daylight.js";
import { productionRate, outputCapacity } from "./upgrades.js";
import { nearbyDeposits } from "./deposits.js";
import { buildingArt } from "./building-art.js";
import { rotorView } from "./windmill.js";
import {
  key,
  type Building,
  type Simulation,
  type Agent,
} from "./simulation.js";

export const ROTOR_SCALE = 0.16;
const ROTOR_FRAMES = 96;
const ROTOR_SIZE = 160;

export function walkFrame(
  direction: number,
  variant: number,
  distance: number,
  waiting: boolean,
  intermediate = false,
) {
  let phase = waiting ? 1 : Math.floor(distance * 10) % 4;
  // One generated rear-view passing pose has the wrong bag; use the matching pose.
  if (!intermediate && variant === 1 && direction === 3 && phase === 1)
    phase = 3;
  return {
    frame: direction * 8 + variant * 4 + phase,
    flip: !intermediate && variant === 0 && direction === 0 && phase === 2,
  };
}

export function working(sim: Simulation, b: Building) {
  const d = BUILDINGS[b.kind],
    r = d.recipe;
  if (b.construction || !r || !b.enabled || !b.connected || b.workers < d.jobs)
    return false;
  if (
    (b.kind === "quarry" || b.kind === "mine") &&
    nearbyDeposits(b).every(id=>(sim.state.deposits[id]??0)<r.count)
  )
    return false;
  return (
    (!r.input || (b.inventory[r.input] ?? 0) >= (r.amount ?? 0)) &&
    !fullProductionOutput(b,outputCapacity(b))
  );
}

/** Pre-render the rotor's rotation into an oblique vertical plane once. */
export function createRotorFrames(scene: Phaser.Scene) {
  const source = scene.textures
    .get("mill")
    .getSourceImage() as HTMLImageElement;
  const atlas = scene.textures.createCanvas(
    "mill-rotor",
    ROTOR_SIZE * 12,
    ROTOR_SIZE * 8,
  )!;
  const ctx = atlas.context,
    cell = source.width / 2;
  for (let frame = 0; frame < ROTOR_FRAMES; frame++) {
    ctx.save();
    ctx.translate(
      (frame % 12) * ROTOR_SIZE + ROTOR_SIZE / 2,
      Math.floor(frame / 12) * ROTOR_SIZE + ROTOR_SIZE / 2,
    );
    ctx.transform(0.894427, 0.447214, 0, 1, 0, 0);
    ctx.rotate((frame * Math.PI * 2) / ROTOR_FRAMES);
    ctx.drawImage(
      source,
      cell,
      0,
      cell,
      source.height,
      (-cell * ROTOR_SCALE) / 2,
      (-source.height * ROTOR_SCALE) / 2,
      cell * ROTOR_SCALE,
      source.height * ROTOR_SCALE,
    );
    ctx.restore();
    atlas.add(
      frame,
      0,
      (frame % 12) * ROTOR_SIZE,
      Math.floor(frame / 12) * ROTOR_SIZE,
      ROTOR_SIZE,
      ROTOR_SIZE,
    );
  }
  atlas.refresh();
}

type ArtPoint = (
  b: Building,
  x: number,
  y: number,
) => { x: number; y: number; scale: number; depth: number };
export class TownAnimation {
  private effects = new Map<number, Phaser.GameObjects.Graphics>();
  private rotors = new Map<number, Phaser.GameObjects.Image>();
  private machineryTime = new Map<number, number>();
  private wheels = new Map<number, Phaser.GameObjects.Graphics>();
  constructor(
    private scene: Phaser.Scene,
    private point: ArtPoint,
  ) {}

  vehicle(
    a: Agent,
    sprite: Phaser.GameObjects.Image,
    heading: number,
    time: number,
  ) {
    let g = this.wheels.get(a.id);
    if (!g) {
      g = this.scene.add.graphics();
      this.wheels.set(a.id, g);
    }
    g.clear().setDepth(sprite.depth + 0.1);
    const driving = a.wait <= 0 && a.active !== false && (a.move ?? 1) > 0;
    g.setVisible(sprite.visible);
    const phase = driving ? time * 13 + a.id : 0;
    // Rotate the wheel details only. Rocking the pixel-art body makes its
    // nearest-neighbour pixels shimmer, especially when the camera is zoomed.
    sprite.setRotation(0);
    const left = sprite.x - sprite.displayWidth / 2,
      top = sprite.y - sprite.displayHeight * sprite.originY;
    const positions =
      heading % 2 === 1
        ? heading === 1 || heading === 5
          ? [
              [0.1, 0.88],
              [0.9, 0.88],
            ]
          : [
              [0.24, 0.85],
              [0.8, 0.85],
            ]
        : Math.floor(heading / 2) % 2 === 0
          ? [
              [0.12, 0.65],
              [0.5, 0.84],
            ]
          : [
              [0.5, 0.84],
              [0.87, 0.65],
            ];
    const r = a.kind === "truck" ? 1.2 : 1;
    for (const [u, v] of positions) {
      const x = left + u * sprite.displayWidth,
        y = top + v * sprite.displayHeight;
      const angle = phase + u;
      g.lineStyle(0.6, 0xc9b58a, 0.85);
      g.lineBetween(
        x - Math.cos(angle) * r * 0.6,
        y - Math.sin(angle) * r,
        x + Math.cos(angle) * r * 0.6,
        y + Math.sin(angle) * r,
      );
    }
  }
  update(
    sim: Simulation,
    time: number,
    dt: number,
    visible: (id: number) => boolean,
  ) {
    const liveAgents = new Set(sim.state.agents.map((a) => a.id));
    for (const [id, g] of this.wheels)
      if (!liveAgents.has(id)) {
        g.destroy();
        this.wheels.delete(id);
      }
    const liveBuildings = new Set(sim.state.buildings.map((b) => b.id));
    for (const [id, g] of this.effects)
      if (!liveBuildings.has(id)) {
        g.destroy();
        this.effects.delete(id);
        this.machineryTime.delete(id);
      }
    for (const [id, s] of this.rotors)
      if (!liveBuildings.has(id)) {
        s.destroy();
        this.rotors.delete(id);
      }
    for (const b of sim.state.buildings) {
      if(b.kind==='farm')continue;
      if (b.construction) {
        this.effects.get(b.id)?.clear();
        this.rotors.get(b.id)?.setVisible(false);
        continue;
      }
      const art = buildingArt(b.kind, b.rotation, b.houseTier);
      const active = working(sim, b);
      const phase =
        (this.machineryTime.get(b.id) ?? b.id) +
        (active
          ? dt * daylight(sim.state.tick).workRate * productionRate(b)
          : 0);
      this.machineryTime.set(b.id, phase);
      if (b.kind === "mill") {
        let rotor = this.rotors.get(b.id);
        if (!rotor) {
          rotor = this.scene.add.image(0, 0, "mill-rotor", 0);
          this.rotors.set(b.id, rotor);
        }
        const p = this.point(b, ...art.mechanism!),
          view = rotorView(b.rotation);
        rotor
          .setVisible(true)
          .setPosition(p.x, p.y)
          .setScale((p.scale * 0.7) / ROTOR_SCALE)
          .setFlipX(view.flipX)
          .setDepth(p.depth + view.depthOffset)
          .setFrame(
            (((Math.floor(phase * 12) * view.spin) % ROTOR_FRAMES) +
              ROTOR_FRAMES) %
              ROTOR_FRAMES,
          )
          .setAlpha(b.enabled ? 1 : 0.55);
      }
      if (!visible(b.id)) {this.effects.get(b.id)?.setVisible(false);this.rotors.get(b.id)?.setVisible(false);continue;}
      let g = this.effects.get(b.id);
      if (!g) {
        g = this.scene.add.graphics();
        this.effects.set(b.id, g);
      }
      g.clear().setVisible(true);
      const root = this.point(b, 0, 0);
      g.setDepth(root.depth + 0.3);
      const dot = (
        x: number,
        y: number,
        size: number,
        color: number,
        alpha = 1,
      ) => {
        const p = this.point(b, x, y);
        g!.fillStyle(color, alpha);
        g!.fillRect(
          p.x,
          p.y,
          Math.max(0.8, size * p.scale),
          Math.max(0.8, size * p.scale),
        );
      };
      const chimney = art.chimney;
      if (chimney && b.enabled && (isHome(b.kind) || active)) {
        const p=this.point(b,...chimney), industrial=!isHome(b.kind);
        for(const puff of smokePuffs(time,b.id,industrial,weather(sim.state.tick).wind)){
          g.fillStyle(0x9ba7a1,puff.alpha*.42).fillEllipse(p.x+puff.x+.6,p.y+puff.y+1,puff.radius*2.5,puff.radius*1.85,16);
          g.fillStyle(0xe2e2cd,puff.alpha).fillEllipse(p.x+puff.x,p.y+puff.y,puff.radius*1.9,puff.radius*1.6,16);
          g.fillStyle(0xf1eadb,puff.alpha*.5).fillEllipse(p.x+puff.x-puff.radius*.3,p.y+puff.y-puff.radius*.2,puff.radius,puff.radius*.8,12);
        }
      }
      // Flame motion stays inside the visible oven opening, never through a rear wall.
      if(active && art.mechanism && ((b.kind==="brickworks" && b.rotation<2)||(b.kind==="bakery" && b.rotation===0))){
        const p=this.point(b,...art.mechanism), flicker=.75+.25*Math.sin(phase*11)+.12*Math.sin(phase*23);
        g.fillStyle(0xffa32c,.38).fillEllipse(p.x,p.y,25*p.scale,25*p.scale,16);
        for(let i=0;i<3;i++){
          const h=(12+5*Math.sin(phase*12+i*2))*p.scale;
          g.fillStyle(i===1?0xfff1ae:0xffbe49,.8).fillTriangle(p.x+(i-1)*5*p.scale-3*p.scale,p.y+5*p.scale,p.x+(i-1)*5*p.scale+3*p.scale,p.y+5*p.scale,p.x+(i-1)*5*p.scale+Math.sin(phase*8+i)*2*p.scale,p.y-h*flicker);
        }
      }
      if (isPark(b.kind) && b.enabled) {
        const center = art.mechanism!,ratio=b.kind==="garden"?.5:1;
        for (let i = 0; i < 8; i++) {
          const t = (time * 0.7 + i / 8) % 1,
            side = i % 2 ? 1 : -1;
          dot(
            center[0] + side * (20 + t * 28)*ratio,
            center[1] + t * 78*ratio,
            3*ratio,
            0xd9fbf2,
            0.55,
          );
        }
      }
      if (b.kind === 'sawmill' && active) {
        const motion=sawmillMotion(b.rotation,phase);
        if(motion){
          g.lineStyle(.5,0xe2ddd0,.65);
          for(const [a,bp] of motion.strokes){
            const start=this.point(b,a.x,a.y),end=this.point(b,bp.x,bp.y);
            g.lineBetween(start.x,start.y,end.x,end.y);
          }
          for(const chip of motion.chips){
            const p=this.point(b,chip.x,chip.y);
            g.fillStyle(0xd7ad67,chip.alpha).fillRect(p.x,p.y,Math.max(.5,2*p.scale),Math.max(.4,1.4*p.scale));
          }
        }
      }
      if (b.kind === "workshop" && active && b.rotation < 2) {
        const p=this.point(b,...art.mechanism!);
        g.fillStyle(0xffb34a,.3+.1*Math.sin(phase*9)).fillEllipse(p.x,p.y,28*p.scale,23*p.scale,12);
        for(let i=0;i<3;i++){
          const age=(phase*1.5+i/3)%1;
          g.fillStyle(0xffd27b,(1-age)*.75).fillRect(p.x+Math.sin(i*2+phase)*age*4,p.y-age*7,.65,.65);
        }
      }
    }
  }
  clear() {
    for (const g of this.effects.values()) g.destroy();
    for (const g of this.wheels.values()) g.destroy();
    for (const s of this.rotors.values()) s.destroy();
    this.effects.clear();
    this.wheels.clear();
    this.rotors.clear();
    this.machineryTime.clear();
  }
}
