import { WATER_DROP } from './water-level.js';
import {RoadWorkAlerts} from './roadwork-alerts.js';
import {ViewWorld} from './view-world.js';
import {deliveryVehicle} from './delivery-vehicles.js';
import {civilianCar} from './civilian-vehicles.js';
import {quarter} from './view-space.js';
import type {RoadWorkSite} from './roadwork-sites.js';
import {roadWorkerPosition,roadVisualState} from './roadworks.js';
import {retainSourceImages} from "./source-images.js";
import {HuntingArt,prepareHuntingFrames} from "./hunting-art.js";
import {HUNT_RADIUS,huntTargets} from "./hunting.js";
import {MarketArt,prepareVendorFrames} from "./market-art.js";
import {FarmArt} from './farm-art.js';
import {LivestockArt} from './livestock-art.js';
import {isLivestock,penRectangle} from './livestock-layout.js';
import {farmRectangle} from './farm-layout.js';
import {marketRectangle} from "./market-layout.js";
import {marketActor} from "./market.js";
import {edgeDepth,type EdgeOccluder} from "./edge-occlusion.js";
import {fenceEnds} from "./fences.js";
import {WeatherArt} from "./weather-art.js";
import {cameraViewport} from "./rendering.js";
import {isPark} from "./catalog.js";
import {PlazaArt} from "./plaza-art.js";
import {parkVisitor} from "./park-visitors.js";
import {FOUNDATION_HEIGHT} from "./foundation.js";
import Phaser from "phaser";
import {planRemoval} from "./removal.js";
import {nearestFenceSide,fenceCenter} from "./fences.js";
import {lampPoint,lampPlacement,nearestRoadEdge} from "./streetlights.js";
import { NightArt } from "./night-art.js";
import { ShadowArt } from "./shadow-art.js";
import { planRoad, type RoadPlan } from "./road-stroke.js";
import { prepareRoadSurfaces } from "./road-art.js";
import { ForestryArt, prepareForestryFrames } from "./forestry-art.js";
import {PlanterArt,planterMask} from "./planter-art.js";
import { forestCenter, forestTargets, FOREST_RADIUS } from "./forestry.js";
import { depositAt, exposedDeposit, depositTiles, nearbyDeposits, MINING_RADIUS, isExtractor } from "./deposits.js";
import { miningTargets } from "./mining.js";
import type { RoadType } from "./roads.js";
import { isService as isLeisure, serviceCoverage, servicePreview } from "./proximity.js";
import {
  setupArtworkScaling,
  updateArtworkScaling,
} from "./artwork-scaling.js";
import { rotorView } from "./windmill.js";
import {
  BUILDINGS,
  SIZE,
  dimensions,
  frontage,
  FRONT_DIRECTIONS,
  DECORATIONS,
  isBuilding,
  isDecoration,
  STEP,
  footprint,
  type Tool,
  type BuildingKind,
} from "./catalog.js";
import {
  travelFacing,
  opaqueBounds,
  buildingDepths,
  iso,
  plotOutline,
  fitGround,
  agentDistance,
  travellerDepth,
  type OccludingPlot,
} from "./rendering.js";
import { buildingArt } from "./building-art.js";
import { fisheryCells } from "./shoreline.js";
import { FishingArt } from "./fishing-art.js";
import { PlotArt } from "./plot-art.js";
import { ConstructionArt } from "./construction-art.js";
import { builderPosition, builderFrame } from "./construction.js";
import { MapTouches, gestureCamera } from "./gestures.js";
import { BuildingAlerts } from "./building-alerts.js";
import { TrafficAlerts } from "./traffic-alerts.js";
import type { TrafficQueue } from "./traffic-queues.js";
import {
  LogisticsCache,
  LOGISTICS_COLORS,
  productionActivity,
} from "./logistics.js";
import { TerrainArt } from "./terrain-art.js";
import { ElevationArt } from "./elevation-art.js";
import {
  groundHeight,
  terrainCell,
  brushCells,
  planTerrain,
  HEIGHT_STEP,
  type TerrainMode,
  type TerrainCommand,
  type TerrainPlan,
} from "./terrain.js";
import { WaterArt } from "./water-art.js";
import { lanePose, lanePoint, LANE_OFFSET } from "./traffic.js";
import { laneCuts } from "./lanes.js";
import { BridgeArt } from "./bridge-art.js";
import { FenceArt } from "./fence-art.js";
import { roadHeight, RoadHeightCache } from "./bridges.js";
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
  type Agent,
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
  readonly view:ViewWorld;
  get simulation(){return this.view.simulation;}
  rotateView(delta:number){
    if(!this.ready)return;
    const c=this.cameras.main,p=this.view.from({x:c.midPoint.x/64+c.midPoint.y/32,y:c.midPoint.y/32-c.midPoint.x/64});
    this.cancelPlacement();this.clearBuildingHover();this.hover=null;
    this.view.setTurn(this.view.turn+delta);this.rotation=quarter(this.rotation+delta);
    this.animation.clear();this.nightArt.clear();this.shadowArt.clear();this.huntingArt.clear();this.roadWorkAlerts.clear();this.trafficAlerts.clear();this.buildingAlerts.clear();
    this.logisticsView=null;this.logisticsDrawKey='';this.deliveryDrawKey='';this.cameraKey='';
    const center=this.view.to(p),v=iso(center.x,center.y);c.centerOn(v.x,v.y);this.redraw();this.onCamera();
    try{localStorage.setItem('littleworks-view-turn',String(this.view.turn));}catch{}
  }
  tool: Tool = "inspect";
  movingBuilding: number | null = null;
  selected: number | null = null;
  guidanceBuilding: number | null = null;
  selectedAgent: number | null = null;
  selectedRoadWorks:number[]=[];
  onSelectRoadWork:(site:RoadWorkSite)=>void=()=>{};
  private roadWorkAlerts!:RoadWorkAlerts;
  onSelectAgent: (id: number) => void = () => {};
  onSelectBoat: (id: number) => void = () => {};
  showGrid = false;
  rotation: 0 | 1 | 2 | 3 = 0;
  onTile: (p: Point) => void = () => {};
  onSelect: (id: number) => void = () => {};
  onHover: (p: Point | null) => void = () => {};
  onCamera: () => void = () => {};
  onSelectTraffic: (queue: TrafficQueue) => void = () => {};
  private trafficAlerts!: TrafficAlerts;
  private terrainArt!: TerrainArt;
  private fishingArt!: FishingArt;
  private elevationArt!: ElevationArt;
  terrainMode: TerrainMode = "raise";
  terrainSize = 1;
  terrainTarget: Point | null = null;
  private terrainDrag: {
    point: Point;
    y: number;
    command: TerrainCommand;
  } | null = null;
  onTerrainPreview: (plan: TerrainPlan | null) => void = () => {};
  onTerrainApply: (command: TerrainCommand) => void = () => {};
  terrainCommand(): TerrainCommand | null {
    if (this.terrainDrag) return this.terrainDrag.command;
    return this.terrainTarget
      ? {
          type: "terrain",
          ...this.terrainTarget,
          size: this.terrainSize,
          mode: this.terrainMode,
        }
      : null;
  }
  pickTile(x: number, y: number) {
    for (let level = 6; level >= -3; level--) {
      const p = fromIso(x, y + level * HEIGHT_STEP);
      if (
        inside(p.x, p.y) &&
        terrainCell(p.x, p.y, this.simulation.state.terrain).height === level
      )
        return p;
    }
    return fromIso(x, y);
  }
  previewTerrain(p: Point) {
    this.terrainTarget = p;
    this.drawOverlay();
  }
  onCancel: () => void = () => {};
  onRemoveApply:(from:Point,to:Point)=>void=()=>{};
  onSelectDecoration:(id:number)=>void=()=>{};
  onDecorationRemove:(id:number)=>void=()=>{};
  onEyedropper:(kind:Tool,rotation:0|1|2|3,plot?:readonly[number,number])=>void=()=>{};
  onBuildingHover:(id:number|null,x:number,y:number)=>void=()=>{};
  private hoverArt?:Phaser.GameObjects.Image;
  private hoverField?:Phaser.GameObjects.Graphics;
  clearBuildingHover(){this.hoverArt?.setVisible(false);this.hoverField?.setVisible(false);this.onBuildingHover(null,0,0);}
  private buildingHover(id:number|null,x:number,y:number){
    const sprite=id?this.buildings.get(id):undefined;
    if(!sprite||this.tool!=="inspect"||this.dragging){this.clearBuildingHover();return;}
    const building=this.simulation.building(id!);
    if(building?.kind==='farm'&&!building.construction?.clearance){
      // Farms are many ground/crop sprites; their building sprite is transparent.
      // Highlight the whole plot beneath crops and people, without cloning them.
      this.hoverArt?.setVisible(false);
      const [w,h]=dimensions(building.kind,building.rotation,building.plot),p=iso(building.x,building.y);
      this.hoverField??=this.add.graphics().setDepth(-996.8);
      this.hoverField.clear().setPosition(p.x,p.y-groundHeight(building.x,building.y,this.simulation.state.terrain))
        .fillStyle(0xffedb0,.16).fillPoints(plotOutline(w,h),true)
        .lineStyle(1.2,0xffdf88,.8).strokePoints(plotOutline(w,h),true).setVisible(true);
      this.onBuildingHover(id,x,y);return;
    }
    this.hoverField?.setVisible(false);
    this.hoverArt??=this.add.image(0,0,sprite.texture.key).setBlendMode(Phaser.BlendModes.ADD);
    this.hoverArt.setTexture(sprite.texture.key,sprite.frame.name).setOrigin(sprite.originX,sprite.originY).setScale(sprite.scaleX,sprite.scaleY).setPosition(sprite.x,sprite.y).setDepth(sprite.depth+.2).setAlpha(.1).setVisible(sprite.visible);
    this.onBuildingHover(id,x,y);
  }
  roadType: RoadType = "stone";
  private marketDrag:{from:Point;to:Point;pointer:number}|null=null;
  onMarketPreview:()=>void=()=>{};
  private roadDrag: { from: Point; to: Point; pointer: number; decoration?:number } | null = null;
  onRoadPreview: (plan: RoadPlan | null) => void = () => {};
  onRoadApply: (from: Point, to: Point) => void = () => {};
  cancelRoad(resetPlots=true) {
    this.marketDrag=null;
    if(resetPlots){this.farmPlot=[1,1];this.marketPlot=[1,1];this.penPlot=[2,2];this.onMarketPreview();}
    this.roadDrag = null;
    this.onRoadPreview(null);
  }
  cancelPlacement() {
    this.cancelRoad();
    this.terrainDrag = null;
    this.terrainTarget = null;
    this.movingBuilding = null;
    this.dragging = false;
    this.moved = 0;
  }
  private plotArt!: PlotArt;
  private plazaArt!:PlazaArt;
  private marketArt!:MarketArt;
  private farmArt!:FarmArt;
  private livestockArt!:LivestockArt;
  penPlot:[number,number]=[2,2];
  farmPlot:[number,number]=[1,1];
  marketPlot: [number,number]=[1,1];
  private constructionArt!: ConstructionArt;
  private forestryArt!: ForestryArt;
  private huntingArt!:HuntingArt;
  private planterArt!: PlanterArt;
  private buildingAlerts!: BuildingAlerts;
  private cameraKey = "";
  private bridgeArt!: BridgeArt;
  private fenceArt!: FenceArt;
  private occludingEdges:EdgeOccluder[]=[];
  private waterArt!: WaterArt;
  private routeOverlay!: Phaser.GameObjects.Graphics;
  private logisticsRoutes!: Phaser.GameObjects.Graphics;
  private deliveryRoutes!: Phaser.GameObjects.Graphics;
  private deliveryDrawKey = "";
  private logisticsCache = new LogisticsCache();
  private logisticsDrawKey = "";
  private logisticsView: ReturnType<LogisticsCache["get"]> = null;
  private decorationGhost?: Phaser.GameObjects.Image;
  private gridCache!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Graphics;
  private frontOverlay!: Phaser.GameObjects.Graphics;
  private trees: Phaser.GameObjects.Image[] = [];
  private buildings = new Map<number, Phaser.GameObjects.Image>();
  private occludingPlots: OccludingPlot[] = [];
  private people = new Map<number, Phaser.GameObjects.Image>();
  private waterEffects!: Phaser.GameObjects.Graphics;
  private waterPoints: Point[] = [];
  private animation!: TownAnimation;
  private nightArt!: NightArt;
  private weatherArt!: WeatherArt;
  private shadowArt!: ShadowArt;
  private lightSources: Phaser.GameObjects.Image[] = [];
  private travellerScales = new Map<string, number>();
  private ghost?: Phaser.GameObjects.Image;
  private ghostRotor?: Phaser.GameObjects.Image;
  private hover: Point | null = null;
  private dragging = false;
  private touches = new MapTouches();
  private moved = 0;
  private lastPointer = { x: 0, y: 0 };
  private acc = 0;
  private renderRevision = -1;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  speed = 1;
  ready = false;
  private roadHeights=new RoadHeightCache();
  private workRoadHeights=new RoadHeightCache();
  constructor(simulation: Simulation) {
    super("Town");
    this.view = new ViewWorld(simulation);
    const saved=Number(localStorage.getItem('littleworks-view-turn')??0);this.view.setTurn(Number.isInteger(saved)?saved:0);
  }
  preload() {
    retainSourceImages(this);
    for (const texture of new Set((Object.keys(BUILDINGS) as BuildingKind[]).map(kind=>buildingArt(kind).texture)))this.load.image(texture,`/${texture}.png`);
    this.load.image("building-house-2", "/building-house-2.png");
    this.load.image("building-house-3", "/building-house-3.png");
    this.load.image("market-produce","/market-produce.png");
    this.load.image("market-vendors","/market-vendors.png");
    for(const animal of ['cow','chicken','pig'])this.load.image(`livestock-${animal}`,`/livestock-${animal}.png`);
    this.load.image("park-benches", "/park-benches.png");
    this.load.image("foundation-stone", "/foundation-stone.png");
    this.load.image("garden", "/garden-sprites.png");
    this.load.image("props", "/town-props.png");
    this.load.image("vehicles", "/vehicles-directions.png");
    this.load.image('delivery-industrial','/delivery-industrial-v1.png');
    this.load.image('delivery-town','/delivery-town-v1.png');
    this.load.image('civilian-cars','/civilian-cars-v1.png');
    this.load.image("walkers", "/pedestrian-walk.png");
    this.load.image("vehicles-turns", "/vehicles-turns.png");
    this.load.image("walkers-turns", "/pedestrian-turns.png");
    this.load.image("meadow", "/meadow-hd.png");
    this.load.image("slate", "/slate-hd.png");
    this.load.image("shore", "/shore-details.png");
    this.load.image("bridge-wood", "/bridge-wood.png");
    this.load.image("deposits", "/alpine-deposits.png");
    this.load.image("brook", "/brook-hd.png");
    this.load.image("mill", "/windmill-parts.png");
    this.load.image("construction-props", "/construction-props.png");
    this.load.image("construction-earth", "/construction-earth.png");
    this.load.image("construction-workers", "/construction-workers.png");
    this.load.image("wildlife","/wildlife-deer.png");
    this.load.image("hunters","/hunter-workers.png");
    this.load.image("hunter-walk","/hunter-walk.png");
    this.load.image("forestry", "/forestry-workers.png");
    this.load.image("mining", "/mining-workers.png");
    this.load.image("farm-workers","/farm-workers.png");
    this.load.image("planter-plants", "/planter-plants.png");
    this.load.image("fence-pickets", "/fence-pickets.png");
    this.load.image("streetlamp", "/streetlight-copper.png");
    this.load.image("fishing-boats", "/fishing-boats.png");
  }
  create() {
    setupArtworkScaling(this.game);
    prepareRoadSurfaces(this);
    prepareForestryFrames(this);
    prepareForestryFrames(this,"mining");
    this.forestryArt=new ForestryArt(this);
    prepareHuntingFrames(this);this.huntingArt=new HuntingArt(this);this.events.once("shutdown",()=>this.huntingArt.clear());
    this.planterArt=new PlanterArt(this);
    this.events.once("shutdown",()=>this.forestryArt.clear());
    this.nightArt = new NightArt(this);
    this.weatherArt = new WeatherArt(this);
    this.shadowArt = new ShadowArt(this);
    this.plotArt = new PlotArt(this);
    this.constructionArt = new ConstructionArt(this);
    this.plazaArt=new PlazaArt(this);
    this.marketArt=new MarketArt(this);prepareVendorFrames(this);this.farmArt=new FarmArt(this);
    this.livestockArt=new LivestockArt(this);this.events.once('shutdown',()=>this.livestockArt.clear());
    const builderTexture = this.textures.get("construction-workers"),
      builderSource = builderTexture.getSourceImage() as HTMLImageElement;
    for (let frame = 0; frame < 16; frame++)
      builderTexture.add(
        frame,
        0,
        Math.floor(((frame % 4) * builderSource.width) / 4),
        Math.floor((Math.floor(frame / 4) * builderSource.height) / 4),
        Math.floor(builderSource.width / 4),
        Math.floor(builderSource.height / 4),
      );
    this.buildingAlerts = new BuildingAlerts(
      document.querySelector("#building-alerts")!,
      (id) => this.onSelect(id),
    );
    this.roadWorkAlerts=new RoadWorkAlerts(this,document.querySelector("#roadwork-alerts")!,site=>this.onSelectRoadWork(site));
    this.events.once("shutdown",()=>this.roadWorkAlerts.clear());
    this.trafficAlerts = new TrafficAlerts(
      this,
      document.querySelector("#traffic-alerts")!,
      (queue) => this.onSelectTraffic(queue),
    );
    this.events.once("shutdown", () => this.trafficAlerts.clear());
    this.events.once("shutdown", () => this.buildingAlerts.clear());
    this.trimAtlas("vehicles", 4, 4);
    this.trimAtlas('delivery-industrial',8,4);
    this.trimAtlas('delivery-town',8,4);
    this.trimAtlas('civilian-cars',8,4);
    this.trimAtlas("walkers", 8, 4);
    this.trimAtlas("vehicles-turns", 4, 4);
    this.trimAtlas("walkers-turns", 8, 4);
    this.trimAtlas("deposits", 4, 2);
    this.trimAtlas("shore", 4, 2);
    this.trimAtlas("garden", 4, 4);
    this.trimAtlas("props", 2, 2);
    this.trimAtlas("streetlamp",1,1);
    this.trimAtlas("mill", 2, 1);
    this.trimAtlas("fishing-boats", 2, 2);
    this.fishingArt = new FishingArt(this);
    createRotorFrames(this);
    this.animation = new TownAnimation(this, (b, x, y) =>
      this.artPoint(b, x, y),
    );
    this.waterArt = new WaterArt(this);
    this.terrainArt = new TerrainArt(this);
    this.elevationArt = new ElevationArt(this);
    this.bridgeArt = new BridgeArt(this);
    this.fenceArt = new FenceArt(this);
    this.gridCache = this.add.container(0, 0).setDepth(-999).setVisible(false);

    this.overlay = this.add.graphics().setDepth(5000);
    this.frontOverlay = this.add.graphics().setDepth(5004);
    this.routeOverlay = this.add.graphics().setDepth(4999);
    this.logisticsRoutes = this.add.graphics().setDepth(4998);
    this.deliveryRoutes = this.add.graphics().setDepth(4998.5);
    this.waterEffects = this.add.graphics().setDepth(-1000.5).setY(WATER_DROP);
    this.cameras.main.setBackgroundColor("#a7b9ad");
    this.cameras.main.setRoundPixels(false);
    this.redraw();
    this.centerTown();
    this.ready = true;
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE",
      false,
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer,over:Phaser.GameObjects.GameObject[]=[]) => {
      this.clearBuildingHover();
      if (p.button === 2 && this.tool !== "inspect") {
        this.onCancel();
        return;
      }
      if (p.wasTouch) {
        this.touches.start(p.id, { x: p.x, y: p.y });
        if (this.touches.count > 1) { this.cancelRoad(); this.drawOverlay(); return; }
      }
      if((this.tool==="market"||this.tool==='farm'||isLivestock(this.tool))&&(p.wasTouch||p.button===0)&&!this.keys.SPACE.isDown){
        const world=this.cameras.main.getWorldPoint(p.x,p.y),tile=this.pickTile(world.x,world.y);
        if(inside(tile.x,tile.y)){this.marketDrag={from:tile,to:tile,pointer:p.id};if(isLivestock(this.tool))this.penPlot=[2,2];else if(this.tool==='farm')this.farmPlot=[1,1];else this.marketPlot=[1,1];this.hover=tile;this.onMarketPreview();this.drawOverlay();}return;
      }
      if ((this.tool === "road" || this.tool === "bulldoze") && (p.wasTouch || p.button === 0) && !this.keys.SPACE.isDown) {
        const world = this.cameras.main.getWorldPoint(p.x,p.y);
        const hit=this.tool==="bulldoze"?over.find(o=>o.getData("buildingId")||o.getData("decoration")):undefined;
        const b=hit?.getData("buildingId")?this.simulation.building(hit.getData("buildingId")):undefined;
        const tile = b?{x:b.x,y:b.y}:hit?.getData("decoration")??this.pickTile(world.x,world.y);
        if (inside(tile.x,tile.y)) { this.roadDrag = { from: tile, to: tile, pointer: p.id,decoration:(hit?.getData("decoration")?.edge!==undefined||hit?.getData("decoration")?.side!==undefined)?hit?.getData("decoration")?.id:undefined }; this.drawOverlay(); }
        return;
      }
      if (p.wasTouch) return;
      if (
        this.tool === "terrain" &&
        p.button === 0 &&
        !this.keys.SPACE.isDown
      ) {
        const world = this.cameras.main.getWorldPoint(p.x, p.y),
          point = this.pickTile(world.x, world.y);
        if (inside(point.x, point.y)) {
          this.terrainTarget = point;
          this.terrainDrag = {
            point,
            y: p.y,
            command: {
              type: "terrain",
              ...point,
              size: this.terrainSize,
              mode: this.terrainMode,
            },
          };
          this.drawOverlay();
        }
        return;
      }
      this.dragging =
        p.rightButtonDown() ||
        p.middleButtonDown() ||
        this.keys.SPACE.isDown ||
        this.tool === "inspect";
      this.moved = 0;
      this.lastPointer = { x: p.x, y: p.y };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer,over:Phaser.GameObjects.GameObject[]=[]) => {
      if(p.isDown&&this.marketDrag?.pointer===p.id&&(this.tool==="market"||this.tool==='farm'||isLivestock(this.tool))){
        if(p.wasTouch)this.touches.move(p.id,{x:p.x,y:p.y});
        const world=this.cameras.main.getWorldPoint(p.x,p.y),tile=this.pickTile(world.x,world.y),rect=(isLivestock(this.tool)?penRectangle:this.tool==='farm'?farmRectangle:marketRectangle)(this.marketDrag.from,tile);
        this.marketDrag.to=tile;if(isLivestock(this.tool))this.penPlot=rect.plot;else if(this.tool==='farm')this.farmPlot=rect.plot;else this.marketPlot=rect.plot;this.hover={x:rect.x,y:rect.y};this.onMarketPreview();this.drawOverlay();return;
      }
      if(!p.wasTouch&&!p.isDown)this.buildingHover(over.find(o=>o.getData("buildingId"))?.getData("buildingId")??null,p.x,p.y);
      if (p.isDown && this.roadDrag?.pointer === p.id && (this.tool === "road"||this.tool === "bulldoze")) {
        if (p.wasTouch) this.touches.move(p.id, {x:p.x,y:p.y});
        const world = this.cameras.main.getWorldPoint(p.x,p.y), tile = this.pickTile(world.x,world.y);
        if (tile.x !== this.roadDrag.to.x || tile.y !== this.roadDrag.to.y) {
          this.roadDrag.to = tile; this.hover = tile; this.drawOverlay();
        }
        return;
      }
      if (p.wasTouch && p.isDown) {
        const gesture = this.touches.move(p.id, { x: p.x, y: p.y });
        if (gesture) {
          const c = this.cameras.main,
            next = gestureCamera(c, gesture);
          c.setZoom(next.zoom).setScroll(next.scrollX, next.scrollY);
          this.clampCamera();
          this.hover = null;
          this.drawOverlay();
        }
        return;
      }
      if (p.isDown && this.terrainDrag) {
        if (this.terrainMode === "raise" || this.terrainMode === "lower") {
          const steps = Math.round((this.terrainDrag.y - p.y) / 24);
          this.terrainDrag.command = {
            type: "terrain",
            ...this.terrainDrag.point,
            size: this.terrainSize,
            mode:
              steps === 0 ? this.terrainMode : steps > 0 ? "raise" : "lower",
            steps: Math.min(9, Math.max(1, Math.abs(steps))),
          };
        }
        this.drawOverlay();
        return;
      }
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
      const t = this.pickTile(wp.x, wp.y);
      if(this.tool==="fence"||(this.tool==="streetlight"&&this.simulation.roads.has(key(t)))) {
        const y=wp.y+groundHeight(t.x,t.y,this.simulation.state.terrain);
        const raw={x:wp.x/64+y/32,y:y/32-wp.x/64};
        const edge=(this.tool==="fence"?nearestFenceSide(t,raw):nearestRoadEdge(this.simulation.roads,t,raw)) as 0|1|2|3;
        if(edge!==this.rotation){this.rotation=edge;this.drawOverlay();}
      }
      const hover = inside(t.x, t.y) ? t : null;
      if (hover?.x !== this.hover?.x || hover?.y !== this.hover?.y) {
        this.hover = hover;
        if (this.tool === "terrain") this.terrainTarget = hover;
        this.onHover(this.hover);
        this.drawOverlay();
      }
    });
    this.input.on(
      "pointerup",
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if(!p.wasTouch&&p.button===1&&this.moved<6){
          const hit=over.find(o=>o.getData("buildingId")),b=hit&&this.simulation.building(hit.getData("buildingId"));
          if(b)this.onEyedropper(b.kind,b.rotation,b.plot);
          else {const d=over.find(o=>o.getData("decoration"))?.getData("decoration");if(d)this.onEyedropper(d.kind,d.side??d.edge??0);}
        }
        if (!p.wasTouch && p.button !== 0) {
          this.dragging = false;
          return;
        }
        if(this.marketDrag?.pointer===p.id&&(this.tool==="market"||this.tool==='farm'||isLivestock(this.tool))){
          const rect=(isLivestock(this.tool)?penRectangle:this.tool==='farm'?farmRectangle:marketRectangle)(this.marketDrag.from,this.marketDrag.to);this.marketDrag=null;
          if(p.wasTouch)this.touches.end(p.id);
          if(p.event.type!=="touchcancel"){if(isLivestock(this.tool))this.penPlot=rect.plot;else if(this.tool==='farm')this.farmPlot=rect.plot;else this.marketPlot=rect.plot;this.onTile({x:rect.x,y:rect.y});}
          this.cancelRoad();
          this.drawOverlay();return;
        }
        if (this.roadDrag?.pointer === p.id && (this.tool === "road"||this.tool === "bulldoze")) {
          const draft = this.roadDrag;
          this.roadDrag = null;
          if (p.wasTouch) this.touches.end(p.id);
          this.onRoadPreview(null);
          if (p.event.type !== "touchcancel") {
            const world = this.cameras.main.getWorldPoint(p.x, p.y);
            if(this.tool==="bulldoze"){
              if(draft.decoration&&key(draft.from)===key(draft.to))this.onDecorationRemove(draft.decoration);
              else this.onRemoveApply(draft.from,draft.to);
            }
            else this.onRoadApply(draft.from, this.pickTile(world.x, world.y));
          }
          this.drawOverlay();
          return;
        }
        if (this.terrainDrag && !p.wasTouch) {
          const command = this.terrainDrag.command;
          this.terrainDrag = null;
          this.onTerrainApply(command);
          return;
        }
        if (p.wasTouch) {
          if (p.event.type === "touchcancel") this.touches.cancel();
          else this.touches.move(p.id, { x: p.x, y: p.y });
        }
        const tap = p.wasTouch
          ? this.touches.end(p.id)
          : this.moved < 6 && p.button === 0 && !this.keys.SPACE.isDown;
        // Road releases are handled only by the live draft above. A cancelled
        // drag or a pinch must never fall through to single-tile placement.
        if (tap && this.tool !== "road" && this.tool !== "bulldoze" && this.tool !== "market") {
          const boatHit =
            this.tool === "inspect"
              ? over.find((o) => o.getData("boatId"))
              : null;
          const agentHit =
            this.tool === "inspect"
              ? over.find((o) => o.getData("agentId"))
              : null;
          const decorationHit =
            this.tool === "inspect"
              ? over.find((o) => o.getData("decoration"))
              : null;
          const hit =
            this.tool === "inspect"
              ? over.find((o) => o.getData("buildingId"))
              : null;
          if (boatHit) this.onSelectBoat(boatHit.getData("boatId"));
          else if (agentHit) this.onSelectAgent(agentHit.getData("agentId"));
          else if (decorationHit)
            this.onSelectDecoration(decorationHit.getData("decoration").id);
          else if (hit) this.onSelect(hit.getData("buildingId"));
          else {
            const wp = this.cameras.main.getWorldPoint(p.x, p.y),
              t = this.pickTile(wp.x, wp.y);
            if (inside(t.x, t.y)) {
              if(this.tool==="fence"||(this.tool==="streetlight"&&this.simulation.roads.has(key(t)))){
                const y=wp.y+groundHeight(t.x,t.y,this.simulation.state.terrain);
                const raw={x:wp.x/64+y/32,y:y/32-wp.x/64};
                this.rotation=(this.tool==="fence"?nearestFenceSide(t,raw):nearestRoadEdge(this.simulation.roads,t,raw)) as 0|1|2|3;
              }
              this.onTile(t);
            }
          }
        }
        this.dragging = false;
      },
    );
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => {
      this.cancelRoad();
      this.terrainDrag = null;
      if (p.wasTouch) this.touches.end(p.id);
      this.dragging = false;
    });
    this.game.events.on("blur", () => { this.touches.cancel(); this.cancelRoad(); this.drawOverlay(); });
    this.input.on("gameout", () => {
      this.clearBuildingHover();
      this.cancelRoad();
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
    const p=this.view.to({x:13.5,y:15}),center = iso(p.x,p.y);
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
    // Clamp the viewport center, independent of zoom and screen resolution.
    const x = c.scrollX + c.width / 2,
      y = c.scrollY + c.height / 2;
    c.scrollX += Phaser.Math.Clamp(x, -SIZE * 32, SIZE * 32) - x;
    c.scrollY += Phaser.Math.Clamp(y, -80, SIZE * 32 + 80) - y;
  }
  focusTile(x: number, y: number) {
    const v=this.view.to({x,y}),p = iso(v.x,v.y);
    this.cameras.main.centerOn(p.x, p.y);
    this.onCamera();
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
      // The narrow front views have a few pixels from adjacent atlas cells
      // in their outer gutters. Keep those outside the frame bounds.
      const inset = name==='civilian-cars'&&i%columns===1?Math.floor(w*.15):0;
      const contentWidth = w-inset*2;
      const bounds = opaqueBounds(
        context.getImageData(x+inset, y, contentWidth, h).data,
        contentWidth,
        h,
      );
      texture.add(
        i,
        0,
        x + inset + bounds.x,
        y + bounds.y,
        bounds.width,
        bounds.height,
      );
    }
  }
  private placeSprite(
    sprite: Phaser.GameObjects.Image,
    kind: BuildingKind,
    x: number,
    y: number,
    rotation = 0,
    plot?: readonly [number, number],
    houseTier: Building["houseTier"] = 1,
  ) {
    if(kind==='farm'){if(sprite.getData('buildingId'))this.farmArt.place(sprite,{kind,x,y,rotation,plot});else this.farmArt.preview(sprite,x,y,plot??[2,2],this.tool==='move'?this.simulation.building(this.movingBuilding!)?.crop??null:null);}
    else this.plotArt.place(sprite, kind, x, y, rotation, plot, houseTier);
    sprite.y -= groundHeight(x, y, this.simulation.state.terrain);
  }
  private travellerScale(a: Agent, row: number, texture: string) {
    if(texture==='civilian-cars'){
      let scale=this.travellerScales.get('civilian-common');
      if(scale===undefined){
        const atlas=this.textures.get(texture),width=[8,10,12,14].reduce((n,frame)=>n+atlas.get(frame).width,0)/4;
        scale=29/width;this.travellerScales.set('civilian-common',scale);
      }
      return scale;
    }
    if(texture.startsWith('delivery-')){
      // Both sheets share one chassis scale; front views remain naturally
      // narrower and changing cargo or turning never enlarges the vehicle.
      let scale=this.travellerScales.get('delivery-common');
      if(scale===undefined){
        const atlas=this.textures.get('delivery-industrial');
        const width=[0,2,4,6].reduce((n,frame)=>n+atlas.get(frame).width,0)/4;
        scale=33.64/width;this.travellerScales.set('delivery-common',scale);
      }
      return scale;
    }
    const cacheKey = `${a.kind}:${row}:${texture}`;
    const cached = this.travellerScales.get(cacheKey);
    if (cached !== undefined) return cached;
    const person = a.kind === "person",
      base = person ? "walkers" : "vehicles";
    const original = this.textures.get(base),
      variant = this.textures.get(texture);
    const source = original.getSourceImage() as HTMLImageElement;
    const target = variant.getSourceImage() as HTMLImageElement;
    const frames = person
      ? Array.from(
          { length: 16 },
          (_, i) =>
            original.get(Math.floor(i / 4) * 8 + (a.id % 2) * 4 + (i % 4))
              .height,
        )
      : Array.from({ length: 4 }, (_, i) => original.get(row * 4 + i).width);
    const size = frames.reduce((sum, n) => sum + n, 0) / frames.length;
    const scale =
      (((person ? 22 : a.kind === "truck" ? 33.64 : 29) / size) * source.height) /
      target.height;
    this.travellerScales.set(cacheKey, scale);
    return scale;
  }
  private artPoint(b: Building, x: number, y: number) {
    const sprite = this.buildings.get(b.id)!;
    const p = this.plotArt.point(b.kind, b.rotation, x, y, b.plot, b.houseTier),
      origin = iso(b.x, b.y);
    return {
      ...p,
      x: origin.x + p.x,
      y: origin.y + p.y - groundHeight(b.x, b.y, this.simulation.state.terrain),
      depth: sprite.depth,
    };
  }
  redraw() {
    this.constructionArt.sync(this.simulation);
    this.renderRevision = this.simulation.state.revision;
    this.terrainArt.redraw(this.simulation);
    this.elevationArt.redraw(this.simulation);
    this.waterArt.redraw(this.simulation);
    this.bridgeArt.redraw(this.simulation);
    this.trees.forEach((t) => t.destroy());
    this.trees = [];
    this.waterPoints = [];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const p = iso(x, y),
          h = hash(x, y),
          water = terrain(x, y, this.simulation.state.terrain) === "water",
          road = this.simulation.roads.has(key({ x, y }));
        const occupied = this.simulation.buildingAt(x, y);
        if (water && !road && h > 0.78) {
          const bank = [
            { x: x - 1, y },
            { x, y: y - 1 },
            { x: x + 1, y },
            { x, y: y + 1 },
          ].find(
            (n) =>
              inside(n.x, n.y) &&
              terrain(n.x, n.y, this.simulation.state.terrain) === "land" &&
              !this.simulation.roads.has(key(n)),
          );
          if (bank) {
            const foot = iso(x + (bank.x - x) * 0.4, y + (bank.y - y) * 0.4);
            const reeds = this.add
              .image(foot.x, foot.y + WATER_DROP, "shore", 4 + Math.floor(h * 4))
              .setOrigin(0.5, 1);
            reeds
              .setScale((12 + h * 8) / reeds.frame.height)
              .setDepth((x + y) * 32 + 5);
            this.trees.push(reeds);
          }
        }
        if (water && !road && h > 0.45) this.waterPoints.push(p);
        if (water || road || (occupied&&!occupied.construction?.clearance)) continue;
        const deposit=depositAt(this.view.from({x,y}));
        if (deposit && exposedDeposit(this.simulation.state,{x,y}) && !this.simulation.state.decorations.some(d=>d.x===x&&d.y===y&&d.side===undefined)) {
          const frame =
            (DEPOSITS[deposit] === "metal" ? 4 : 0) + Math.floor(h * 4);
          const rock = this.add.image(0, 0, "deposits", frame).setOrigin(0, 0);
          const w = rock.frame.width,
            ht = rock.frame.height;
          const fit = fitGround(
            [
              [0, ht * 0.8],
              [w * 0.43, ht],
              [w, ht * 0.8],
            ],
            .7,
            .7,
          );
          rock
            .setScale(fit.scale)
            .setPosition(
              p.x + fit.x,
              p.y + fit.y + 4.8 - groundHeight(x, y, this.simulation.state.terrain),
            )
            .setDepth((x + y) * 32 + 6).setData("depositPoint",{x,y});
          this.trees.push(rock);
          continue;
        }
      }
    for (const d of this.simulation.state.decorations) {
      const def = DECORATIONS[d.kind],
        position=d.kind==="streetlight"?lampPoint(d):d.kind==="fence"?fenceCenter(d):d,
        p = iso(position.x, position.y);
      const sprite = this.add
        .image(p.x, p.y + (d.kind==="streetlight"?0:3), def.texture, def.frame)
        .setOrigin(0.5, 1)
        .setDepth((position.x + position.y) * 32 + 5)
        .setData("decoration", d)
        .setInteractive({ pixelPerfect: true });
      sprite.setScale(def.height / sprite.frame.height);
      if(d.kind==="planter")this.planterArt.place(sprite,d.x,d.y,planterMask(d,this.simulation.state.decorations,p=>groundHeight(p.x,p.y,this.simulation.state.terrain),p=>!!this.simulation.buildingAt(p.x,p.y)&&!this.simulation.buildingAt(p.x,p.y)?.construction));
      if (d.kind === "fence")
        this.fenceArt.place(
          sprite,
          d,
          this.simulation.state.decorations,
        );
      if(d.kind==="streetlight"){const placement=lampPlacement(this.simulation,d);sprite.setPosition(placement.screen.x,placement.screen.y);sprite.setData("lampGround",placement.screen);}else sprite.y -= groundHeight(d.x, d.y, this.simulation.state.terrain);
      sprite.setData("streetlight", d.kind === "streetlight");
      this.trees.push(sprite);
    }
    for (const [id, sprite] of this.buildings) {
      if (!this.simulation.building(id)) {
        sprite.destroy();
        this.buildings.delete(id);
      }
    }
    for (const b of this.simulation.state.buildings) {
      let s = this.buildings.get(b.id);
      const [w, h] = dimensions(b.kind, b.rotation, b.plot);
      if (!s) {
        s = this.add
          .image(0, 0, "__DEFAULT")
          .setOrigin(0.5, 1)
          .setData("buildingId", b.id)
          .setInteractive({ pixelPerfect: true });
        this.buildings.set(b.id, s);
      }
      if (b.construction&&(b.kind!=='farm'||b.construction.clearance)) this.constructionArt.place(s, b, this.simulation);
      else
        this.placeSprite(s, b.kind, b.x, b.y, b.rotation, b.plot, b.houseTier);
      s.setDepth(b.construction?.clearance ? 4992 : (b.x + b.y + w + h - 2) * 32 + 12).setAlpha(
        b.enabled ? 1 : 0.55,
      );
    }
    const ordered=buildingDepths(this.simulation.state.buildings.filter(b=>b.kind!=='farm'&&!b.construction?.clearance).map(b=>{
      const s=this.buildings.get(b.id)!,[width,height]=dimensions(b.kind,b.rotation,b.plot);
      return {id:b.id,x:b.x,y:b.y,width,height,depth:s.depth,left:s.x,right:s.x+s.displayWidth,top:s.y,bottom:s.y+s.displayHeight};
    }));
    for(const [id,depth] of ordered)this.buildings.get(id)!.setDepth(depth);
    this.marketArt.sync(this.simulation,ordered);this.farmArt.sync(this.simulation);
    this.livestockArt.sync(this.simulation,ordered);
    this.lightSources = [
      ...[...this.buildings.values()].filter(s=>!isPark(this.simulation.building(s.getData("buildingId"))?.kind??"")),
      ...this.plazaArt.sync(this.simulation,ordered),
      ...this.trees.filter((t) => t.getData("streetlight")),
    ];
    this.occludingPlots = this.simulation.state.buildings.filter(b=>b.kind!=='farm'&&!b.construction?.clearance).map((b) => {
      const s = this.buildings.get(b.id)!,
        [width, height] = dimensions(b.kind, b.rotation, b.plot);
      return {
        x: b.x,
        y: b.y,
        width,
        height,
        depth: s.depth,
        left: s.x,
        right: s.x + s.displayWidth,
        top: s.y,
        bottom: s.y + s.displayHeight,
      };
    });
    for(const rock of this.trees) {
      const decoration=rock.getData("decoration");
      // Scenery and travellers share the same ground-depth origin. A different
      // bias lets someone just behind a trunk paint over its entire canopy.
      const point=(rock.getData("depositPoint")??(decoration?.kind==="streetlight"?lampPoint(decoration):decoration?.kind==="fence"?fenceCenter(decoration):decoration)) as Point|undefined;
      if(point)rock.setDepth(travellerDepth(point,{left:rock.x-rock.displayWidth*rock.originX,right:rock.x+rock.displayWidth*(1-rock.originX),top:rock.y-rock.displayHeight*rock.originY,bottom:rock.y+rock.displayHeight*(1-rock.originY)},this.occludingPlots,decoration?.kind==="fence")+(decoration?.kind==="streetlight"&&lampPlacement(this.simulation,decoration).bridge? .3 : -.1));
    }
    this.occludingEdges=[...this.bridgeArt.edges,...this.trees.filter(t=>t.getData("decoration")?.kind==="fence").map(t=>{const d=t.getData("decoration"),[a,b]=fenceEnds(d,d.side??1);return {a,b,depth:t.depth,left:t.x,right:t.x+t.displayWidth,top:t.y,bottom:t.y+t.displayHeight};})];
    this.drawOverlay();
  }
  private diamond(p: Point, color: number, alpha: number, height?: number) {
    const v = iso(p.x, p.y);
    v.y -= height ?? groundHeight(p.x, p.y, this.simulation.state.terrain);
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
  private prepareGrid() {
    if(this.gridCache.length)return;
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
    for (let y = -16; y < SIZE * 32 + 16; y += 1024)
      for (let x = -SIZE * 32; x < SIZE * 32; x += 1024) {
        const chunk = this.add
          .renderTexture(
            x,
            y,
            Math.min(1024, SIZE * 32 - x),
            Math.min(1024, SIZE * 32 + 16 - y),
          )
          .setOrigin(0);
        chunk.draw(grid, -x, -y);
        this.gridCache.add(chunk);
      }
    grid.destroy();
  }
  drawOverlay() {
    if (!this.overlay) return;
    this.overlay.clear();
    this.frontOverlay.clear();
    this.ghost?.setVisible(false);
    this.decorationGhost?.setVisible(false);
    this.ghostRotor?.setVisible(false);
    const raised = Object.values(this.simulation.state.terrain ?? {}).some(
      (c) => c.height !== 0,
    );
    if(this.showGrid&&!raised)this.prepareGrid();
    else if(this.gridCache.length)this.gridCache.removeAll(true);
    this.gridCache.setVisible(this.showGrid && !raised);
    if (this.showGrid && raised)
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) this.diamond({ x, y }, 0xe8e9ca, 0.04);
    if (this.tool === "terrain") {
      const command = this.terrainCommand(),
        plan = command ? planTerrain(this.simulation.state, command) : null;
      if (command && plan) {
        const cells = new Map(
          [
            ...brushCells(command.x, command.y, command.size),
            ...plan.changes,
          ].map((p) => [key(p), p]),
        );
        for (const p of cells.values()) {
          const change = plan.changes.find((c) => c.x === p.x && c.y === p.y);
          const before = groundHeight(p.x, p.y, this.simulation.state.terrain),
            after = change ? change.height * HEIGHT_STEP : before;
          const color = plan.error ? 0xea8c72 : 0xa7e2a2;
          this.diamond(p, color, 0.15, before);
          if (after !== before) {
            this.diamond(p, color, 0.3, after);
            const pos = iso(p.x, p.y);
            this.overlay
              .lineStyle(1, color, 0.8)
              .lineBetween(pos.x, pos.y - before, pos.x, pos.y - after);
          }
        }
      }
      this.onTerrainPreview(plan);
      return;
    }
    if (this.selected ?? this.guidanceBuilding) {
      const b = this.simulation.building(
        (this.selected ?? this.guidanceBuilding)!,
      );
      if (b) {
        for (const p of footprint(b.kind, b.x, b.y, b.rotation, b.plot))
          this.diamond(p, 0xf3ce7b, 0.23);
        this.drawFront(b.kind, b.x, b.y, b.rotation, b.plot);
        if (isLeisure(b.kind)) this.drawCoverage(b);
        if (b.kind==="forester")this.drawForestRange(b);
        if (b.kind==="hunter")this.drawHuntRange(b);
        if (isExtractor(b.kind))this.drawMiningRange(b);
      }
    }
    if(this.tool==="bulldoze"&&this.roadDrag){
      const plan=planRemoval(this.simulation,this.roadDrag.from,this.roadDrag.to);
      for(const p of plan.tiles)this.diamond(p,plan.error?0xb65c45:0xef9b82,.4);
      return;
    }
    if (this.tool === "road") {
      const end = this.roadDrag?.to ?? this.hover;
      const plan = end ? planRoad(this.simulation, this.roadDrag?.from ?? end, end, this.roadType) : null;
      this.onRoadPreview(plan);
      if (plan) for (const p of plan.tiles) {
        const upgrading = plan.upgrades.some((q) => q.x === p.x && q.y === p.y);
        const existing = this.simulation.roads.has(key(p)) && !upgrading;
        const water = terrainCell(p.x,p.y,this.simulation.state.terrain).kind === "water";
        this.diamond(p, plan.error ? 0xe3947f : existing ? 0xbac9bc : upgrading ? 0xf0cc79 : water ? 0x72c8dd : 0x86d4a5, existing ? .14 : .4);
      }
      return;
    }
    if (this.hover && this.tool !== "inspect") {
      const moving = this.movingBuilding
        ? this.simulation.building(this.movingBuilding)
        : undefined;
      const kind = this.tool === "move" ? moving?.kind : this.tool;
      if (!kind) return;
      const plot = moving
        ? this.simulation.relocationPlot(moving, this.rotation)
        : isLivestock(kind)?this.penPlot:kind==='farm'?this.farmPlot:kind==="market"?this.marketPlot:undefined;
      const valid =
        this.tool === "bulldoze" ||
        !(this.tool === "move"
          ? this.simulation.canMove(
              moving!.id,
              this.hover.x,
              this.hover.y,
              this.rotation,
            )
          : this.simulation.canPlace(
              kind as Exclude<
                Tool,
                "inspect" | "bulldoze" | "terrain" | "move"
              >,
              this.hover.x,
              this.hover.y,
              this.rotation,
              plot,
            ));
      const b = this.simulation.buildingAt(this.hover.x, this.hover.y);
      const cells =
        this.tool === "bulldoze" && b
          ? footprint(b.kind, b.x, b.y, b.rotation, b.plot)
          : isBuilding(kind)
            ? footprint(kind, this.hover.x, this.hover.y, this.rotation, plot)
            : [this.hover];
      if (kind === "fishery" && this.tool !== "bulldoze") {
        for (const p of fisheryCells(
          this.hover.x,
          this.hover.y,
          this.rotation,
        )) {
          const matches =
            terrainCell(p.x, p.y, this.simulation.state.terrain).kind ===
            p.kind;
          this.diamond(
            p,
            matches ? (p.kind === "water" ? 0x6bd4e4 : 0xe5cb85) : 0xd78069,
            0.42,
          );
        }
      } else
        for (const p of cells)
          if(this.tool!=="fence")this.diamond(p, valid ? 0xffe5a4 : 0xd78069, 0.3);
      if (isDecoration(this.tool)) {
        const def = DECORATIONS[this.tool],
          position=this.tool==="streetlight"&&this.simulation.roads.has(key(this.hover))?lampPoint({...this.hover,edge:this.rotation}):this.hover,
          p = iso(position.x, position.y);
        this.decorationGhost ??= this.add
          .image(0, 0, def.texture, def.frame)
          .setDepth(5001)
          .setOrigin(0.5, 1);
        this.decorationGhost
          .setOrigin(0.5, 1)
          .setTexture(def.texture, def.frame)
          .setScale(
            def.height / this.textures.getFrame(def.texture, def.frame).height,
          )
          .setPosition(p.x, p.y + (this.tool==="streetlight"?0:3))
          .setAlpha(0.6)
          .setTint(valid ? 0xffffff : 0xe99385)
          .setVisible(true);
        if (this.tool === "fence")
          this.fenceArt.place(
            this.decorationGhost,
            {...this.hover,id:-1,side:this.rotation},
            this.simulation.state.decorations,
          );
        if(this.tool==="planter")this.planterArt.place(this.decorationGhost,this.hover.x,this.hover.y,planterMask(this.hover,this.simulation.state.decorations,p=>groundHeight(p.x,p.y,this.simulation.state.terrain),p=>!!this.simulation.buildingAt(p.x,p.y)&&!this.simulation.buildingAt(p.x,p.y)?.construction));
        if(this.tool==="streetlight"){const p=lampPlacement(this.simulation,{...this.hover,edge:this.simulation.roads.has(key(this.hover))?this.rotation:undefined}).screen;this.decorationGhost.setPosition(p.x,p.y);}else this.decorationGhost.y -= groundHeight(this.hover.x,this.hover.y,this.simulation.state.terrain);
      }
      if (isBuilding(kind)) {
        if(kind==="market")this.drawCoverage({...servicePreview(kind,this.hover.x,this.hover.y,this.rotation),plot});
        if(kind==="hunter")this.drawHuntRange(servicePreview(kind,this.hover.x,this.hover.y,this.rotation,moving?.level));
        if(kind==="forester")this.drawForestRange(servicePreview(kind,this.hover.x,this.hover.y,this.rotation,moving?.level));
        if(isExtractor(kind))this.drawMiningRange(servicePreview(kind,this.hover.x,this.hover.y,this.rotation,moving?.level));
        if (isLeisure(kind))
          this.drawCoverage(
            servicePreview(
              kind,
              this.hover.x,
              this.hover.y,
              this.rotation,
              moving?.level,
            ),
          );
        this.drawFront(kind, this.hover.x, this.hover.y, this.rotation, plot);
        this.ghost ??= this.add.image(0, 0, "__DEFAULT").setDepth(5001);
        this.placeSprite(
          this.ghost,
          kind,
          this.hover.x,
          this.hover.y,
          this.rotation,
          plot,
          moving?.houseTier,
        );
        this.ghost
          .setVisible(true)
          .setAlpha(0.6)
          .setTint(valid ? 0xffffff : 0xe99385);
        if (kind === "mill") {
          this.ghostRotor ??= this.add
            .image(0, 0, "mill-rotor", 0)
            .setDepth(5002);
          const art = buildingArt("mill", this.rotation),
            p = this.plotArt.point("mill", this.rotation, ...art.mechanism!),
            origin = iso(this.hover.x, this.hover.y);
          this.ghostRotor
            .setVisible(true)
            .setPosition(
              p.x + origin.x,
              p.y +
                origin.y -
                groundHeight(
                  this.hover.x,
                  this.hover.y,
                  this.simulation.state.terrain,
                ),
            )
            .setScale((p.scale * 0.7) / ROTOR_SCALE)
            .setFlipX(rotorView(this.rotation).flipX)
            .setDepth(5001 + rotorView(this.rotation).depthOffset)
            .setAlpha(0.6)
            .setTint(valid ? 0xffffff : 0xe99385);
        }
      }
    }
  }
  private drawFront(
    kind: BuildingKind,
    x: number,
    y: number,
    rotation: number,
    plot?: readonly [number, number],
    oneEdge = false,
  ) {
    if ((isPark(kind)||kind==="market"||kind==='farm') && !oneEdge) {
      for (let edge = 0; edge < 4; edge++)
        this.drawFront(kind, x, y, edge, plot, true);
      return;
    }
    const g = this.frontOverlay;
    const [w, h] = dimensions(kind, rotation, plot),
      d = FRONT_DIRECTIONS[rotation];
    const connected = frontage(
      (isPark(kind)||kind==="market"||kind==='farm') ? "house" : kind,
      x,
      y,
      rotation,
      [w, h],
    ).some(
      (p) =>
        this.simulation.roads.has(key(p)) &&
        groundHeight(p.x, p.y, this.simulation.state.terrain) ===
          groundHeight(x, y, this.simulation.state.terrain),
    );
    const color = connected ? 0x79f2b0 : 0xffce73;
    const edge = {
      x: x + (w - 1) / 2 + (d.x * w) / 2,
      y: y + (h - 1) / 2 + (d.y * h) / 2,
    };
    const from = iso(edge.x - d.x * 0.35, edge.y - d.y * 0.35),
      to = iso(edge.x + d.x * 0.35, edge.y + d.y * 0.35);
    const elevation = groundHeight(x, y, this.simulation.state.terrain);
    from.y -= elevation;
    to.y -= elevation;
    g.lineStyle(3, color, 1).lineBetween(from.x, from.y, to.x, to.y);
    const tip1 = iso(
        edge.x + d.x * 0.1 - d.y * 0.18,
        edge.y + d.y * 0.1 + d.x * 0.18,
      ),
      tip2 = iso(
        edge.x + d.x * 0.1 + d.y * 0.18,
        edge.y + d.y * 0.1 - d.x * 0.18,
      );
    tip1.y -= elevation;
    tip2.y -= elevation;
    g.lineBetween(to.x, to.y, tip1.x, tip1.y).lineBetween(
      to.x,
      to.y,
      tip2.x,
      tip2.y,
    );
    const edgeStart = iso(
        edge.x - (d.y ? w / 2 : 0),
        edge.y - (d.x ? h / 2 : 0),
      ),
      edgeEnd = iso(edge.x + (d.y ? w / 2 : 0), edge.y + (d.x ? h / 2 : 0));
    edgeStart.y -= elevation;
    edgeEnd.y -= elevation;
    g.lineStyle(2, color, 0.9).lineBetween(
      edgeStart.x,
      edgeStart.y,
      edgeEnd.x,
      edgeEnd.y,
    );
  }
  private drawAgentRoute() {
    this.routeOverlay.clear();
    this.drawProductionLogistics();
    for(const a of this.simulation.state.agents)if(a.roadWork!==undefined&&this.selectedRoadWorks.includes(a.roadWork))this.highlightWorker(a,0x7ee0c7);
    const site = this.selected ? this.simulation.building(this.selected) : null;
    if (site?.construction) {
      const crew = new Set(
        this.simulation.state.residents
          .filter((r) => r.job === site.id)
          .map((r) => r.id),
      );
      for (const member of this.simulation.state.agents) {
        if (member.resident !== null && crew.has(member.resident))
          this.highlightWorker(member, 0x7ee0c7);
      }
    }
    const a = this.simulation.state.agents.find(
      (a) => a.id === this.selectedAgent,
    );
    if (!a) return;
    if (a.onsite) {
      const workplace=this.simulation.building(a.onsite);
      const trip=workplace?.hunting?.find(t=>t.resident===a.resident)??workplace?.forestry?.find(t=>t.resident===a.resident)??workplace?.mining?.find(t=>t.resident===a.resident);
      if(trip) this.routeOverlay.lineStyle(1.5,0xffdf88,.85).strokePoints(trip.path.slice(Math.floor(trip.distance)).map(p=>{const v=iso(p.x,p.y);return{x:v.x,y:v.y-groundHeight(p.x,p.y,this.simulation.state.terrain)};}),false);
      this.highlightWorker(a, 0xffdf88);
      return;
    }
    const visit=parkVisitor(a,this.simulation.building(a.target),this.acc);
    if(visit){const s=this.people.get(a.id);if(s)this.routeOverlay.lineStyle(1.5,0xffdf88,.9).strokeEllipse(s.x,s.y,12,6);return;}
    const points = laneCuts(a, agentDistance(a, this.acc), a.path.length - 1)
      .map((distance) => lanePose(a, distance))
      .map((p) => {
        const v = iso(p.x, p.y);
        return {
          x: v.x,
          y:
            v.y -
            this.roadHeights.height(
              this.simulation,
              p.x,
              p.y,
            ),
        };
      });
    this.routeOverlay.lineStyle(2, 0xffdf88, 0.75).strokePoints(points, false);
    const p = lanePose(a, agentDistance(a, this.acc)),
      v = iso(p.x, p.y);
    this.routeOverlay
      .lineStyle(1.5, 0xffe6a0, 1)
      .strokeEllipse(
        v.x,
        v.y -
          roadHeight(
            this.simulation.roads,
            p.x,
            p.y,
            this.simulation.state.buildings,
            this.simulation.state.terrain,
          ),
        a.kind === "person" ? 12 : 27,
        8,
      );
  }
  productionView(id: number | null = this.selected) {
    return this.logisticsCache.get(this.simulation, id);
  }
  private drawCoverage(b: Building) {
    const coverage = serviceCoverage(this.simulation, b);
    for (const h of coverage.homes) {
      const color = h.served ? 0x7ee0ad : 0xe8b66a;
      for (const p of footprint(
        h.home.kind,
        h.home.x,
        h.home.y,
        h.home.rotation,
        h.home.plot,
      ))
        this.diamond(p, color, 0.2);
      if (h.path && h.served)
        this.overlay.lineStyle(1, color, 0.45).strokePoints(
          h.path.map((p) => this.roadPoint(p)),
          false,
        );
    }
  }
  private roadPoint(p: Point) {
    const v = iso(p.x, p.y);
    return {
      x: v.x,
      y:
        v.y -
        roadHeight(
          this.simulation.roads,
          p.x,
          p.y,
          this.simulation.state.buildings,
          this.simulation.state.terrain,
        ),
    };
  }
  private drawGoodsPath(
    g: Phaser.GameObjects.Graphics,
    path: Point[],
    color: number,
    arrows = true,
  ) {
    const zoom = this.cameras.main.zoom;
    const points = path.map((_, i) =>
      this.roadPoint(lanePoint(path, i, LANE_OFFSET)),
    );
    if (!points.length) return;
    g.lineStyle(5 / zoom, 0x254c43, 0.65).strokePoints(points, false);
    g.lineStyle(2.5 / zoom, color, 0.95).strokePoints(points, false);
    for (let i = 1; arrows && i < points.length; i += 3) {
      const a = points[i - 1],
        b = points[i],
        length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!length) continue;
      const dx = (b.x - a.x) / length,
        dy = (b.y - a.y) / length,
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2,
        size = 5 / zoom;
      g.fillStyle(color, 1).fillTriangle(
        x + dx * size,
        y + dy * size,
        x - dx * size - dy * size * 0.7,
        y - dy * size + dx * size * 0.7,
        x - dx * size + dy * size * 0.7,
        y - dy * size - dx * size * 0.7,
      );
    }
    g.fillStyle(color, 1);
    for (const p of [points[0], points[points.length - 1]])
      g.fillCircle(p.x, p.y, 3 / zoom);
  }
  private highlightWorker(a: Agent, color: number) {
    const s = this.people.get(a.id);
    if (!s?.visible || (a.active === false && !a.onsite)) return;
    const zoom = this.cameras.main.zoom,
      width = a.kind === "person" ? 15 : 32;
    this.routeOverlay
      .lineStyle(4 / zoom, 0x254c43, 0.8)
      .strokeEllipse(s.x, s.y, width, 9);
    this.routeOverlay
      .lineStyle(2 / zoom, color, 1)
      .strokeEllipse(s.x, s.y, width, 9);
    const y = s.y - s.displayHeight * s.originY - 5 / zoom,
      size = 4 / zoom;
    this.routeOverlay
      .fillStyle(color, 1)
      .fillTriangle(s.x, y + size, s.x - size, y - size, s.x + size, y - size);
  }
  private drawProductionLogistics() {
    const view = this.tool === "inspect" ? this.productionView() : null;
    const drawKey = `${this.cameras.main.zoom}`;
    if (view !== this.logisticsView || drawKey !== this.logisticsDrawKey) {
      this.logisticsRoutes.clear();
      this.logisticsView = view;
      this.logisticsDrawKey = drawKey;
      if (view)
        for (const [links, color] of [
          [view.inputs, LOGISTICS_COLORS.input],
          [view.outputs, LOGISTICS_COLORS.output],
        ] as const) {
          for (const link of links) {
            if (!link.path) continue;
            this.drawGoodsPath(this.logisticsRoutes, link.path, color);
            const other = this.simulation.building(
              link.source === view.building ? link.target : link.source,
            );
            if (!other) continue;
            const [w, h] = dimensions(other.kind, other.rotation, other.plot);
            const corners = [
              [-0.5, -0.5],
              [w - 0.5, -0.5],
              [w - 0.5, h - 0.5],
              [-0.5, h - 0.5],
            ].map(([x, y]) => iso(other.x + x, other.y + y));
            this.logisticsRoutes
              .lineStyle(1.5 / this.cameras.main.zoom, color, 0.85)
              .strokePoints(corners, true);
          }
        }
    }
    if (!view) {
      if (this.deliveryDrawKey) this.deliveryRoutes.clear();
      this.deliveryDrawKey = "";
      return;
    }
    const activity = productionActivity(this.simulation, view);
    const deliveryKey = `${view.building}:${this.simulation.state.revision}:${this.simulation.state.tick}:${drawKey}`;
    const redrawDeliveries = deliveryKey !== this.deliveryDrawKey;
    if (redrawDeliveries) this.deliveryRoutes.clear();
    this.deliveryDrawKey = deliveryKey;
    for (const [agents, color] of [
      [activity.incoming, LOGISTICS_COLORS.input],
      [activity.outgoing, LOGISTICS_COLORS.output],
    ] as const) {
      for (const a of agents) {
        // Existing deliveries can retain an older valid route after new roads
        // are built; show their actual remaining journey as well as the network.
        if (redrawDeliveries && a.active !== false)
          this.drawGoodsPath(
            this.deliveryRoutes,
            a.path.slice(a.segment),
            color,
            false,
          );
        this.highlightWorker(a, color);
      }
    }
    for (const a of activity.workers)
      this.highlightWorker(a, LOGISTICS_COLORS.worker);
  }
  focusBuilding(id: number) {
    const b = this.simulation.building(id);
    if (b) {
      const [w, h] = dimensions(b.kind, b.rotation, b.plot),
        p = iso(b.x + (w - 1) / 2, b.y + (h - 1) / 2);
      this.cameras.main.centerOn(p.x, p.y - 20);
    }
  }
  focusAgent(id: number) {
    const sprite = this.people.get(id);
    if (sprite?.visible) this.cameras.main.centerOn(sprite.x, sprite.y - 20);
    else {
      const agent = this.simulation.state.agents.find((a) => a.id === id);
      if (agent)
        this.focusBuilding(agent.returning ? agent.target : agent.source);
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
    if (
      !["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement?.tagName ?? "",
      )
    ) {
      if (this.keys.W.isDown || this.keys.UP.isDown) c.scrollY -= move;
      if (this.keys.S.isDown || this.keys.DOWN.isDown) c.scrollY += move;
      if (this.keys.A.isDown || this.keys.LEFT.isDown) c.scrollX -= move;
      if (this.keys.D.isDown || this.keys.RIGHT.isDown) c.scrollX += move;
    }
    const live = new Set(this.simulation.state.agents.map((a) => a.id));
    for (const [id, s] of this.people)
      if (!live.has(id)) {
        s.destroy();
        this.people.delete(id);
      }
    for (const a of this.simulation.state.agents) {
      let s = this.people.get(a.id);
      const site = a.onsite ? this.simulation.building(a.onsite) : undefined;
      const p = a.roadWork!==undefined?roadWorkerPosition(a,this.acc):lanePose(a, agentDistance(a, this.acc)),
        heading = travelFacing(p.dx, p.dy),
        direction = Math.floor(heading / 2),
        intermediate = heading % 2 === 1;
      const delivery=a.kind==='truck'?deliveryVehicle(a.cargo):undefined;
      const car=a.kind==='car'?civilianCar(a):undefined;
      const texture = delivery?.texture ?? (car&&!car.classic?'civilian-cars':
        (a.kind === "person" ? "walkers" : "vehicles") +
        (intermediate ? "-turns" : ""));
      const row =
        a.kind === "person"
          ? a.id % 2
          : delivery
            ? delivery.row
            : car?.row??a.id % 2;
      const walk = walkFrame(
        direction,
        a.id % 2,
        agentDistance(a, this.acc),
        a.wait > 0 || !a.active,
        intermediate,
      );
      const frame = a.kind === "person" ? walk.frame : delivery||(car&&!car.classic) ? row * 8 + heading : row * 4 + direction;
      if (!s) {
        s = this.add
          .image(0, 0, texture, frame)
          .setOrigin(0.5, a.kind === "person" ? 1 : 0.8)
          .setData("agentId", a.id)
          .setInteractive({ pixelPerfect: true, alphaTolerance: 64 });
        this.people.set(a.id, s);
      }
      if (
        s.texture.key !== texture ||
        Number(s.frame.name) !== frame ||
        !s.getData("sized")
      ) {
        s.setTexture(texture, frame)
          .setScale(this.travellerScale(a, row, texture))
          .setData("sized", true);
      }
      const v = iso(p.x, p.y),
        bob =
          a.kind === "person" && a.wait <= 0 && a.active !== false
            ? Math.sin(
                (this.simulation.state.tick + this.acc / STEP) * 1.1 + a.id,
              ) * 0.55
            : 0;
      s.setOrigin(0.5, a.kind === "person" ? 1 : 0.8)
        .setPosition(
          v.x,
          v.y -
            this.roadHeights.height(
              this.simulation,
              p.x,
              p.y,
            ) +
            bob,
        )
        .setVisible(a.active !== false)
        .setDepth(
          travellerDepth(
            p,
            {
              left: s.x - s.displayWidth * s.originX,
              right: s.x + s.displayWidth * (1 - s.originX),
              top: s.y - s.displayHeight * s.originY,
              bottom: s.y + s.displayHeight * (1 - s.originY),
            },
            this.occludingPlots,
          ),
        )
        .setFlipX(a.kind === "person" && walk.flip);
      if(a.roadWork!==undefined){const visual=roadVisualState(this.simulation);s.y=v.y-this.workRoadHeights.height(visual,p.x,p.y)+bob;}
      s.setDepth(edgeDepth(p,{left:s.x-s.displayWidth*s.originX,right:s.x+s.displayWidth*(1-s.originX),top:s.y-s.displayHeight*s.originY,bottom:s.y+s.displayHeight*(1-s.originY)},s.depth,this.occludingEdges));
      if(a.roadWork!==undefined&&a.wait>0){
        const pose=builderFrame(a.resident??a.id,a.id%2,this.simulation.state.tick*STEP+this.acc,true);
        s.setTexture('construction-workers',pose.frame).setOrigin(pose.originX,pose.originY).setScale(pose.size/this.textures.getFrame('construction-workers',pose.frame).height).setFlipX(false);
        const visual=roadVisualState(this.simulation);
        s.y=v.y-this.workRoadHeights.height(visual,p.x,p.y);
      }
      if (site?.construction) {
        const crew = this.simulation.state.agents.filter(
            (a) => a.onsite === site.id,
          ),
          slot = crew.findIndex((c) => c.id === a.id);
        const clearing=site.construction.clearance?.tiles;
        const rock=clearing?.[slot%clearing.length];
        const p = rock?{x:rock.x+.35,y:rock.y+.35}:builderPosition(site, slot),
          v = iso(p.x, p.y),
          [w, h] = dimensions(site.kind, site.rotation, site.plot);
        const working = site.enabled && site.connected;
        const phase = this.simulation.state.tick * STEP + this.acc + a.id;
        const pose = builderFrame(a.resident ?? a.id, slot % 2, phase, working);
        const texture=rock?"mining":"construction-workers", frame=rock?8+[0,1,1,2,3,0][working?Math.floor(phase*6)%6:0]:pose.frame;
        s.setTexture(texture, frame)
          .setOrigin(rock?.56:pose.originX, rock?.97:pose.originY)
          .setScale(
            pose.size /
              this.textures.getFrame(texture, frame).height,
          )
          .setPosition(
            v.x,
            v.y - groundHeight(site.x, site.y, this.simulation.state.terrain),
          )
          .setVisible(true)
          .setFlipX(false)
          .setDepth((this.buildings.get(site.id)?.depth??((site.x+site.y+w+h-2)*32+12))+.25+slot*.01);
        if(rock){
          // The clearing footprint is a high overlay; its workers remain on
          // the ground, behind nearer trees, rocks and neighbouring buildings.
          const bounds={left:s.x-s.displayWidth*s.originX,right:s.x+s.displayWidth*(1-s.originX),top:s.y-s.displayHeight*s.originY,bottom:s.y+s.displayHeight*(1-s.originY)};
          s.setDepth(edgeDepth(p,bounds,travellerDepth(p,bounds,this.occludingPlots),this.occludingEdges));
        }
      }
      const visiting=this.simulation.building(a.target),visit=parkVisitor(a,visiting,this.acc);
      if(visit&&visiting){
        const heading=travelFacing(visit.dx,visit.dy),turn=heading%2===1,texture=turn?'walkers-turns':'walkers',pose=walkFrame(Math.floor(heading/2),a.id%2,visit.elapsed*.45,!visit.walking,turn),v=iso(visit.x,visit.y);
        s.setTexture(texture,pose.frame).setScale(this.travellerScale({...a,kind:'person'},a.id%2,texture)).setOrigin(.5,1).setFlipX(pose.flip)
          .setPosition(v.x,v.y-groundHeight(visiting.x,visiting.y,this.simulation.state.terrain)-FOUNDATION_HEIGHT)
          .setDepth((this.buildings.get(visiting.id)?.depth??((visiting.x+visiting.y+(visiting.kind==="garden"?6:2))*32+12))+.1+(visit.x-visiting.x+visit.y-visiting.y)*.08).setVisible(true).setData('sized',false);
      }
      const shopping=marketActor(this.simulation,a,this.acc);
      if(shopping){const {b,p,vendor,serving,visit}=shopping,v=iso(p.x,p.y),slot=marketLayout(b)[shopping.slot],direction=vendor?facing(slot.customer.x-slot.vendor.x,slot.customer.y-slot.vendor.y):visit?.walking?facing(visit.dx,visit.dy):facing(slot.vendor.x-slot.customer.x,slot.vendor.y-slot.customer.y),pose=walkFrame(direction,a.id%2,visit?.distance??0,!visit?.walking,false),t=visit?.serviceTime??0,gesture=serving&&t>.6&&t<2?(t<1||t>1.7?2:3):0;
        if(vendor)placeActor(s,"market-vendors",direction*4+gesture);
        else s.setTexture("walkers",pose.frame).setScale(this.travellerScale({...a,kind:"person"},a.id%2,"walkers")).setOrigin(.5,1).setFlipX(pose.flip);
        s.setPosition(v.x,v.y-groundHeight(b.x,b.y,this.simulation.state.terrain)-FOUNDATION_HEIGHT).setDepth((this.buildings.get(b.id)?.depth??0)+.1+(p.x-b.x+p.y-b.y)*.08).setVisible(true).setData("sized",false);
      }
      if (a.kind !== "person"&&!visit&&!shopping)
        this.animation.vehicle(
          a,
          s,
          heading,
          this.simulation.state.tick * STEP + this.acc,
        );
    }
    const time = this.simulation.state.tick * STEP + this.acc;
    this.forestryArt.update(this.simulation,this.acc,this.people,this.trees,this.occludingPlots);
    this.huntingArt.update(this.simulation,this.acc,this.people,this.occludingPlots);
    this.farmArt.update(this.simulation,this.acc,this.people,this.occludingPlots);
    this.livestockArt.update(this.simulation,this.acc,this.people,this.occludingPlots);
    this.fishingArt.update(this.simulation, this.acc, time, this.selected);
    this.roadWorkAlerts.update(this.simulation,this.tool==="inspect");
    this.trafficAlerts.update(
      this.simulation,
      this.tool === "inspect",
      time,
      (id) => this.people.get(id),
    );
    const camera = this.cameras.main;
    const cameraKey = `${camera.scrollX}:${camera.scrollY}:${camera.zoom}:${camera.width}:${camera.height}`;
    if (cameraKey !== this.cameraKey) {
      this.cameraKey = cameraKey;
      this.terrainArt.update(this.simulation);
      updateArtworkScaling(this.game, camera.zoom);
      this.onCamera();
    }
    this.buildingAlerts.update(
      this.simulation,
      camera,
      this.tool === "inspect",
      (b) => {
        const sprite = this.buildings.get(b.id);
        if (!sprite) return;
        const [w, h] = dimensions(b.kind, b.rotation, b.plot);
        if(b.kind==='farm'){
          const p=iso(b.x+(w-1)/2,b.y+(h-1)/2);
          return{x:p.x,y:p.y-groundHeight(b.x,b.y,this.simulation.state.terrain),center:true};
        }
        return {
          x: iso(b.x + (w - 1) / 2, b.y + (h - 1) / 2).x,
          y: sprite.y + (b.construction ? 16 : -4),
        };
      },
    );
    this.waterArt.update(time);
    this.weatherArt.update(time / STEP);
    // Phaser batches ordinary Images even outside the camera. Exclude only
    // fully off-screen scenery, with enough margin for every shadow and glow.
    const view=cameraViewport(camera),margin=160;
    for(const sprite of this.trees){const left=sprite.x-sprite.displayWidth*sprite.originX,top=sprite.y-sprite.displayHeight*sprite.originY;sprite.setVisible(left+sprite.displayWidth>=view.x-margin&&left<=view.x+view.width+margin&&top+sprite.displayHeight>=view.y-margin&&top<=view.y+view.height+margin);}
    this.nightArt.update(this.simulation, time, this.lightSources);
    this.shadowArt.update(
      this.simulation,
      time,
      [...this.buildings.values(), ...this.trees],
      this.nightArt.lamps,
    );
    this.drawAgentRoute();
    this.animation.update(
      this.simulation,
      time,
      (Math.min(delta, 100) * this.speed) / 1000,
      (id) => {const sprite=this.buildings.get(id),v=cameraViewport(this.cameras.main);return !!sprite && sprite.x+sprite.displayWidth>v.x && sprite.x<v.x+v.width && sprite.y+sprite.displayHeight>v.y-50 && sprite.y<v.y+v.height+50;},
    );
    this.waterEffects.clear();
    for (const p of this.waterPoints) {
      if(p.x<view.x-12||p.x>view.x+view.width+12||p.y<view.y-12||p.y>view.y+view.height+12)continue;
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
  private drawHuntRange(b:Building){const center=forestCenter(b),points=[];for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,p=iso(center.x+Math.cos(angle)*HUNT_RADIUS,center.y+Math.sin(angle)*HUNT_RADIUS);points.push({x:p.x,y:p.y-groundHeight(b.x,b.y,this.simulation.state.terrain)});}this.overlay.lineStyle(1.4,0x98d7a0,.9).strokePoints(points,false);for(const target of huntTargets(this.simulation,b))this.diamond(target.animal,0x93d993,.35);}
  private drawForestRange(b:Building) {
    const center=forestCenter(b), points=[];
    for(let i=0;i<=64;i++) {
      const angle=i/64*Math.PI*2, p=iso(center.x+Math.cos(angle)*FOREST_RADIUS,center.y+Math.sin(angle)*FOREST_RADIUS);
      points.push({x:p.x,y:p.y-groundHeight(b.x,b.y,this.simulation.state.terrain)});
    }
    this.overlay.lineStyle(1.4,0x98d7a0,.9).strokePoints(points,false);
    for(const target of forestTargets(this.simulation,b)) this.diamond(target.tree,0x93d993,.25);
  }
  private drawMiningRange(b:Building) {
    const center=forestCenter(b),points=[];
    for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,p=iso(center.x+Math.cos(angle)*MINING_RADIUS,center.y+Math.sin(angle)*MINING_RADIUS);points.push({x:p.x,y:p.y-groundHeight(b.x,b.y,this.simulation.state.terrain)});}
    const reachable=new Set(miningTargets(this.simulation,b).map(t=>key(t.rock)));
    this.overlay.lineStyle(1.4,b.kind==="quarry"?0xbecfdb:0xe8ac78,.9).strokePoints(points,false);
    for(const deposit of nearbyDeposits(this.view.original(b)))for(const original of depositTiles(deposit)){const p=this.view.to(original);if(exposedDeposit(this.simulation.state,p)&&!this.simulation.buildingAt(p.x,p.y)&&!this.simulation.roads.has(key(p)))this.diamond(p,reachable.has(key(p))?0x93d993:0xe6c17d,.3);}
  }
  replace(simulation: Simulation) {
    this.view.replace(simulation);
    this.deliveryDrawKey = "";
    this.deliveryRoutes.clear();
    this.buildingAlerts.clear();
    this.animation.clear();
    this.nightArt.clear();
    this.shadowArt.clear();
    this.fishingArt.clear();this.huntingArt.clear();
    this.trafficAlerts.clear();
    this.roadWorkAlerts.clear();this.selectedRoadWorks=[];
    this.acc = 0;
    this.selected = null;
    this.selectedAgent = null;
    this.people.forEach((p) => p.destroy());
    this.people.clear();
    this.buildings.forEach((b) => b.destroy());
    this.buildings.clear();
    this.redraw();
  }
}
import {placeActor} from './actor-art.js';
import {facing} from './rendering.js';
import {marketLayout} from './market-layout.js';
