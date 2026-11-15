import type Phaser from "phaser";
import { BUILDINGS,FRONT_DIRECTIONS } from "./catalog.js";
import { boatBerths, boatPose, fishingActive, openWater } from "./fishing.js";
import { iso } from "./rendering.js";
import {BoatWake,WAKE_LIFETIME} from './boat-wake.js';
import {sourceObject,turnPoint,viewTurn} from './view-space.js';
import {boatFloat} from './fishing-motion.js';
import {drawFishingGear} from './fishing-gear.js';
import {productionRate} from './upgrades.js';
import type { Simulation } from "./simulation.js";

/** Cached direction sprites and small water effects; no per-frame texture uploads. */
export class FishingArt {
  private boats = new Map<
    number,
    { sprite: Phaser.GameObjects.Image; wake: Phaser.GameObjects.Graphics; gear:Phaser.GameObjects.Graphics; trail:BoatWake }
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
        art.gear.destroy();
        this.boats.delete(id);
      }
    for (const b of fisheries) {
      const berth = boatBerths(b).find((p) => openWater(sim, p));
      let art = this.boats.get(b.id);
      if (!berth && !b.fishing) {
        art?.sprite.setVisible(false);
        art?.wake.clear();
        art?.gear.clear();
        art?.trail.clear();
        continue;
      }
      if (!art) {
        const sprite = this.scene.add
          .image(0, 0, "fishing-boats", 0)
          .setInteractive({ pixelPerfect: true, alphaTolerance: 64 })
          .setData("boatId", b.id);
        art = { sprite, wake: this.scene.add.graphics().setDepth(-1000.5),gear:this.scene.add.graphics(),trail:new BoatWake() };
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
      const p = iso(pose.x, pose.y);
      const sailing=!!b.fishing&&b.fishing.phase!=='fishing'&&fishingActive(b);
      const floating=boatFloat(time,b.id,sailing,!b.fishing),drift=iso(-pose.dy*floating.drift,pose.dx*floating.drift);
      const s = art.sprite;
      s.setTexture("fishing-boats", pose.frame)
        .setScale(42 / s.frame.width)
        .setOrigin(0.5, 0.76)
        .setPosition(p.x+drift.x, p.y+drift.y+floating.height)
        .setDepth((pose.x + pose.y) * 32 + 16)
        .setVisible(true);
      const g = art.wake;
      g.clear();
      const original=sourceObject(b),turn=viewTurn(sim),canonical=original.fishing
        ?boatPose(original.fishing,fishingActive(original)?elapsed:0):turnPoint(pose,-turn);
      art.trail.update(canonical,time,sailing);
      art.gear.clear();
      // Draw between the water and cached terrain: banks, piers and bridge
      // decks naturally cover the foam instead of letting it paint over them.
      const project=(x:number,y:number)=>{const q=turnPoint({x,y},turn);return iso(q.x,q.y);};
      for(const mark of art.trail.marks){
        const age=Math.max(0,time-mark.born),life=age/WAKE_LIFETIME,spread=.14+age*.15,alpha=(1-life)**1.5;
        const wobble=Math.sin(mark.born*13+age*5)*.018;
        for(const side of [-1,1]){
          const points=[0,.33,.7,1].map(t=>{
            const width=(spread+wobble)*(.3+t*.7)*side,back=t*t*.17;
            return project(mark.x-mark.dy*width-mark.dx*back,mark.y+mark.dx*width-mark.dy*back);
          });
          g.lineStyle(2.1,0x91e3da,alpha*.19).strokePoints(points,false);
          g.lineStyle(.85,0xe3fff0,alpha*.7).strokePoints(points,false);
        }
        const center=project(mark.x,mark.y);
        g.fillStyle(0xe3fff0,alpha*.4).fillEllipse(center.x,center.y,1.3+life,0.65+life*.5);
      }
      if(art.trail.moving){
        const pulse=.85+Math.sin(time*9+b.id)*.15;
        for(const side of [-1,1]){
          const points=[[.36,.06],[.2,.19],[-.06,.23],[-.3,.2]].map(([forward,width])=>iso(pose.x+pose.dx*forward-pose.dy*width*side,pose.y+pose.dy*forward+pose.dx*width*side));
          g.lineStyle(1.1,0xe3fff0,.6*pulse).strokePoints(points,false);
        }
      }else if(b.fishing?.phase==='fishing'){
        for(let i=0;i<2;i++){
          const t=(time*.3+i*.5)%1;
          g.lineStyle(.8,0xc9f2d7,(1-t)*.5).strokeEllipse(p.x,p.y+2,16+t*19,8+t*9.5);
        }
      }
      if(b.fishing?.phase==='fishing'){
        const sideClear=(side:number)=>openWater(sim,{x:Math.round(pose.x-pose.dy*.85*side),y:Math.round(pose.y+pose.dx*.85*side)});
        const side=sideClear(1)?1:sideClear(-1)?-1:0;
        if(side)drawFishingGear(art.gear,g,s,pose,side,b.progress+(fishingActive(b)?elapsed*productionRate(b):0),BUILDINGS.fishery.recipe!.seconds,time);
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
      art.gear.destroy();
    }
    this.boats.clear();
    this.route.clear();
  }
}
