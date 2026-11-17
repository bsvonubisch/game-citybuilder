import {roadWorkSites,roadWorkCrew,type RoadWorkSite} from './roadwork-sites.js';
import {worldDetails,roadName,type WorldSelection,type WorldAction} from './world-inspection.js';
import {roadBuildersNeeded,roadWorkAt} from './roadworks.js';
import {TownLog} from './town-log.js';
import {TownAudio} from './audio.js';
import {deliveryVehicle} from './delivery-vehicles.js';
import {civilianCar} from './civilian-vehicles.js';
import {HUNT_RADIUS,huntTargets} from "./hunting.js";
import {CROPS,farmPrice,farmJobs,type Crop} from './farm-layout.js';
import {farmSummary} from './farming.js';
import {isLivestock,penPrice,livestockJobs,livestockCapacity,LIVESTOCK,ensureHerd} from './livestock.js';
import {buildingRecipe,buildingOutputs,recipeProducts,FOOD_RESOURCES} from './catalog.js';
import {marketPrice,marketStalls} from "./market-layout.js";
import {marketVendors,MARKET_GOODS,marketOpen} from "./market.js";
import {buildingJobs} from "./catalog.js";
import {incomeSummary} from "./economy.js";
import {isHome,isPark} from "./catalog.js";
import {parkVisitor} from "./park-visitors.js";
import Phaser from "phaser";
import {townNeeds,buildingNeeds} from "./needs.js";
import "./style.css";
import { ROAD_TYPES, roadTypeAt, type RoadType } from "./roads.js";
import { FOREST_RADIUS, REGROW_TICKS, forestTargets, forestInside, harvestable, treeStage } from "./forestry.js";
import {
  BUILDINGS,
  STEP,
  SIZE,
  RESOURCES,
  RESOURCE_NAMES,
  DELIVERY_CAPACITY,
  dimensions,
  frontage,
  FRONT_NAMES,
  DECORATIONS,
  isBuilding,
  isDecoration,
  HOUSE_TIERS,
  houseCapacity,
  buildingName,
  type HouseTier,
  type Resource,
  type BuildingKind,
  type Tool,
} from "./catalog.js";
import {
  Simulation,
  parseSave,
  DEPOSITS,
  key,
  type Command,
  type Point,
  type Building,
} from "./simulation.js";
import { LocalGateway } from "./gateway.js";
import { daylight } from "./daylight.js";
import { DaylightUI } from "./daylight-ui.js";
import {
  nextUpgrade,
  productionRate,
  outputCapacity,
  materialGuidance,
} from "./upgrades.js";
import {
  isService as isLeisure,
  isReligion,
  serviceCoverage,
  servicePreview,
  serviceOpen,
} from "./proximity.js";
import { deeperLayer, isExtractor, depositAt, DEPOSIT_TILES, buildingDeposit, nearbyDeposits, MINING_RADIUS } from "./deposits.js";
import { miningTargets } from "./mining.js";
import {
  builderCapacity,
  constructionWork,
  constructionCrew,
} from "./construction.js";
import { fishingStatus } from "./fishing.js";
import { TownScene } from "./scene.js";
import {
  artworkMode,
  setArtworkMode,
  type ArtworkMode,
} from "./artwork-scaling.js";
import { terrainCell, type TerrainMode } from "./terrain.js";
import { icon } from "./icons.js";
import { buildingPreview, planterPreview, fencePreview } from "./previews.js";
import { alertIcon } from "./building-alerts.js";
import { buildingGuidance, type GuidanceAction } from "./building-guidance.js";
import { trafficQueues } from "./traffic-queues.js";
import { cameraViewport } from "./rendering.js";
import { productionActivity, type GoodsConnection } from "./logistics.js";
import { CloudSaves, cloudError } from "./cloud.js";
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const townAudio = new TownAudio();
const SAVE_KEY =
  "little-works.pinehaven.v1" +
  (new URLSearchParams(location.search).has("qa")
    ? ".qa" +
      (new URLSearchParams(location.search).get("qa") === "1"
        ? ""
        : "." + new URLSearchParams(location.search).get("qa"))
    : "");
let restoreError = "";
let simulation: Simulation;
try {
  const save = localStorage.getItem(SAVE_KEY);
  if (
    save &&
    JSON.parse(save).buildings?.some(
      (b: { kind: string; plot?: number[];crop?:string;field?:unknown }) =>
        ["farm", "sawmill", "workshop", "warehouse"].includes(b.kind) &&
        !(b.kind==='farm'&&(b.crop!==undefined||b.field!==undefined)) &&
        b.plot?.includes(3),
    )
  ) {
    localStorage.setItem(SAVE_KEY + ".before-compact-plots", save);
  }
  if (save && JSON.parse(save).version < 3)
    localStorage.setItem(SAVE_KEY + ".before-front-entrances", save);
  if (save && JSON.parse(save).version === 1)
    localStorage.setItem(SAVE_KEY + ".before-footprints", save);
  simulation = new Simulation(save ? parseSave(save) : undefined);
} catch {
  simulation = new Simulation();
  restoreError =
    "The saved town could not be read. A fresh town is ready; any pre-upgrade backup is kept.";
}
const gateway = new LocalGateway(simulation);
const scene = new TownScene(simulation);
function sendCommand(command:Command){return gateway.command(scene.view.command(command));}
const cloud = new CloudSaves();
const catalogGroups={homes:"Homes",food:"Food & farms",gather:"Gathering",industry:"Workshops",town:"Services",parks:"Parks",trees:"Trees",decorations:"Street furniture"};
const catalogKinds:Record<keyof typeof catalogGroups,string[]>={homes:["cottage","house"],food:["farm","cattle","chickens","pigs","fishery","mill","bakery","hunter","butcher"],gather:["forester","quarry","mine"],industry:["sawmill","workshop","brickworks"],town:["warehouse","chapel","church","tavern","market"],parks:["park","garden"],trees:["oak","pine","birch","blossom","maple","willow"],decorations:["bench","streetlight","planter","fence"]};
let category: keyof typeof catalogGroups = "homes",
  tab: "build" | "town" = "build",
  selected: number | null = null,
  selectedAgent: number | null = null,
  selectedTraffic: number[] | null = null,
  selectedRoadWork:RoadWorkSite|null=null,
  selectedWorld:WorldSelection|null=null,
  hovered: Point | null = null,
  tool: Tool = "inspect",
  panelOpen = false,
  lastSave = Date.now(),
  toastTimer = 0,
  modalPreviousSpeed = 1;
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"\x27]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "\x27": "&#39;",
      })[c]!,
  );
let iconSequence = 0;
const atlasIcon = (
  path: string,
  columns: number,
  rows: number,
  w: number,
  h: number,
  index: number,
  cls = "",
) => {
  const x = (index % columns) * w,
    y = Math.floor(index / columns) * h,
    id = `atlas-${iconSequence++}`;
  return `<svg class="building-icon ${cls}" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" /></clipPath></defs><image href="${path}" width="${w * columns}" height="${h * rows}" clip-path="url(#${id})" /></svg>`;
};
const frame = (
  kind: BuildingKind,
  cls = "",
  rotation = 0,
  houseTier: HouseTier = 1,
  crop:Crop|null='wheat',
) => {
  const { key, promise } = buildingPreview(kind, rotation, houseTier,crop);
  void promise.then((src) =>
    document
      .querySelectorAll<HTMLImageElement>(`[data-preview="${key}"]`)
      .forEach((image) => (image.src = src)),
  );
  return `<img class="building-icon ${cls}" data-preview="${key}" alt="" aria-hidden="true">`;
};
$("#app").innerHTML = `
 <header class="topbar"><a class="brand" href="#" aria-label="Center town">${icon("tree")}<span>LITTLE WORKS<small>PINE & COPPER</small></span></a><div class="resource-bar">
 ${[
   ["coin", "gold", "Gold"],
   ["bread", "food-stock", "Food in warehouses"],
   ["wood", "wood", "Wood in warehouses"],
   ["planks", "planks", "Planks in warehouses"],
   ["box", "bricks", "Bricks in warehouses"],
   ["stone", "stone", "Stone in warehouses"],
   ["metal", "metal", "Metal in warehouses"],
   ["people", "population", "Employed / residents"],
   ["hammer", "builders", "Builders / needed"],
   ["leaf", "leisure", "Leisure"],
   ["heart", "happiness", "Happiness"],
 ]
   .map(
     ([i, id, title]) =>
       `<div class="resource ${id}" title="${title}">${icon(i)}<span id="${id}">—</span><small>${id === "population" || id === "builders" ? title : title.split(" ")[0]}</small></div>`,
   )
   .join("")}
 </div><div class="header-actions"><button class="quiet" id="cloud-button" title="Sign in & cloud saves">${icon("cloud")}<span id="cloud-label">Connect</span></button><button class="icon-button" id="settings" aria-label="Save and settings">${icon("settings")}</button></div></header>
 <div class="townbar"><div class="town-identity"><span class="eyebrow">THE EMERALD VALLEY</span><h1>Pinehaven <span class="town-star">✦</span></h1><span class="town-motto">A little industry. A lovely life.</span></div><button id="town-needs-button" class="quiet town-needs-button">Town needs</button><div class="town-season">${icon("sun")}<b id="day">Day 1</b><span>Spring · Year 1</span></div><details class="town-progress"><summary>${icon("flag")}<span>Town progress</span></summary><div class="town-progress-content"><h3>Small town. Big possibilities.</h3><p id="goal-copy">Let your first deliveries find their way home.</p><div class="goal-progress"><span id="goal-progress"></span></div><small id="goal-count">0 / 30 goods delivered</small></div></details><div class="save-indicator"><span class="status-dot"></span><span id="save-status">Saved on this device</span><button id="save-now" title="Save now" aria-label="Save town">${icon("save")}</button></div></div>
 <main>
 <section class="world" aria-label="Interactive town map"><div id="game"></div><div id="building-alerts" role="group" aria-label="Building alerts"></div>
 <div id="inspector" class="inspector" hidden></div><details id="town-log" class="town-log" aria-label="Town event log"></details>
 <div class="map-corner"><canvas id="minimap" width="168" height="102" aria-label="Town minimap"></canvas><div class="zoom-controls"><button id="zoom-out" aria-label="Zoom out">−</button><button id="center" title="Center town">${icon("map")}<span id="zoom-level">100%</span></button><button id="zoom-in" aria-label="Zoom in">+</button></div><div class="map-rotation"><button id="rotate-view-left" aria-label="Rotate town view left 90 degrees" title="Rotate town view left">↶</button><span id="view-direction" aria-live="polite">View 1</span><button id="rotate-view-right" aria-label="Rotate town view right 90 degrees" title="Rotate town view right">↷</button></div></div>
 <div class="bottom-area"><section id="build-drawer" class="build-drawer" aria-label="Build and town menu" hidden><button id="close-panel" class="icon-button" aria-label="Close town menu">${icon("close")}</button><div id="panel-content"></div></section><div id="placement-hint" class="placement-hint" hidden></div><nav class="toolbar" aria-label="Town tools"><div class="tool-group">${[
   ["inspect", "inspect", "Explore", "V"],
   ["build", "hammer", "Build", "B"],
   ["road", "road", "Road", "R"],
   ["terrain", "terrain", "Terrain", "T"],
   ["bulldoze", "hammer", "Remove", "X"],
   ["town", "leaf", "Your town", "U"],
 ]
   .map(
     ([id, i, label, k]) =>
       `<button ${id === "build" || id === "town" ? `id="${id}-tab" aria-controls="build-drawer" aria-expanded="false"` : `data-tool="${id}"`} class="tool-button ${id === "inspect" ? "active" : ""}" title="${label} (${k})">${icon(i)}<span>${label}</span><kbd>${k}</kbd></button>`,
   )
   .join(
     "",
   )}<button id="grid" class="tool-button" title="Show grid (G)">${icon("grid")}<span>Grid</span></button></div><div class="speed-controls"><button id="pause" aria-label="Pause simulation">${icon("pause")}</button><button data-speed="1" class="active">1×</button><button data-speed="2">2×</button><button data-speed="4">4×</button></div></nav></div>
 <button id="help" class="help-button" aria-label="How to play">${icon("help")}</button><div id="tile-label" class="tile-label"></div></section></main>
 <div id="toast" role="status" aria-live="polite"></div><dialog id="dialog"><button id="close-dialog" class="icon-button close" aria-label="Close dialog">${icon("close")}</button><div id="dialog-content"></div></dialog><input id="import-file" type="file" accept="application/json,.json" hidden>`;
$("#building-alerts").insertAdjacentHTML(
  "afterend",
  '<div id="traffic-alerts" role="group" aria-label="Traffic warnings"></div><div id="roadwork-alerts" role="group" aria-label="Road work"></div>',
);
const townLog=new TownLog($<HTMLDetailsElement>("#town-log"),event=>{
  setTool("inspect");closeInspection();
  const building=event.buildingId?simulation.building(event.buildingId):undefined;
  if(building){scene.onSelect(building.id);scene.focusBuilding(building.id);}
  else if(event.tile)scene.focusTile(event.tile.x,event.tile.y);
});
$("#town-needs-button").onclick=()=>{setTool("inspect");closeInspection();tab="town";renderPanel();setPanelOpen(true);};
$("#panel-content").addEventListener("wheel",(event)=>{
  const target=event.target as Element;
  const scroller=target.closest<HTMLElement>(".building-grid,.category-tabs")??(tab==="build"&&tool!=="terrain"?document.querySelector<HTMLElement>(".building-grid"):null);
  if(!scroller||event.ctrlKey)return;
  event.preventDefault();event.stopPropagation();
  scroller.scrollLeft+=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*(event.deltaMode===1?20:event.deltaMode===2?scroller.clientWidth:1);
},{passive:false});
const daylightUI = new DaylightUI($(".town-season"));
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#a7b9ad",
  pixelArt: false,
  roundPixels: false,
  antialias: true,
  antialiasGL: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: $("#game").clientWidth,
    height: $("#game").clientHeight,
  },
  scene: [scene],
  banner: false,
  audio: { noAudio: true },
  input: { activePointers: 3 },
});
const resize = new ResizeObserver(() =>
  game.scale.resize($("#game").clientWidth, $("#game").clientHeight),
);
resize.observe($("#game"));
// Opt-in on-screen measurements make device-specific performance reports useful.
if (new URLSearchParams(location.search).has("perf")) {
  const meter = document.createElement("output");
  meter.id = "performance";
  meter.style.cssText =
    "position:fixed;right:18px;top:74px;z-index:20;background:#243c31e8;color:#fff;padding:8px 12px;border-radius:6px;font:12px monospace;pointer-events:none";
  meter.textContent = "Measuring frame rate…";
  document.body.append(meter);
  let last = performance.now(),
    report = last;
  const samples: number[] = [];
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    const now = performance.now(),
      elapsed = now - last;
    last = now;
    if (document.hidden || elapsed > 1000) {
      samples.length = 0;
      return;
    }
    samples.push(elapsed);
    if (samples.length > 300) samples.shift();
    if (now - report < 1000 || samples.length < 20) return;
    report = now;
    const sorted = [...samples].sort((a, b) => a - b);
    const fps = (1000 * samples.length) / samples.reduce((a, b) => a + b, 0);
    meter.textContent = `${fps.toFixed(0)} FPS · 95% frames ≤ ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)} ms · ${simulation.state.agents.length} moving agents`;
  });
}
function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => $("#toast").classList.remove("visible"),
    4200,
  );
}
function setTool(next: Tool, preservePlot=false) {
  scene.cancelRoad(!preservePlot);
  scene.clearBuildingHover();
  scene.guidanceBuilding = null;
  if (next !== "move") scene.movingBuilding = null;
  const wasTerrain = tool === "terrain";
  setPanelOpen(false);
  if (next !== "inspect") closeInspection();
  tool = next;
  scene.tool = next;
  updatePlacementCost();
  $("#placement-hint").hidden = next === "inspect";
  document
    .querySelectorAll<HTMLElement>("[data-tool]")
    .forEach((e) => e.classList.toggle("active", e.dataset.tool === tool));
  document
    .querySelectorAll<HTMLElement>("[data-building]")
    .forEach((e) =>
      e.classList.toggle("selected", e.dataset.building === tool),
    );
  const d = Object.hasOwn(BUILDINGS, next)
    ? {...BUILDINGS[next as BuildingKind],...(isLivestock(next)?penPrice(next,scene.penPlot):next==='farm'?farmPrice(scene.farmPlot):next==="market"?marketPrice(scene.marketPlot):{})}
    : null;
  const decoration = isDecoration(next) ? DECORATIONS[next] : null;
  $("#placement-hint").innerHTML = d
    ? `${icon("hammer")} Place ${d.name.toLowerCase()} · ${d.cost} gold ${Object.entries(
        d.materials ?? {},
      )
        .map(([r, n]) => `· ${n} ${r}`)
        .join(
          " ",
        )} · ${dimensions(next as BuildingKind, scene.rotation,next==="market"?scene.marketPlot:undefined).join("×")} tiles · ${next==="market"?80+scene.marketPlot[0]*scene.marketPlot[1]*35:constructionWork(next as BuildingKind)} worker-seconds ${isBuilding(next) ? `<button id="rotate-placement" class="rotate-placement" title="Rotate building">${icon("reset")} Rotate</button><span id="front-access"></span>` : ""} <kbd>Esc</kbd>`
    : decoration
      ? `${icon("leaf")} Place ${decoration.name.toLowerCase()} · ${decoration.cost} gold · 1 tile <kbd>Esc</kbd>`
      : next === "road"
        ? `<div class="road-surfaces" role="group" aria-label="Road surface">${Object.entries(ROAD_TYPES).map(([kind, d]) => `<button type="button" data-road-type="${kind}" aria-pressed="${scene.roadType === kind}"><span class="road-swatch road-${kind}" aria-hidden="true"></span><b>${d.name}</b><span>${d.cost} gold${kind==="brick"?" + 1 brick":""} / tile</span><small>${d.description}</small></button>`).join("")}</div><span class="road-instructions">Drag to lay roads or footpaths · Converting access costs at least 6 gold/tile</span><span id="road-stroke-cost" aria-live="polite"></span><small>Bridges match the road material; costs appear as you drag. Pavements use timber footbridges.<br>Two fingers to pan/zoom · Space-drag to pan · Esc to cancel</small>`
        : next === "bridge"
          ? `${icon("bridge")} Build over water · 35 gold per tile · Connect both ends to roads <kbd>Esc</kbd>`
          : next === "bulldoze"
            ? `${icon("hammer")} Click or drag to remove a stretch · Release to apply · Half the gold returned <kbd>Esc</kbd>`
            : `${icon("inspect")} Tap buildings, people or cars · Drag to pan · Pinch or scroll to zoom`;
  if (isBuilding(next)) $("#rotate-placement").onclick = rotatePlacement;
  if(next==="market"){
    $("#placement-hint").innerHTML=`${icon("hammer")} <b>Drag a marketplace rectangle</b><span id="market-drag-size"></span><button id="rotate-placement" class="rotate-placement">${icon("reset")} Rotate</button><small>Release to build · 1×1 to 5×5 · Two fingers or Space-drag to pan · Esc cancels</small>`;
    $("#rotate-placement").onclick=rotatePlacement;
    updateMarketPreview();
  }
  if(next==='farm'){
    $('#placement-hint').innerHTML='<b>Drag a farm</b><span id="market-drag-size"></span><small>1×1 to 10×10 · Choose a crop in the farm details after placing</small>';
    updateMarketPreview();
  }
  if(isLivestock(next)){
    $('#placement-hint').innerHTML=`<b>Drag a ${BUILDINGS[next].name.toLowerCase()}</b><span id="market-drag-size"></span><button id="rotate-placement" class="rotate-placement">${icon('reset')} Rotate</button><small>2×2 to 10×10 · Starts with two animals · Keep grain deliveries connected</small>`;
    $('#rotate-placement').onclick=rotatePlacement;updateMarketPreview();
  }
  if(next==="fence")$("#placement-hint").insertAdjacentHTML("beforeend",'<span class="shore-hint">Point at a tile edge · Fences join at shared corners · The tile stays usable</span>');
  if(next==="streetlight")$("#placement-hint").insertAdjacentHTML("beforeend",'<span class="shore-hint">Point at either road edge to choose the curb · One post per click · 20 gold</span>');
  if(next==="hunter")$("#placement-hint").insertAdjacentHTML("beforeend",`<span class="shore-hint">${HUNT_RADIUS}-tile hunting area · Green markers show reachable wildlife · Meat arrives when hunters return</span>`);
  if(next==="forester")$("#placement-hint").insertAdjacentHTML("beforeend",`<span class="shore-hint">${FOREST_RADIUS}-tile woodland area · Green trees are reachable · Keep a clear walking route</span>`);
  if(isExtractor(next))$("#placement-hint").insertAdjacentHTML("beforeend",`<span class="shore-hint">Build beside the deposit · ${MINING_RADIUS}-tile reach · Green rocks are reachable from the entrance</span>`);
  if (next === "road") document.querySelectorAll<HTMLButtonElement>("[data-road-type]").forEach((button) => {
    button.onclick = () => {
      scene.cancelRoad();
      scene.roadType = button.dataset.roadType as RoadType;
      document.querySelectorAll<HTMLButtonElement>("[data-road-type]").forEach((choice) =>
        choice.setAttribute("aria-pressed", String(choice.dataset.roadType === scene.roadType)));
      scene.drawOverlay();
    };
  });
  if (next === "fishery")
    $("#placement-hint").insertAdjacentHTML(
      "beforeend",
      '<span class="shore-hint"><b>Sand: 2 land tiles</b> · <b>Blue: 2 water tiles</b> · Entrance faces land</span>',
    );
  if (next === "move") {
    const b = simulation.building(scene.movingBuilding!);
    $("#placement-hint").innerHTML =
      `${icon("inspect")} Move ${b ? buildingName(b) : "building"} · stock & progress kept <button id="rotate-placement" class="rotate-placement">${icon("reset")} Rotate <kbd>R</kbd></button><span id="front-access"></span><button id="cancel-move" class="rotate-placement">Cancel</button>`;
    $("#rotate-placement").onclick = rotatePlacement;
    $("#cancel-move").onclick = () => setTool("inspect");
  }
  if (next === "terrain") {
    tab = "build";
    $("#placement-hint").innerHTML =
      `${icon("terrain")}<span id="terrain-cost">Choose ground to preview the brush.</span><button id="apply-terrain" class="rotate-placement" disabled>Apply</button>`;
    $("#apply-terrain").onclick = () => {
      const c = scene.terrainCommand();
      if (c) scene.onTerrainApply(c);
    };
    renderPanel();
    setPanelOpen(true);
  } else if (wasTerrain) renderPanel();
  updateEntranceHint();
  scene.drawOverlay();
}
function setPanelOpen(open: boolean) {
  panelOpen = open;
  $("#build-drawer").hidden = !open;
  $('[data-tool="inspect"]').classList.toggle(
    "active",
    !open && tool === "inspect",
  );
  for (const name of ["build", "town"] as const) {
    const active = open && tab === name && tool !== "terrain";
    $("#" + name + "-tab").setAttribute("aria-expanded", String(active));
    $("#" + name + "-tab").classList.toggle("active", active);
  }
}
function togglePanel(next: typeof tab) {
  if (panelOpen && tab === next && tool !== "terrain") {
    setPanelOpen(false);
    return;
  }
  setTool("inspect");
  closeInspection();
  tab = next;
  renderPanel();
  setPanelOpen(true);
}
document.addEventListener("pointerdown", (event) => {
  if (!panelOpen || tab !== "build" || tool === "terrain") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  // Leave the toggle button to its own handler; closing it here would make
  // the subsequent click reopen the menu. Do not consume the map gesture.
  if (target.closest("#build-drawer, #build-tab")) return;
  setPanelOpen(false);
}, {capture: true});
$("#close-panel").onclick = () => {
  setPanelOpen(false);
  $(tool === "terrain" ? '[data-tool="terrain"]' : `#${tab}-tab`).focus();
};
function rotatePlacement() {
  if(isLivestock(tool))scene.penPlot=[scene.penPlot[1],scene.penPlot[0]];
  if(tool==='farm')scene.farmPlot=[scene.farmPlot[1],scene.farmPlot[0]];
  if(tool==="market")scene.marketPlot=[scene.marketPlot[1],scene.marketPlot[0]];
  scene.rotation = ((scene.rotation + 1) % 4) as 0 | 1 | 2 | 3;
  scene.drawOverlay();
  setTool(tool,true);
  toast(`Front entrance facing ${FRONT_NAMES[scene.rotation]}.`);
}
function cancelTool() {
  scene.cancelPlacement();
  setTool("inspect");
}
scene.onCancel = cancelTool;
$("#app").addEventListener("contextmenu", (e) => {
  if (tool === "inspect" || $<HTMLDialogElement>("#dialog").open) return;
  e.preventDefault();
  cancelTool();
});
function updateEntranceHint() {
  const simulation=scene.simulation;
  const el = document.querySelector<HTMLElement>("#front-access");
  const moving =
    tool === "move" ? simulation.building(scene.movingBuilding!) : undefined;
  const kind = moving?.kind ?? tool;
  if (!el || !isBuilding(kind)) return;
  const connected =
    hovered &&
    frontage(
      kind,
      hovered.x,
      hovered.y,
      scene.rotation,
      moving ? simulation.relocationPlot(moving, scene.rotation) : undefined,
    ).some(
      (p) =>
        simulation.roads.has(key(p)) &&
        terrainCell(p.x, p.y, simulation.state.terrain).height ===
          terrainCell(hovered!.x, hovered!.y, simulation.state.terrain).height,
    );
  el.textContent = connected
    ? isPark(kind)
      ? "Square connected to road"
      : "Front connected to road"
    : isPark(kind)
      ? "Connect a road on any of the four sides"
      : "Front entrance needs a road";
  el.className = connected ? "front-connected" : "front-missing";
  if (hovered && isLeisure(kind)) {
    const view = serviceCoverage(
      simulation,
      servicePreview(kind, hovered.x, hovered.y, scene.rotation, moving?.level),
    );
    el.textContent += view.connected
      ? ` · ${view.homes.filter((h) => h.served > 0).length} homes / ${view.residents} residents served · ${view.range}-tile walk limit`
      : " · 0 homes served until connected";
  }
}
function renderPanel() {
  setPanelOpen(panelOpen);
  if (tab === "town") {
    $("#panel-content").innerHTML =
      `<div class="town-overview"><section><span class="eyebrow">GROWING TOGETHER</span><h3>Life in Pinehaven</h3><p class="muted">Have / need. Select a shortage to take the next step.</p><div id="town-needs"></div><div id="town-stats"></div></section><section><h4>Town inventory</h4><p class="muted">Ready = warehouses. Elsewhere = workplaces and deliveries.</p><div class="stock-heading"><span>Material</span><b>Ready</b><b>Elsewhere</b></div><div id="inventory"></div></section></div>`;
    $("#town-needs").onclick=(event)=>{const button=(event.target as Element).closest<HTMLButtonElement>("[data-need]");if(!button)return;const need=townNeeds(simulation).find(n=>n.id===button.dataset.need);if(need?.action?.building){setPanelOpen(false);scene.onSelect(need.action.building);scene.focusBuilding(need.action.building);}else if(need?.action?.kind)setTool(need.action.kind);};
    updateUI();
    return;
  }
  if (tool === "terrain") {
    const modes: Record<TerrainMode, string> = {
      raise: "Raise land",
      lower: "Lower land",
      level: "Level land",
      water: "Add water",
      land: "Add ground",
    };
    $("#panel-content").innerHTML =
      `<section class="terrain-tools"><span class="eyebrow">SHAPE THE VALLEY</span><h3>Land & water</h3><p>Choose a brush, then preview it on the map.</p><div class="terrain-modes">${Object.entries(
        modes,
      )
        .map(
          ([id, name]) =>
            `<button data-terrain-mode="${id}" class="${scene.terrainMode === id ? "active" : ""}" aria-pressed="${scene.terrainMode === id}">${icon(id === "water" ? "water" : id === "land" ? "leaf" : id === "raise" ? "raise" : id === "lower" ? "lower" : "level")}${name}</button>`,
        )
        .join(
          "",
        )}</div><label for="terrain-size">Brush size <b id="brush-label">${scene.terrainSize} × ${scene.terrainSize}</b></label><input id="terrain-size" type="range" min="1" max="5" step="1" value="${scene.terrainSize}"><p class="muted">Drag up or down to change height. On a phone, tap the ground then Apply. Drag and pinch still move the map.</p><p class="muted">Raise lifts the lowest selected ground. Lower cuts the highest. Level matches the center tile. Water fills at river level.</p><button class="primary" id="use-terrain">Use brush</button><button id="undo-terrain" class="quiet" ${simulation.canUndoTerrain() ? "" : "disabled"}>${icon("reset")} Undo last terrain edit</button><button id="terrain-back" class="quiet">Back to buildings</button></section>`;
    document.querySelectorAll<HTMLElement>("[data-terrain-mode]").forEach(
      (el) =>
        (el.onclick = () => {
          scene.terrainMode = el.dataset.terrainMode as TerrainMode;
          renderPanel();
          scene.drawOverlay();
        }),
    );
    $<HTMLInputElement>("#terrain-size").oninput = (e) => {
      scene.terrainSize = Number((e.target as HTMLInputElement).value);
      $("#brush-label").textContent =
        `${scene.terrainSize} × ${scene.terrainSize}`;
      scene.drawOverlay();
    };
    $("#use-terrain").onclick = () => setPanelOpen(false);
    $("#terrain-back").onclick = () => togglePanel("build");
    $("#undo-terrain").onclick = async () => {
      const result = await sendCommand({ type: "undoTerrain" });
      toast(result.message);
      if (result.ok) {
        scene.redraw();
        save(false);
        updateUI();
        renderPanel();
      }
    };
    return;
  }
  const names=catalogGroups;
  const cards =
    (category === "decorations" || category === "trees")
      ? Object.entries(DECORATIONS).filter(([kind])=>catalogKinds[category].includes(kind))
          .map(
            ([kind, d]) =>
              `<button class="building-card ${tool === kind ? "selected" : ""}" data-building="${kind}" title="Place or remove ${d.name.toLowerCase()}">${kind === "fence" ? '<img class="building-icon" data-fence-preview alt="">' : kind === "streetlight" ? '<img class="building-icon" src="/streetlight-copper.png" alt="">' : kind === "planter" ? '<img class="building-icon" data-planter-preview alt="">' : d.texture === "garden" || d.texture === "tree-variants" ? atlasIcon(d.texture === "garden" ? "/garden-sprites.png" : "/tree-variants-v1.png", 4, 4, 313.5, 313.5, d.frame) : atlasIcon("/town-props.png", 2, 2, 887, 443.5, d.frame)}<b>${d.name}</b><span class="price">${icon("coin")}${d.cost}</span></button>`,
          )
          .join("")
      : (Object.entries(BUILDINGS) as [BuildingKind, typeof BUILDINGS.house][])
          .filter(([kind]) => catalogKinds[category].includes(kind))
          .map(([kind,d]):[BuildingKind,typeof BUILDINGS.house]=>[kind,isLivestock(kind)?{...d,...penPrice(kind,[2,2])}:kind==='farm'?{...d,...farmPrice([1,1])}:d])
          .map(
            ([kind, d]) =>
              `<button class="building-card ${tool === kind ? "selected" : ""}" data-building="${kind}" title="${d.description}">${frame(kind)}<b>${d.name}</b><span class="price">${icon("coin")}${kind==='farm'||isLivestock(kind)?'From ':''}${d.cost}</span><span class="card-materials">${Object.entries(d.materials??{}).map(([r,n])=>`<span title="${RESOURCE_NAMES[r as Resource]}">${icon(r==="bricks"?"box":r)}${n} ${RESOURCE_NAMES[r as Resource]}</span>`).join("")}</span></button>`,
          )
          .join("");
  $("#panel-content").innerHTML = `<div class="category-tabs">${Object.entries(
    names,
  )
    .map(
      ([id, name]) =>
        `<button data-category="${id}" class="${category === id ? "active" : ""}">${name}</button>`,
    )
    .join(
      "",
    )}</div><div class="catalog-heading"><h3>${names[category]}</h3></div><div class="building-grid">${cards}</div><div class="build-note">${icon("leaf")}<div><b>${category === "decorations" ? "Make the streets your own." : "Connect the front entrance."}</b><p>${category === "decorations" ? "Place along streets and garden edges." : "The green entrance arrow shows road access."}</p></div></div><button class="chain-button" id="production-guide">See production chains ${icon("arrow")}</button>`;
  document.querySelectorAll<HTMLElement>("[data-category]").forEach(
    (el) =>
      (el.onclick = () => {
        category = el.dataset.category as typeof category;
        renderPanel();
      }),
  );
  document
    .querySelectorAll<HTMLElement>("[data-building]")
    .forEach((el) => (el.onclick = () => setTool(el.dataset.building as Tool)));
  $("#production-guide").onclick = showChains;
  if(category==="decorations")void fencePreview().then(src=>document.querySelectorAll<HTMLImageElement>("[data-fence-preview]").forEach(image=>image.src=src));
  if(category==="decorations")void planterPreview().then(src=>document.querySelectorAll<HTMLImageElement>("[data-planter-preview]").forEach(image=>image.src=src));
}
const placementCost=document.createElement("div");placementCost.className="placement-cost";placementCost.hidden=true;$(".world").append(placementCost);
function updateMarketPreview(){
  const label=document.querySelector('#market-drag-size');if(!label)return;
  if(isLivestock(tool)){const price=penPrice(tool,scene.penPlot);label.textContent=`${scene.penPlot.join('×')} · 2 / ${livestockCapacity(tool,scene.penPlot)} animals · ${livestockJobs(tool,scene.penPlot)} farmers · ${price.cost} gold`;updatePlacementCost();return;}
  if(tool==='farm'){const price=farmPrice(scene.farmPlot);label.textContent=scene.farmPlot.join('×')+' · '+farmJobs(scene.farmPlot)+' farmers · '+price.cost+' gold · '+price.materials.wood+' wood';updatePlacementCost();return;}
  const price=marketPrice(scene.marketPlot);
  label.textContent=`${scene.marketPlot.join('×')} · ${marketStalls({x:0,y:0,rotation:scene.rotation,plot:scene.marketPlot})} stalls · ${price.cost} gold · ${Object.entries(price.materials).map(([r,n])=>`${n} ${r}`).join(' · ')}`;
  updatePlacementCost();
}
scene.onMarketPreview=updateMarketPreview;
let costPointer:{x:number;y:number;touch:boolean}|null=null;
function updatePlacementCost(){
  if(typeof placementCost==="undefined")return;
  const d=isBuilding(tool)?{...BUILDINGS[tool],...(isLivestock(tool)?penPrice(tool,scene.penPlot):tool==='farm'?farmPrice(scene.farmPlot):tool==="market"?marketPrice(scene.marketPlot):{})}:isDecoration(tool)?DECORATIONS[tool]:null;
  placementCost.hidden=!d||!costPointer;
  if(!d||!costPointer)return;
  const rows=[{name:"Gold",icon:"coin",need:d.cost,have:simulation.state.money},...Object.entries("materials" in d?d.materials??{}:{}).map(([r,n])=>({name:RESOURCE_NAMES[r as Resource],icon:r==="bricks"?"box":r,need:n,have:simulation.stored(r as Resource)}))];
  const plot=isBuilding(tool)?dimensions(tool,scene.rotation,isLivestock(tool)?scene.penPlot:tool==='farm'?scene.farmPlot:tool==='market'?scene.marketPlot:undefined):null;
  placementCost.innerHTML='<b>'+d.name+'</b>'+(plot?'<span class="plot-size">'+plot.join(' × ')+' · '+plot[0]*plot[1]+' tiles</span>':'')+'<div>'+rows.map(r=>'<span class="'+(r.have<r.need?'shortage':'')+'">'+icon(r.icon)+r.need+' '+r.name+(r.have<r.need?' · have '+Math.floor(r.have):'')+'</span>').join('')+'</div>';
  placementCost.style.left=Math.max(8,Math.min(costPointer.x+20,$(".world").clientWidth-placementCost.offsetWidth-8))+"px";
  placementCost.style.top=Math.max(8,Math.min(costPointer.touch?costPointer.y-placementCost.offsetHeight-25:costPointer.y+22,$(".world").clientHeight-placementCost.offsetHeight-90))+"px";
}
const placementPointer=(event:PointerEvent)=>{if(!(event.target instanceof HTMLCanvasElement)){costPointer=null;placementCost.hidden=true;return;}const bounds=$(".world").getBoundingClientRect();costPointer={x:event.clientX-bounds.left,y:event.clientY-bounds.top,touch:event.pointerType==='touch'};updatePlacementCost();};
$(".world").addEventListener("pointermove",placementPointer);
$(".world").addEventListener("pointerdown",placementPointer);
$(".world").addEventListener("pointerleave",()=>{costPointer=null;placementCost.hidden=true;});
const hoverLabel=document.createElement("div");hoverLabel.className="building-hover-name";hoverLabel.hidden=true;$(".world").append(hoverLabel);
scene.onBuildingHover=(id,x,y)=>{const b=id?simulation.building(id):undefined;hoverLabel.hidden=!b;if(!b)return;hoverLabel.textContent=buildingName(b);hoverLabel.style.left=Math.max(8,Math.min(x+16,$(".world").clientWidth-hoverLabel.offsetWidth-8))+"px";hoverLabel.style.top=Math.max(8,y-38)+"px";};
scene.onEyedropper=(kind,rotation,plot)=>{scene.rotation=rotation;if(isLivestock(kind)&&plot)scene.penPlot=[...plot];if(kind==='farm'&&plot)scene.farmPlot=[...plot];if(kind==="market"&&plot)scene.marketPlot=[...plot];setTool(kind,true);toast(`Selected ${isBuilding(kind)?BUILDINGS[kind].name:isDecoration(kind)?DECORATIONS[kind].name:kind}. Click to place another.`);};
scene.onSelectDecoration=(id)=>scene.onSelectWorld({kind:'decoration',id});
scene.onSelectWorld=(selection)=>{
  setPanelOpen(false);closeInspection();
  selectedWorld=selection;scene.selectedWorld=selection;
  renderWorldInspector();scene.drawOverlay();
};
scene.onDecorationRemove=async(id)=>{const result=await sendCommand({type:"removeDecoration",id});toast(result.message);if(result.ok){scene.redraw();save(false);updateUI();}};
scene.onRemoveApply=async(from,to)=>{const result=await sendCommand({type:"removeStroke",from,to});toast(result.message);if(result.ok){scene.redraw();save(false);updateUI();}};
scene.onTile = async (p: Point) => {
  const simulation=scene.simulation,deposit=depositAt(scene.view.from(p));
  if (tool === "terrain") {
    scene.previewTerrain(p);
    return;
  }
  if (tool === "inspect") {
    const original=scene.view.from(p),work=roadWorkAt(simulation.state,p);
    if(work){const site=roadWorkSites(scene.view.source.state).find(s=>s.works.some(w=>w.id===work.id));if(site){scene.onSelectRoadWork(site);return;}}
    const decoration=simulation.decorationAt(p.x,p.y);
    const b = simulation.buildingAt(p.x, p.y);
    if(b)scene.onSelect(b.id);
    else if(decoration)scene.onSelectDecoration(decoration.id);
    else if(simulation.roads.has(key(p)))scene.onSelectWorld({kind:'road',point:original});
    else if(deposit)scene.onSelectWorld({kind:'deposit',id:deposit});
    else closeInspection();
    return;
  }
  const result = await sendCommand(
    tool === "move"
      ? {
          type: "move",
          id: scene.movingBuilding!,
          ...p,
          rotation: scene.rotation,
        }
      : tool === "bulldoze"
        ? { type: "demolish", ...p }
        : { type: "place", kind: tool, rotation: scene.rotation, ...(isLivestock(tool)?{plot:scene.penPlot}:tool==='farm'?{plot:scene.farmPlot}:tool==="market"?{plot:scene.marketPlot}:{}), ...p },
  );
  toast(result.message);
  if (result.ok) {
    if(tool!=="bulldoze")townAudio.place();
    if (tool === "move") {
      const id = scene.movingBuilding!;
      setTool("inspect");
      scene.onSelect(id);
    }
    scene.redraw();
    if (isBuilding(tool)) {
      const site = simulation.buildingAt(p.x, p.y);
      if (site?.kind==='farm'){setTool('inspect');scene.onSelect(site.id);}
      else if (site?.construction) scene.onSelect(site.id);
    }
    save(false);
    updateUI();
  }
};
scene.onRoadPreview = (plan) => {
  const label = document.querySelector<HTMLElement>("#road-stroke-cost");
  if (!label) return;
  label.textContent = plan ? `${plan.additions.length} new · ${plan.upgrades.length} upgrades · ${plan.cost} gold${Object.entries(plan.materials).map(([r,n])=>` · ${n} ${r}`).join("")}${plan.bridges ? ` · ${plan.bridges} bridge tiles` : ""}${plan.error ? ` — ${plan.error}` : ""}` : "";
  label.classList.toggle("invalid", !!plan?.error);
};
scene.onRoadApply = async (from, to) => {
  const result = await sendCommand({ type: "roadStroke", from, to, roadType: scene.roadType });
  toast(result.message);
  if (result.ok) { townAudio.place(); scene.redraw(); save(false); updateUI(); }
};
scene.onTerrainPreview = (plan) => {
  const label = document.querySelector("#terrain-cost"),
    button = document.querySelector<HTMLButtonElement>("#apply-terrain");
  if (label)
    label.textContent = plan
      ? (plan.error ??
        `${scene.terrainCommand()?.mode} · ${plan.changes.length} tiles · ${plan.cost} gold`)
      : "Choose ground to preview the brush.";
  if (button) button.disabled = !plan || !!plan.error;
};
scene.onTerrainApply = async (command) => {
  const result = await sendCommand(command);
  toast(result.message);
  if (result.ok) {
    scene.redraw();
    save(false);
    updateUI();
    renderPanel();
  }
};
scene.onHover = (p) => {
  const simulation=scene.simulation,original=p&&scene.view.from(p),deposit=original&&depositAt(original);
  hovered = p;
  updateEntranceHint();
  const work=p&&roadWorkAt(simulation.state,p);
  const surface = work?`${work.operation==='remove'?'Road removal':'Road construction'} · ${Math.floor(work.completed/work.required*100)}% · ${simulation.state.agents.some(a=>a.roadWork===work.id)?'Crew assigned':'Waiting for an available worker'}`:p && simulation.roads.has(key(p))
    ? terrainCell(p.x, p.y, simulation.state.terrain).kind === "water"
      ? `${roadName(scene.view.source,original!)} · ${ROAD_TYPES[roadTypeAt(simulation.state.roadTypes,p)].description.toLowerCase()}`
      : `${ROAD_TYPES[roadTypeAt(simulation.state.roadTypes, p)].name} road · ${ROAD_TYPES[roadTypeAt(simulation.state.roadTypes, p)].description.toLowerCase()}`
    : "";
  $("#tile-label").textContent = p
    ? `${original!.x}, ${original!.y}${surface ? " · " + surface : deposit ? " · " + DEPOSITS[deposit] + " deposit" : ""}`
    : "";
};
scene.onSelectAgent = (id) => {
  closeInspection();
  const agent=simulation.state.agents.find(a=>a.id===id);
  if(agent?.kind==="person")townAudio.person(agent.resident??agent.id);else if(agent)townAudio.vehicle();
  selectedTraffic = null;
  selectedRoadWork=null;scene.selectedRoadWorks=[];
  selected = null;
  scene.selected = null;
  selectedAgent = id;
  scene.selectedAgent = id;
  scene.drawOverlay();
  renderAgentInspector();
};
scene.onSelect = (id) => {
  closeInspection();
  const building=id!==null?simulation.building(id):undefined;
  if(building)townAudio.building(building.kind,!!building.construction);
  selectedTraffic = null;
  selectedRoadWork=null;scene.selectedRoadWorks=[];
  selectedAgent = null;
  scene.selectedAgent = null;
  selected = id;
  scene.selected = id;
  scene.drawOverlay();
  renderInspector();
};
scene.onSelectBoat = (id) => {
  scene.onSelect(id);
  document.querySelector("#boat-detail")?.scrollIntoView({ block: "nearest" });
};
scene.onCamera = () => {
  if ($("#zoom-level"))
    $("#zoom-level").textContent =
      `${Math.round(scene.cameras.main.zoom * 100)}%`;
  drawMinimap();
};
function renderInspector() {
  selectedTraffic = null;
  selectedRoadWork=null;scene.selectedRoadWorks=[];
  const b = selected ? simulation.building(selected) : null;
  const panel = $("#inspector");
  panel.hidden = !b;
  if (!b) return;
  panel.dataset.buildingView = `${b.id}:${b.houseTier ?? 1}:${b.level ?? 1}:${!!b.construction}:${!!b.construction?.demolition}:${b.crop}:${b.nextCrop}:${b.cut}`;
  panel.scrollTop = 0;
  const d = {...BUILDINGS[b.kind],recipe:buildingRecipe(b)};
  panel.innerHTML = `<button id="close-inspector" class="icon-button close" aria-label="Close building details">${icon("close")}</button><span class="eyebrow">${isHome(b.kind) ? `HOME · TIER ${b.houseTier ?? b.level ?? 1} OF 3` : d.category === "production" ? "LITTLE INDUSTRIES" : "AROUND TOWN"}</span>${frame(b.kind, "inspector-art", b.rotation, b.houseTier,b.crop)}<h3>${buildingName(b)}</h3><div id="building-status" class="building-status"></div><section id="building-needs" class="building-needs" aria-label="Building needs"></section>${b.kind === "farm" ? '<section id="farm-growth" aria-label="Crop growth stages"></section>' : ""}${b.kind === "fishery" && !b.construction ? '<section id="boat-detail" class="boat-detail"></section>' : ""}${b.kind === "house" ? '<div id="house-upgrade"></div>' : ""}${d.recipe ? '<section id="production-logistics" class="production-logistics" aria-label="Goods routes and workers"></section>' : ""}<div id="building-detail"></div>${d.recipe || isLeisure(b.kind) || b.kind === "market" ? '<button id="toggle-production" class="primary"></button>' : ""}`;
  if(b.kind==='farm'){
    $('#building-status').insertAdjacentHTML('afterend','<section id="farm-crop" aria-label="Choose farm crop"><h4>Crop</h4><div class="crop-choices" role="group" aria-label="Farm crop">'+Object.entries(CROPS).map(([id,c])=>'<button data-farm-crop="'+id+'" aria-pressed="'+((b.nextCrop??b.crop)===id)+'">'+(id==='wheat'?'Wheat → Grain':c.name)+'<small>'+Math.floor(c.grow/60)+'m '+c.grow%60+'s</small></button>').join('')+'</div><p class="muted">'+(b.nextCrop?'Growing '+CROPS[b.crop??'wheat'].name.toLowerCase()+' now. '+CROPS[b.nextCrop].name+' next, after this harvest is collected.':b.crop?'Plant the whole field, then harvest. Changing crops applies after the current harvest.':'Choose what to grow. Farmers will start once the land is clear and connected.')+'</p></section>');
    $('#farm-crop').onclick=async event=>{const choice=(event.target as Element).closest<HTMLButtonElement>('[data-farm-crop]');if(!choice)return;const result=await sendCommand({type:'crop',id:b.id,crop:choice.dataset.farmCrop as Crop});toast(result.message);if(result.ok){scene.redraw();save(false);renderInspector();updateUI();}};
  }
  if (d.recipe)
    $("#production-logistics").onclick = (event) => {
      const link = (event.target as Element).closest<HTMLButtonElement>(
        "[data-logistics-building]",
      );
      if (!link) return;
      const id = Number(link.dataset.logisticsBuilding);
      scene.onSelect(id);
      scene.focusBuilding(id);
    };
  $("#building-needs").insertAdjacentHTML(
    "afterend",
    '<div class="building-actions"><p id="building-next-step" class="next-step" hidden></p><div id="building-primary"></div><small id="primary-action-reason" class="upgrade-reason"></small><button id="resolve-issue" hidden></button><details id="building-more"><summary>More actions</summary><div id="building-menu-items"></div></details></div>',
  );
  if (b.construction) {
    $(".building-actions").insertAdjacentHTML(
      "beforebegin",
      '<section id="construction-crew" class="construction-crew" aria-label="Assigned builders"></section>',
    );
    $("#construction-crew").onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "[data-builder]",
      );
      if (!button) return;
      const member = constructionCrew(simulation, b).find(
        (c) => c.resident.id === Number(button.dataset.builder),
      );
      if (!member) return;
      setTool("inspect");
      if (member.agent) {
        scene.onSelectAgent(member.agent.id);
        scene.focusAgent(member.agent.id);
      } else {
        scene.onSelect(member.resident.home);
        scene.focusBuilding(member.resident.home);
      }
    };
  }
  if (b.construction && !d.recipe && !isLeisure(b.kind))
    panel.insertAdjacentHTML(
      "beforeend",
      '<button id="toggle-production"></button>',
    );
  if (b.kind === "house") {
    $("#house-upgrade").hidden = !!b.construction;
    if (!b.construction) $(".building-actions").after($("#house-upgrade"));
    const tier = b.houseTier ?? 1;
    if (tier < 3) {
      const nextTier = (tier + 1) as HouseTier,
        next = HOUSE_TIERS[nextTier];
      $("#house-upgrade").innerHTML =
        `<div class="upgrade-heading">${frame("house", "upgrade-art", b.rotation, nextTier)}<div><span class="eyebrow">NEXT · TIER ${nextTier}</span><b>${next.name}</b><small>${houseCapacity(b)} → ${next.capacity} residents · same plot</small></div></div><div id="upgrade-costs" class="upgrade-costs"></div><button id="upgrade-house" class="primary">Upgrade to ${next.name.toLowerCase()}</button><p id="upgrade-reason" class="upgrade-reason" aria-live="polite"></p>`;
      $("#upgrade-house").onclick = async () => {
        const result = await sendCommand({ type: "upgrade", id: b.id });
        toast(result.message);
        if (result.ok) {
          scene.redraw();
          save(false);
          renderInspector();
          updateUI();
        } else updateInspector();
      };
    } else
      $("#house-upgrade").innerHTML =
        '<p class="upgrade-complete">Fully upgraded · room for 9 residents</p>';
  }
  if (isExtractor(b.kind) && !b.construction) {
    panel.insertAdjacentHTML(
      "beforeend",
      '<section id="deposit-upgrade"><h4>Dig deeper · same site</h4><p id="deepen-benefit"></p><div id="deepen-costs" class="upgrade-costs"></div><p id="deepen-reason" class="upgrade-reason" aria-live="polite"></p></section><button id="deepen-deposit">Dig deeper</button>',
    );
    $(".building-actions").after($("#deposit-upgrade"));
    $("#deepen-deposit").onclick = async () => {
      const result = await sendCommand({ type: "deepen", id: b.id });
      toast(result.message);
      if (result.ok) {
        scene.redraw();
        save(false);
        renderInspector();
        updateUI();
      } else updateInspector();
    };
  }
  if (b.kind !== "house" && nextUpgrade(b) && !b.construction) {
    const next = nextUpgrade(b)!;
    $(".building-actions").insertAdjacentHTML(
      "afterend",
      `<section id="industry-upgrade"><h4>Upgrade to level ${next.level}</h4><p>${escapeHtml(next.benefit)}</p><div id="industry-upgrade-costs" class="upgrade-costs"></div><p id="industry-upgrade-reason" class="upgrade-reason"></p></section>`,
    );
    panel.insertAdjacentHTML(
      "beforeend",
      `<button id="upgrade-building">Upgrade to level ${next.level}</button>`,
    );
    $("#upgrade-building").onclick = async () => {
      const result = await sendCommand({ type: "upgrade", id: b.id });
      toast(result.message);
      if (result.ok) {
        scene.redraw();
        save(false);
        renderInspector();
        updateUI();
      } else updateInspector();
    };
  }
  if (!b.construction && (isLeisure(b.kind) || isHome(b.kind)))
    $(".building-actions").insertAdjacentHTML(
      "afterend",
      '<section id="service-detail"></section>',
    );
  if (!b.construction?.demolition) {
    panel.insertAdjacentHTML(
      "beforeend",
      '<button id="move-building" class="primary">Move building</button>',
    );
    $("#move-building").onclick = () => {
      scene.movingBuilding = b.id;
      scene.rotation = scene.view.facing(b.rotation);
      setTool("move");
    };
  }
  $("#close-inspector").onclick = closeInspection;
  if (d.recipe || isLeisure(b.kind) || b.kind === "market" || b.construction)
    $("#toggle-production").onclick = async () => {
      const result = await sendCommand({ type: "toggle", id: b.id });
      toast(result.message);
      scene.redraw();
      save(false);
      updateInspector();
    };
  const fold=(id:string,label:string)=>{const content=document.getElementById(id);if(!content)return;const details=document.createElement("details");details.className="inspector-fold";details.innerHTML=`<summary>${label}</summary>`;content.before(details);details.append(content);};
  fold("building-detail","Inventory & production");fold("production-logistics","Routes & workers");fold("boat-detail","Fishing boat");fold("service-detail","Service area");fold("construction-crew","Assigned builders");fold("industry-upgrade","Upgrade costs");fold("deposit-upgrade","Excavation costs");fold("house-upgrade","Upgrade costs");
  updateInspector();
}
function closeInspection() {
  selectedWorld=null;scene.selectedWorld=null;
  selectedTraffic = null;
  selectedRoadWork=null;scene.selectedRoadWorks=[];
  selected = null;
  selectedAgent = null;
  scene.selected = null;
  scene.selectedAgent = null;
  $("#inspector").hidden = true;
  scene.drawOverlay();
}

function updateBuildingActions(b: Building) {
  const guide = buildingGuidance(simulation, b, scene.productionView(b.id));
  const resolve = $<HTMLButtonElement>("#resolve-issue");
  resolve.hidden = !guide;
  $("#building-next-step").hidden = !guide;
  if (guide) {
    $("#building-next-step").textContent =
      `${guide.message.split(/(?<=\.)\s/)[0]}`;
    resolve.textContent = guide.label;
    resolve.disabled =
      guide.action.type === "deepen" && !!simulation.canDeepen(b.id);
    resolve.onclick = () => {
      const current = buildingGuidance(
        simulation,
        b,
        scene.productionView(b.id),
      );
      if (current) runGuidance(b, current.action);
      else updateInspector();
    };
  }
  const buttons = [
    "resolve-issue",
    "upgrade-house",
    "upgrade-building",
    "deepen-deposit",
    "toggle-production",
    "move-building",
  ]
    .map((id) => document.getElementById(id) as HTMLButtonElement | null)
    .filter((button): button is HTMLButtonElement => !!button);
  const primary = buttons.find(
    (button) =>
      button.id ===
      (b.kind === "house" && !b.construction && (b.houseTier ?? 1) < 3
        ? "upgrade-house"
        : b.kind === "cottage" && !b.construction && nextUpgrade(b)
          ? "upgrade-building"
        : guide
          ? "resolve-issue"
          : b.construction
            ? "toggle-production"
            : isExtractor(b.kind)
              ? "deepen-deposit"
              : nextUpgrade(b)
                ? "upgrade-building"
                : BUILDINGS[b.kind].recipe
                  ? "toggle-production"
                  : "move-building"),
  )!;
  $("#primary-action-reason").textContent=primary.disabled?(primary.id.includes("upgrade")?simulation.canUpgrade(b.id):simulation.canDeepen(b.id))??"":"";
  if (primary.id === "upgrade-house")
    $("#building-primary").after($("#building-next-step"));
  for (const button of buttons) {
    const isPrimary = button === primary;
    button.classList.toggle("primary", isPrimary);
    const parent = $(isPrimary ? "#building-primary" : "#building-menu-items");
    if (button.parentElement !== parent) parent.append(button);
    button.hidden =
      button.id === "resolve-issue"
        ? !guide
        : (button.id === "upgrade-house" && !!b.construction) ||
          (button.id === "deepen-deposit" && guide?.action.type === "deepen") ||
          (button.id === "toggle-production" &&
            guide?.action.type === "toggle") ||
          (button.id === "move-building" && guide?.action.type === "move");
  }
  $("#building-more").hidden = !buttons.some(
    (button) => button !== primary && !button.hidden,
  );
}
function runGuidance(b: Building, action: GuidanceAction) {
  if(action.type==='crop'){const choices=$('#farm-crop');choices.scrollIntoView({block:'nearest'});choices.querySelector<HTMLButtonElement>('button')?.focus();}
  else if (action.type === "toggle") $("#toggle-production").click();
  else if (action.type === "deepen") $("#deepen-deposit").click();
  else if (action.type === "move") $("#move-building").click();
  else if (action.type === "inspect") {
    scene.onSelect(action.id);
    scene.focusBuilding(action.id);
  } else if (action.type === "agent") {
    scene.onSelectAgent(action.id);
    scene.focusAgent(action.id);
  } else if (action.type === "workforce") togglePanel("town");
  else {
    scene.focusBuilding(b.id);
    if (action.type === "water") {
      scene.terrainMode = "water";
      setTool("terrain");
    } else if (action.type === "build") setTool(action.kind);
    if (action.type === "build" && action.kind === "road") {
      scene.guidanceBuilding = b.id;
      scene.drawOverlay();
      toast("Connect the front entrance to the warehouse road network.");
    }
  }
}
function renderWorldInspector(){
  const panel=$('#inspector');panel.hidden=false;panel.scrollTop=0;
  panel.innerHTML=`<button id="close-inspector" class="icon-button close" aria-label="Close details">${icon('close')}</button><span class="eyebrow" id="world-category"></span><div class="world-detail-heading"><span id="world-icon"></span><h3 id="world-title"></h3></div><div id="world-status" class="building-status" role="status"></div><div id="world-facts"></div><div class="building-actions"><p class="next-step" id="world-guidance"></p><button id="world-primary" class="primary"></button><details id="building-more"><summary>More actions</summary><div id="building-menu-items"></div></details></div>`;
  $('#close-inspector').onclick=closeInspection;updateWorldInspector();
}
function updateWorldInspector(){
  if(!selectedWorld)return;
  // Clicking a road and clicking its work badge lead to the same live crew panel.
  if(selectedWorld.kind==='road'){
    const work=roadWorkAt(simulation.state,selectedWorld.point);
    const site=work&&roadWorkSites(simulation.state).find(s=>s.works.some(w=>w.id===work.id));
    if(site){scene.onSelectRoadWork(site);return;}
  }
  const d=worldDetails(simulation,selectedWorld);
  if(!d){closeInspection();return;}
  $('#world-category').textContent=d.category;$('#world-title').textContent=d.title;
  const symbol=icon(d.icon);if($('#world-icon').innerHTML!==symbol)$('#world-icon').innerHTML=symbol;
  $('#world-status').textContent=d.status;$('#world-status').classList.toggle('warning',!!d.warning);
  const facts=d.facts.map(([label,value])=>`<div class="detail-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
  if($('#world-facts').innerHTML!==facts)$('#world-facts').innerHTML=facts;
  $('#world-guidance').textContent=d.guidance;
  $('#world-primary').textContent=d.primary.label;$('#world-primary').onclick=()=>runWorldAction(d.primary);
  $('#building-more').hidden=!d.more.length;
  const menu=$('#building-menu-items'),signature=JSON.stringify(d.more);
  if(menu.dataset.actions!==signature){
    menu.dataset.actions=signature;
    menu.innerHTML=d.more.map((a,i)=>`<button type="button" data-world-action="${i}">${escapeHtml(a.label)}</button>`).join('');
    menu.querySelectorAll<HTMLButtonElement>('button').forEach((button,i)=>button.onclick=()=>runWorldAction(d.more[i]));
  }
}
async function runWorldAction(action:WorldAction){
  if(action.type==='building'){scene.onSelect(action.id);const b=simulation.building(action.id);if(b)scene.focusTile(b.x,b.y);return;}
  if(action.type==='place'){
    if(action.roadType)scene.roadType=action.roadType;
    if(action.rotation!==undefined)scene.rotation=((action.rotation-scene.view.turn+4)%4) as 0|1|2|3;
    setTool(action.tool);return;
  }
  const result=await sendCommand({type:'removeDecoration',id:action.id});
  toast(result.message);
  if(result.ok){closeInspection();scene.redraw();save(false);updateUI();}
}
function renderAgentInspector() {
  $("#inspector").hidden = false;
  $("#inspector").innerHTML =
    `<button id="close-inspector" class="icon-button close" aria-label="Close traveller details">${icon("close")}</button><span class="eyebrow">ON THE MOVE</span><h3 id="traveller-name"></h3><p id="traveller-kind"></p><div id="traveller-status" class="building-status"></div><div id="traveller-detail"></div><button id="show-destination" class="primary">Show destination</button>`;
  $("#close-inspector").onclick = closeInspection;
  $("#show-destination").onclick = () => {
    const a = simulation.state.agents.find((a) => a.id === selectedAgent);
    if (a) {
      const work=simulation.state.roadWorks?.find(w=>w.id===a.roadWork);
      if(work){scene.focusTile(work.x,work.y);return;}
      const site = simulation.building(
        simulation.state.residents.find((r) => r.id === a.resident)?.job ?? 0,
      );
      const id = site?.construction
        ? site.id
        : (a.onsite ?? (a.returning ? a.source : a.target));
      if (site?.construction) scene.onSelect(id);
      scene.focusBuilding(id);
    }
  };
  updateAgentInspector();
}
function updateAgentInspector() {
  const a = simulation.state.agents.find((a) => a.id === selectedAgent);
  if (!a) {
    $("#traveller-status").textContent = "Journey complete";
    $("#show-destination").hidden = true;
    return;
  }
  const person = simulation.state.residents.find((r) => r.id === a.resident);
  const job = person?.job ? simulation.building(person.job) : null;
  $("#show-destination").textContent = job?.construction
    ? "Back to construction site"
    : "Show destination";
  const roadWork=simulation.state.roadWorks?.find(w=>w.id===a.roadWork);
  if(roadWork){
    $('#traveller-name').textContent=person?.name??'Road worker';$('#traveller-kind').textContent='Road worker';
    $('#traveller-status').textContent=a.wait>0?(roadWork.operation==='remove'?'Removing the road':'Laying the road'):'Walking to road work';
    $('#traveller-detail').innerHTML='<div class="detail-row"><span>Progress</span><b>'+Math.floor(roadWork.completed/roadWork.required*100)+'%</b></div>';
    $('#show-destination').textContent='Show road work';return;
  }
  if (a.onsite) {
    const site = simulation.building(a.onsite);
    if(site?.kind==='farm'&&!site.construction){
      const task=site.field?.tasks.find(t=>t.resident===a.resident),crop=CROPS[site.crop??'wheat'];
      $('#traveller-name').textContent=person?.name??'Farmer';$('#traveller-kind').textContent='Farmer';
      $('#traveller-status').textContent=task?.phase==='working'?(task.action==='sow'?'Planting crops':'Harvesting crops'):task?.phase==='returning'?'Returning to the field entrance':task?'Walking to a crop patch':'Waiting for crops to grow';
      $('#traveller-detail').innerHTML='<div class="detail-row"><span>Field</span><b>'+escapeHtml(buildingName(site))+'</b></div><div class="detail-row"><span>Carrying</span><b>'+(task?.cargo??0)+' '+RESOURCE_NAMES[crop.output]+'</b></div>';return;
    }
    if(site?.kind==="hunter"&&!site.construction){
      const trip=site.hunting?.find(t=>t.resident===a.resident);
      $("#traveller-name").textContent=person?.name??"Hunter";
      $("#traveller-kind").textContent="Hunter";
      $("#traveller-status").textContent=trip?.phase==="aiming"?"Aiming at wildlife":trip?.phase==="returning"?"Returning to the lodge":trip?"Walking into the woodland":"At the hunting lodge";
      $("#traveller-detail").innerHTML=`<div class="detail-row"><span>Workplace</span><b>${escapeHtml(buildingName(site))}</b></div><div class="detail-row"><span>Carrying</span><b>${trip?.cargo??0} meat</b></div><p class="muted">Meat enters the lodge's inventory when this hunter returns.</p>`;return;
    }
    if(site?.kind==="market"&&!site.construction){
      $("#traveller-name").textContent=person?.name??"Vendor";
      $("#traveller-kind").textContent="Market vendor";
      $("#traveller-status").textContent="Serving customers at the stall";
      $("#traveller-detail").innerHTML=`<div class="detail-row"><span>Workplace</span><b>${escapeHtml(buildingName(site))}</b></div><p class="muted">Sells delivered food and goods to nearby residents.</p>`;return;
    }
    if(site?.kind==="forester"&&!site.construction) {
      const trip=site.forestry?.find(t=>t.resident===a.resident);
      $("#traveller-name").textContent=person?.name??"Forester";
      $("#traveller-kind").textContent="Forestry worker";
      $("#traveller-status").textContent=trip?.phase==="chopping"?"Chopping a tree":trip?.phase==="returning"?"Carrying logs to the lodge":trip?"Walking to a tree":"At the forester lodge";
      $("#traveller-detail").innerHTML=`<div class="detail-row"><span>Workplace</span><b>${escapeHtml(buildingName(site))}</b></div><div class="detail-row"><span>Carrying</span><b>${trip?.cargo??0} wood</b></div><p class="muted">Wood enters the lodge's inventory only when this worker returns. Cut trees leave stumps that regrow.</p>`;
      return;
    }
    if(site&&isExtractor(site.kind)&&!site.construction){
      const trip=site.mining?.find(t=>t.resident===a.resident),resource=site.kind==="quarry"?"stone":"metal";
      $("#traveller-name").textContent=person?.name??"Miner";
      $("#traveller-kind").textContent=site.kind==="quarry"?"Stone miner":"Metal miner";
      $("#traveller-status").textContent=trip?.phase==="mining"?"Mining the rock face":trip?.phase==="returning"?"Carrying resources back":trip?"Walking to the deposit":"At the workplace";
      $("#traveller-detail").innerHTML=`<div class="detail-row"><span>Carrying</span><b>${trip?.cargo??0} ${resource}</b></div><p class="muted">Resources enter ${escapeHtml(buildingName(site))} when this worker returns.</p>`;return;
    }
    $("#traveller-name").textContent = person?.name ?? "Builder";
    $("#traveller-kind").textContent = "Construction worker";
    $("#traveller-status").textContent =
      site?.enabled && site.connected
        ? "Working on site"
        : "Construction paused";
    $("#traveller-detail").innerHTML =
      `<div class="detail-row"><span>Building</span><b>${site ? escapeHtml(buildingName(site)) : "Construction site"}</b></div><p class="muted">This resident is contributing labor to the construction progress.</p>`;
    return;
  }
  $("#traveller-name").textContent = person?.name ?? deliveryVehicle(a.cargo).name;
  const visit=parkVisitor(a,simulation.building(a.target));
  $("#traveller-kind").textContent = visit ? `Visiting ${buildingName(simulation.building(a.target)!).toLowerCase()}` :
    a.kind === "person"
      ? "Walking around Pinehaven"
      : a.kind === "car"
        ? `${civilianCar(a).name} · keeps right`
        : "Delivering goods · keeps right";
  const from = simulation.building(a.returning ? a.target : a.source),
    to = simulation.building(a.returning ? a.source : a.target);
  const label = (b: typeof from) =>
    b ? `${buildingName(b)} · ${b.x}, ${b.y}` : "No destination";
  $("#traveller-status").textContent = a.marketSlot!==undefined ? "Shopping at the market" : visit ? visit.walking?"Walking to a resting place":"Relaxing in the park" :
    a.wait > 0
      ? "At the building"
      : a.trafficWait
        ? "Waiting for traffic"
        : a.kind === "person"
          ? "Walking to destination"
          : "Driving to destination";
  $("#traveller-detail").innerHTML =
    `<div class="detail-row"><span>From</span><b>${escapeHtml(label(from))}</b></div><div class="detail-row"><span>Headed to</span><b>${escapeHtml(label(to))}</b></div>${a.cargo ? `<div class="detail-row"><span>Carrying</span><b>${a.amount} / ${DELIVERY_CAPACITY} ${RESOURCE_NAMES[a.cargo]}</b></div>` : ""}<p class="muted">The gold line shows this journey on the map.</p>`;
}
scene.onSelectRoadWork=(site)=>{
  site=roadWorkSites(simulation.state).find(s=>s.id===site.id)??site;
  setTool('inspect');setPanelOpen(false);closeInspection();
  selectedRoadWork=structuredClone(site);scene.selectedRoadWorks=site.works.map(w=>w.id);
  $('#inspector').hidden=false;
  $('#inspector').innerHTML=`<button id="close-inspector" class="icon-button close" aria-label="Close road work details">${icon('close')}</button><span class="eyebrow">STREETS & JOURNEYS</span><h3>${escapeHtml(site.label)}</h3><div id="roadwork-status" class="building-status"></div><div class="goal-progress" role="progressbar" aria-label="Road work progress" aria-valuemin="0" aria-valuemax="100"><span id="roadwork-progress"></span></div><div id="roadwork-summary" class="detail-row"></div><section id="roadwork-crew" class="construction-crew" aria-label="Assigned road workers"></section><p id="roadwork-guidance" class="muted"></p><button id="locate-roadwork" class="primary">Show work stretch</button>`;
  $('#close-inspector').onclick=closeInspection;
  $('#locate-roadwork').onclick=()=>scene.focusTile(site.anchor.x,site.anchor.y);
  $('#roadwork-crew').onclick=event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>('[data-road-worker]');if(!button)return;
    const id=Number(button.dataset.roadWorker);
    if(!simulation.state.agents.some(a=>a.id===id))return;
    scene.onSelectAgent(id);scene.focusAgent(id);
  };
  updateRoadWorkInspector();
};
function updateRoadWorkInspector(){
  const site=selectedRoadWork;if(!site)return;
  const ids=site.works.map(w=>w.id),jobs=new Map((simulation.state.roadWorks??[]).map(w=>[w.id,w]));
  const remaining=site.works.filter(w=>jobs.has(w.id)),crew=roadWorkCrew(simulation.state,ids);
  const required=site.works.reduce((n,w)=>n+w.required,0),done=site.works.reduce((n,w)=>n+(jobs.get(w.id)?.completed??w.required),0);
  const progress=Math.min(100,Math.floor(done/required*100)),working=crew.filter(c=>c.working).length,removal=site.works[0].operation==='remove';
  $('#roadwork-status').textContent=!remaining.length?'Work complete':working?`${working} working · ${crew.length-working} on the way`:crew.length?'Crew on the way':progress===100?'Cleared · finishing this removal stretch':'Waiting for a crew';
  $('#roadwork-progress').style.width=`${progress}%`;
  $('#roadwork-progress').parentElement!.setAttribute('aria-valuenow',String(progress));
  $('#roadwork-summary').innerHTML=`<span>${remaining.length} / ${site.works.length} tiles remaining</span><b>${progress}%</b>`;
  const html=`<h4>Assigned workers <span>${crew.length}</span></h4>${crew.length?`<div class="builder-roster">${crew.map(c=>`<button class="builder-row ${c.working?'on-site':''}" data-road-worker="${c.agent.id}" aria-label="Locate ${escapeHtml(c.resident.name)}"><span>${icon(c.working?'hammer':'people')}</span><span><b>${escapeHtml(c.resident.name)}</b><small>${c.status}</small></span><span class="builder-locate">${icon('arrow')}</span></button>`).join('')}</div>`:!remaining.length?'<p class="muted">The crew is available for other work.</p>':'<p class="muted">Workers appear here when assigned.</p>'}`;
  if($('#roadwork-crew').innerHTML!==html)$('#roadwork-crew').innerHTML=html;
  $('#roadwork-guidance').textContent=!remaining.length?'':crew.length?(removal?'Traffic can pass until the whole removal stretch is cleared.':'Existing roads stay open during upgrades. New roads open as each tile is finished.'):'Road crews use unassigned residents. Keep a walking route to this stretch; new crews set out during the day.';
}
function updateInspector() {
  if(selectedWorld){updateWorldInspector();return;}
  if(selectedRoadWork){updateRoadWorkInspector();return;}
  if (selectedTraffic) {
    updateTrafficInspector();
    return;
  }
  if (selectedAgent !== null) {
    updateAgentInspector();
    return;
  }
  if (!selected) return;
  const b = simulation.building(selected);
  if (!b) {
    $("#inspector").hidden = true;
    return;
  }
  const d = {...BUILDINGS[b.kind],recipe:buildingRecipe(b)};
  const alert = simulation.alert(b);
  if (
    $("#inspector").dataset.buildingView !==
    `${b.id}:${b.houseTier ?? 1}:${b.level ?? 1}:${!!b.construction}:${!!b.construction?.demolition}:${b.crop}:${b.nextCrop}:${b.cut}`
  ) {
    renderInspector();
    return;
  }
  $("#building-status").innerHTML = alert
    ? `<div class="status-heading">${icon(b.construction?.demolition ? "demolition" : alertIcon[alert.kind])}<b>${escapeHtml(alert.title)}</b></div>`
    : escapeHtml(simulation.status(b));
  const rows=buildingNeeds(simulation,b);
  $("#building-needs").innerHTML=`<div class="needs-heading"><b>Needs & stock</b><span>Have</span><span>Need</span></div>${rows.map(row=>`<div class="building-need ${row.ok?"met":"short"}"><span>${escapeHtml(row.label)}</span><b>${escapeHtml(row.have)}</b><small>${escapeHtml(row.need)}</small></div>`).join("")}${b.construction?`<div class="goal-progress"><span style="width:${Math.floor(b.construction.completed/b.construction.required*100)}%"></span></div>`:""}`;
  $("#building-status").classList.toggle("warning", !!alert);
  $("#building-status").dataset.kind = alert?.kind ?? "ready";
  $("#building-status").dataset.operation = b.construction?.demolition ? "demolition" : "";
  $("#building-detail").innerHTML =
    `<div class="detail-row"><span>Front entrance</span><b>${b.connected ? "Connected" : "Disconnected"}</b></div>${d.jobs ? `<div class="detail-row"><span>Workers</span><b>${b.workers} / ${buildingJobs(b)}</b></div>` : ""}${
      d.recipe
        ? `<div class="recipe">${d.recipe.input ? `${d.recipe.amount} ${d.recipe.input}` : "Gather"} <span>→</span> ${recipeProducts(d.recipe).map(([resource,count])=>`${count} ${RESOURCE_NAMES[resource]}`).join(" + ")}</div><div class="goal-progress"><span style="width:${(b.progress / d.recipe.seconds) * 100}%"></span></div><div class="detail-row"><span>Cycle</span><b>${b.progress.toFixed(1)} / ${d.recipe.seconds}s</b></div>${Object.entries(
            b.inventory,
          )
            .map(
              ([r, n]) =>
                `<div class="detail-row"><span>${r}</span><b>${n}</b></div>`,
            )
            .join(
              "",
            )}${isExtractor(b.kind) ? `<div class="detail-row"><span>Resources within reach</span><b>${nearbyDeposits(b).reduce((n,id)=>n+(simulation.state.deposits[id]??0),0).toLocaleString()}</b></div>` : ""}`
        : isHome(b.kind)
          ? `<div class="detail-row"><span>Residents</span><b>${simulation.state.residents.filter((r) => r.home === b.id).length} / ${houseCapacity(b)}</b></div><div class="residents">${simulation.state.residents
              .filter((r) => r.home === b.id)
              .map(
                (r) =>
                  `<div>${icon("people")}<span><b>${escapeHtml(r.name)}</b><small>${r.job ? BUILDINGS[simulation.building(r.job)!.kind].name : "Enjoying town life"}</small></span></div>`,
              )
              .join("")}</div>`
          : b.kind === "warehouse"
            ? Object.entries(b.inventory)
                .map(
                  ([r, n]) =>
                    `<div class="detail-row"><span>${r}</span><b>${n}</b></div>`,
                )
                .join("")
            : ""
    }`;
  if(b.kind==='farm'&&!b.construction&&b.crop){
    const counts=farmSummary(b,simulation.state.tick),crop=CROPS[b.crop??'wheat'];
    $('#building-needs').before($('#farm-growth'));
    $('#farm-growth').innerHTML='<div class="field-stages">'+Object.entries(counts).map(([stage,n])=>'<div class="field-stage '+stage+'"><b>'+n+'</b><span>'+({soil:'Soil',seeded:'Seeded',growing:'Growing',ripe:'Ready'}[stage])+'</span></div>').join('')+'</div>';
    $('#building-detail').innerHTML='<div class="detail-row"><span>Field size</span><b>'+(b.plot??[2,2]).join('×')+'</b></div><div class="detail-row"><span>Farmers on site</span><b>'+simulation.state.agents.filter(a=>a.onsite===b.id).length+' / '+buildingJobs(b)+'</b></div><div class="detail-row"><span>Harvest in storage</span><b>'+(b.inventory[crop.output]??0)+' '+RESOURCE_NAMES[crop.output]+'</b></div><p class="muted">'+crop.grow+' seconds to grow after planting. Farmers sow the whole field before harvesting. '+(b.crop==='wheat'?'Wheat is harvested as grain, used by flour mills and livestock.':'Vegetables go to warehouses and markets for food.')+'</p>';
  }
  if(isLivestock(b.kind)&&!b.construction){
    const herd=ensureHerd(b),capacity=livestockCapacity(b.kind,b.plot);
    $('#building-detail').innerHTML=`<div class="detail-row"><span>Animals / pen capacity</span><b>${herd.count} / ${capacity}</b></div><div class="detail-row"><span>Farmers on site</span><b>${simulation.state.agents.filter(a=>a.onsite===b.id).length} / ${buildingJobs(b)}</b></div><div class="detail-row"><span>${herd.count>=capacity?'Next birth → 4 meat':'Next birth'}</span><b>${Math.floor(herd.growth/LIVESTOCK[b.kind].birth*100)}%${herd.count>=capacity&&herd.growth>=LIVESTOCK[b.kind].birth&&(b.inventory.meat??0)>outputCapacity(b)-4?' · storage full':''}</b></div><div class="detail-row"><span>Grain feed</span><b>${b.inventory.grain??0}</b></div><div class="detail-row"><span>Meat for delivery</span><b>${b.inventory.meat??0}</b></div><p class="muted">At full capacity, each new birth supplies 4 meat and keeps the herd full.${b.kind==='cattle'?' Milk production continues.':b.kind==='chickens'?' Egg production continues.':''}</p>`;
  }
  if(b.kind==="market"&&!b.construction){$("#building-detail").innerHTML=`<div class="detail-row"><span>Plot / stalls</span><b>${(b.plot??[2,2]).join("×")} / ${marketStalls(b)}</b></div><div class="detail-row"><span>Vendors on site</span><b>${marketVendors(simulation,b).length} / ${buildingJobs(b)}</b></div><div class="detail-row"><span>Customers browsing</span><b>${simulation.state.agents.filter(a=>a.target===b.id&&a.marketSlot!==undefined).length}</b></div><div class="detail-row"><span>Goods sold</span><b>${b.produced}</b></div>${MARKET_GOODS.map(r=>`<div class="detail-row"><span>${RESOURCE_NAMES[r]}</span><b>${b.inventory[r]??0}</b></div>`).join("")}<p class="muted">Open 07:00–19:00. Food purchases feed the town; sales earn gold. Nearby residents walk here, and trucks replenish stock.</p>`;}
  if (d.recipe || isLeisure(b.kind) || b.kind === "market")
    $("#toggle-production").textContent = isLeisure(b.kind) || b.kind === "market"
      ? b.enabled
        ? "Close for visitors"
        : "Reopen for visitors"
      : b.enabled
        ? "Pause production"
        : "Resume production";
  if (d.recipe && !b.construction)
    $("#building-detail").insertAdjacentHTML(
      "afterbegin",
      `<div class="detail-row"><span>Level ${b.level ?? 1} · capacity</span><b>${Math.round(productionRate(b) * 100)}% pace · ${outputCapacity(b)} output</b></div>`,
    );
  if (d.recipe) updateLogistics(b);
  if(b.kind==="hunter"&&!b.construction){
    $("#building-detail").insertAdjacentHTML("beforeend",`<h4>Hunting area · ${HUNT_RADIUS}-tile reach</h4><div class="detail-row"><span>Reachable wildlife</span><b>${huntTargets(simulation,b).length}</b></div><p class="muted">Hunters track wildlife in woodland and carry meat back. Animals avoid buildings and roads; preserve forest around the lodge.</p>${(b.hunting??[]).map(t=>`<div class="detail-row"><span>${escapeHtml(simulation.state.residents.find(r=>r.id===t.resident)?.name??"Hunter")}</span><b>${t.phase==="aiming"?"Aiming":t.phase==="returning"?`Carrying ${t.cargo} meat`:"Tracking wildlife"}</b></div>`).join("")}`);
  }
  if(isExtractor(b.kind)&&!b.construction) {
    const targets=miningTargets(simulation,b);
    $("#building-detail").insertAdjacentHTML("beforeend",`<h4>Mining area · ${MINING_RADIUS}-tile reach</h4><div class="detail-row"><span>Reachable rock faces</span><b>${targets.length}</b></div><p class="muted">Miners use reachable matching deposits across this area and carry ore back. Green rocks can be reached. Dig deeper replenishes the assigned seam.</p>${(b.mining??[]).map(t=>`<div class="detail-row"><span>${escapeHtml(simulation.state.residents.find(r=>r.id===t.resident)?.name??"Miner")}</span><b>${t.phase==="mining"?"Mining":t.phase==="returning"?`Carrying ${t.cargo} ${b.kind==="quarry"?"stone":"metal"}`:"Walking to the deposit"}</b></div>`).join("")}`);
  }
  if (b.kind==="forester"&&!b.construction) {
    const reachable=forestTargets(simulation,b).length;
    const regrowing=simulation.state.decorations.filter(d=>harvestable(d)&&forestInside(b,d)&&treeStage(d,simulation.state.tick)!=="mature").length;
    $("#building-detail").insertAdjacentHTML("beforeend",`<h4>Woodland · ${FOREST_RADIUS}-tile reach</h4><div class="detail-row"><span>Reachable mature trees</span><b>${reachable}</b></div><div class="detail-row"><span>Regrowing stumps / saplings</span><b>${regrowing}</b></div><p class="muted">Foresters walk to natural oak, pine and birch trees, cut them, then carry 6 wood back. Trees fully regrow in ${REGROW_TICKS*STEP/60} minutes at normal speed. Planted garden trees are protected.</p>${(b.forestry??[]).map(t=>`<div class="detail-row"><span>${escapeHtml(simulation.state.residents.find(r=>r.id===t.resident)?.name??"Forester")}</span><b>${t.phase==="chopping"?"Chopping":t.phase==="returning"?`Carrying ${t.cargo} wood`:"Walking to a tree"}</b></div>`).join("")}`);
  }
  if (b.kind === "fishery" && !b.construction) {
    const trip = b.fishing,
      destination =
        trip?.phase === "returning"
          ? trip.path[0]
          : trip?.path[trip.path.length - 1];
    $("#boat-detail").innerHTML =
      `<h4>${icon("fish")} Fishing boat</h4><p>${escapeHtml(fishingStatus(b))}</p><div class="detail-row"><span>Catch aboard</span><b>${trip?.cargo ?? 0} fish</b></div><div class="detail-row"><span>Headed to</span><b>${trip ? `${trip.phase === "returning" ? "Pier" : "Fishing grounds"} · ${destination!.x}, ${destination!.y}` : "Moored"}</b></div><p class="muted">The blue line follows the boat. Fish become available when it returns to the pier.</p>`;
  }
  if (b.kind === "house" && (b.houseTier ?? 1) < 3) updateUpgrade(b);
  if (b.kind !== "house" && nextUpgrade(b) && !b.construction) {
    const next = nextUpgrade(b)!;
    const costs = [
      { name: "Gold", need: next.cost, have: simulation.state.money },
      ...Object.entries(next.materials).map(([r, need]) => ({
        name: RESOURCE_NAMES[r as Resource],
        need,
        have: simulation.stored(r as Resource),
      })),
    ];
    $("#industry-upgrade-costs").innerHTML = costs
      .map(
        (c) =>
          `<span class="${c.have < c.need ? "missing" : "ready"}">${c.need} ${c.name}<small>${c.have.toLocaleString()} available</small></span>`,
      )
      .join("");
    const reason = simulation.canUpgrade(b.id);
    $<HTMLButtonElement>("#upgrade-building").disabled = !!reason;
    $("#industry-upgrade-reason").textContent = reason
      ? [
          !b.connected ? reason : "",
          ...materialGuidance(simulation, next.cost, next.materials),
        ]
          .filter(Boolean)
          .join(" ") || reason
      : `${next.labour} worker-seconds · inventory stays here.`;
  }
  if (isLeisure(b.kind) && !b.construction) {
    const coverage = serviceCoverage(simulation, b);
    const open =
      !b.construction &&
      b.enabled &&
      b.connected &&
      b.workers >= buildingJobs(b) &&
      serviceOpen(b.kind, daylight(simulation.state.tick).hour);
    $("#service-detail").innerHTML =
      `<h4>${isReligion(b.kind)?"Religion":"Nearby leisure"} · level ${b.level ?? 1}</h4><p>${b.kind==='chapel'?(open?'Open for visits · 24 hours':'Open 24 hours when connected and staffed · requires one worker'):open ? "Open for visits" : b.kind === "tavern" ? "Evening hours: 17:00–02:00 · requires two staff" : b.kind==="church"?"Visits: 06:00–23:00 · requires two staff":"Daytime visits: 06:00–20:00"}</p><p>${coverage.residents} / ${coverage.capacity} nearby residents · maximum ${coverage.range} road tiles. Green homes are in reach; amber homes need more capacity.</p>${coverage.homes.map((h) => `<button class="goods-link" data-service-home="${h.home.id}"><span>${escapeHtml(buildingName(h.home))} · ${h.home.x}, ${h.home.y}</span><small>${h.served} served · ${h.tiles} road tiles · ~${Math.ceil(h.seconds)}s walk</small></button>`).join("") || '<p class="muted">No homes within walking distance. Place homes closer and connect their road entrances.</p>'}`;
    $("#service-detail").onclick = (event) => {
      const el = (event.target as Element).closest<HTMLElement>(
        "[data-service-home]",
      );
      if (el) {
        scene.onSelect(Number(el.dataset.serviceHome));
        scene.focusBuilding(Number(el.dataset.serviceHome));
      }
    };
  } else if (isHome(b.kind) && !b.construction) {
    const people = simulation.state.residents.filter((r) => r.home === b.id);
    const need = people.length
      ? Math.round(
          people.reduce((sum, r) => sum + (r.leisure ?? 60), 0) / people.length,
        )
      : 0;
    const nearby = simulation.state.buildings.filter(
      (s) =>
        isLeisure(s.kind) &&
        serviceCoverage(simulation, s).homes.some(
          (h) => h.home.id === b.id && h.served > 0,
        ),
    );
    $("#service-detail").innerHTML =
      `<h4>Leisure · ${need}% · Religion · ${people.length?Math.round(people.reduce((n,r)=>n+(r.faith??70),0)/people.length):0}%</h4><p>${nearby.length ? nearby.map((s) => escapeHtml(buildingName(s))).join(" · ") : "No nearby services. Add a park, tavern or church and connect it by a short road route."}</p><p class="muted">Needs improve after visits to the matching service. Workplaces must be within 28 road tiles; nearby jobs are assigned first.</p>`;
  }
  if (isExtractor(b.kind) && !b.construction) {
    const deposit=buildingDeposit(b)!;
    const depth = simulation.state.depositDepths?.[deposit] ?? 0;
    const next = deeperLayer(depth);
    $("#deepen-benefit").textContent =
      `Layer ${depth + 1} · ${(simulation.state.deposits[deposit]??0).toLocaleString()} remaining at ${deposit}. Next layer adds ${next.reserve.toLocaleString()} resources · ${next.labour} worker-seconds. Repeat whenever needed; the deposit stays here.`;
    const costs = [
      { name: "Gold", need: next.cost, have: simulation.state.money },
      ...Object.entries(next.materials).map(([r, need]) => ({
        name: RESOURCE_NAMES[r as Resource],
        need,
        have: simulation.stored(r as Resource),
      })),
    ];
    $("#deepen-costs").innerHTML = costs
      .map(
        (c) =>
          `<span class="${c.have < c.need ? "missing" : "ready"}">${c.need} ${c.name}<small>${c.have.toLocaleString()} available</small></span>`,
      )
      .join("");
    const reason = simulation.canDeepen(b.id);
    $<HTMLButtonElement>("#deepen-deposit").disabled = !!reason;
    $("#deepen-reason").textContent = reason
      ? [
          !b.connected ? reason : "",
          ...materialGuidance(simulation, next.cost, next.materials),
        ]
          .filter(Boolean)
          .join(" ") || reason
      : "Excavation pauses extraction. Stored goods stay here while builders prepare the next layer.";
  }
  if (b.construction) {
    const progress = Math.floor(
      (b.construction.completed / b.construction.required) * 100,
    );
    const onsite = simulation.state.agents.filter(
      (a) => a.onsite === b.id,
    ).length;
    const crew = constructionCrew(simulation, b);
    const roster = `<h4>Assigned builders <span>${crew.length} / ${builderCapacity(b)}</span></h4>${crew.length ? `<div class="builder-roster">${crew.map((c) => `<button class="builder-row ${c.onsite ? "on-site" : ""}" data-builder="${c.resident.id}" aria-label="Locate ${escapeHtml(c.resident.name)}, ${escapeHtml(c.status)}">${icon(c.onsite ? "hammer" : "people")}<span><b>${escapeHtml(c.resident.name)}</b><small>${escapeHtml(c.status)}</small></span><span class="builder-locate">Locate ${icon("arrow")}</span></button>`).join("")}</div><p class="muted">Teal markers show this crew on the map. Select a name to locate them.</p>` : `<p class="muted">${!b.enabled ? "Resume construction to assign builders." : !b.connected ? "Connect the entrance to the road network to assign builders." : "Waiting for unassigned residents. Add nearby homes or free workers from another building."}</p>`}`;
    const rosterElement = $("#construction-crew");
    if (rosterElement.dataset.roster !== roster) {
      rosterElement.innerHTML = roster;
      rosterElement.dataset.roster = roster;
    }
    $("#building-detail").innerHTML =
      `<h4>${b.construction.demolition ? "Demolition site" : b.construction.clearance ? "Clearing surface rocks" : b.construction.deeperTo !== undefined ? "Excavating layer " + (b.construction.deeperTo + 1) : b.construction.upgradeTo ? "Home improvements" : b.construction.upgradeLevel ? "Building upgrade" : "Construction site"}</h4><div class="goal-progress" role="progressbar" aria-label="Construction progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><div class="detail-row"><span>Progress</span><b>${progress}%</b></div><div class="detail-row"><span>Working on site</span><b>${onsite}</b></div><div class="detail-row"><span>Remaining labor</span><b>${Math.ceil(b.construction.required - b.construction.completed)} worker-seconds</b></div>${b.construction.clearance ? `<p class="muted">Builders must clear ${b.construction.clearance.tiles.length} rock tiles before foundations begin. Underground reserves remain in place.</p>` : b.construction.upgradeTo ? '<p class="muted">The current residents keep their home during the upgrade.</p>' : b.construction.demolition ? '<p class="muted">The plot stays occupied until the crew finishes. Stored goods and half the gold cost are then recovered.</p>' : '<p class="muted">Opens when construction is complete. Only builders on site contribute progress.</p>'}`;
    if (d.recipe) $("#production-logistics").hidden = true;
    $("#toggle-production").textContent = b.enabled
      ? b.construction.demolition ? "Pause demolition" : "Pause construction"
      : b.construction.demolition ? "Resume demolition" : "Resume construction";
  }
  updateBuildingActions(b);
}
scene.onSelectTraffic = (queue) => {
  closeInspection();
  selectedTraffic = queue.agents;
  $("#inspector").hidden = false;
  $("#inspector").innerHTML =
    `<button id="close-inspector" class="icon-button close" aria-label="Close traffic details">${icon("close")}</button><span class="eyebrow">STREETS & JOURNEYS</span><h3>Traffic queue</h3><div id="traffic-status" class="building-status warning"></div><p>Amber rings mark delayed vehicles; copper means a longer or larger queue. Short junction stops do not trigger a warning.</p><p>Give this area another connected road route, shorten busy delivery routes, or spread workplaces and homes across more streets. Cars sharing a clear lane can continue together; crossing paths still yield.</p><button id="traffic-road" class="primary">Add an alternate road</button><div id="traffic-vehicles"></div>`;
  $("#close-inspector").onclick = closeInspection;
  $("#traffic-road").onclick = () => {
    const id = selectedTraffic?.[0];
    if (id !== undefined) scene.focusAgent(id);
    setTool("road");
    toast("Join both ends of an alternate route to the existing roads.");
  };
  $("#traffic-vehicles").onclick = (event) => {
    const target = (event.target as Element).closest<HTMLButtonElement>(
      "[data-traffic-agent]",
    );
    if (!target) return;
    const id = Number(target.dataset.trafficAgent);
    scene.onSelectAgent(id);
    scene.focusAgent(id);
  };
  updateTrafficInspector();
};
function updateTrafficInspector() {
  const queue = trafficQueues(simulation.state.agents).find((q) =>
    q.agents.some((id) => selectedTraffic?.includes(id)),
  );
  $("#traffic-status").textContent = queue
    ? `${queue.agents.length} vehicles delayed · longest wait about ${Math.floor(queue.seconds)}s`
    : "Traffic has cleared";
  $("#traffic-status").classList.toggle("warning", !!queue);
  $("#traffic-road").hidden = !queue;
  if (queue) selectedTraffic = queue.agents;
  const html =
    queue?.agents
      .map((id) => {
        const a = simulation.state.agents.find((a) => a.id === id)!;
        const destination = simulation.building(
          a.returning ? a.source : a.target,
        );
        return `<button class="goods-link" data-traffic-agent="${id}"><span>${a.kind === "truck" ? "Delivery truck" : "Car"}</span><small>${destination ? escapeHtml(buildingName(destination)) : "Road journey"} · ${Math.floor((a.queuedTicks ?? 0) / 4)}s delayed</small>${icon("arrow")}</button>`;
      })
      .join("") ??
    '<p class="muted">The warning disappears automatically as vehicles move on.</p>';
  if ($("#traffic-vehicles").innerHTML !== html)
    $("#traffic-vehicles").innerHTML = html;
}
function updateLogistics(b: Building) {
  const view = scene.productionView(b.id);
  if (!view) return;
  const activity = productionActivity(simulation, view),
    recipe = buildingRecipe(b)!;
  const links = (
    connections: GoodsConnection[],
    direction: "input" | "output",
  ) =>
    connections
      .map((link) => {
        const other = simulation.building(
          direction === "input" ? link.source : link.target,
        )!;
        const state = !link.path
          ? "No road route"
          : !other.connected || !b.connected
            ? "Needs warehouse access"
            : !other.enabled || !b.enabled
              ? "Production paused"
              : "Road connected";
        return `<button class="goods-link ${direction}" data-logistics-building="${other.id}" aria-label="Inspect ${escapeHtml(buildingName(other))} at ${other.x}, ${other.y}"><span>${escapeHtml(buildingName(other))}</span><small>${other.x}, ${other.y} · ${state}</small>${icon("arrow")}</button>`;
      })
      .join("");
  const workers = simulation.state.residents.filter((r) =>
    view.workers.includes(r.id),
  );
  const visibleWorkers = activity.workers.filter(
    (a) => a.active !== false,
  ).length;
  const html = `<h4>Goods routes</h4><div class="goods-legend"><span class="input">Inputs</span><span class="output">Outputs</span><span class="worker">Workers</span></div><p class="logistics-hint">Arrows follow delivery direction. Rings mark related deliveries and travelling workers.</p><h5>Inputs${recipe.input ? ` · ${RESOURCE_NAMES[recipe.input]}` : ""}</h5>${links(view.inputs, "input") || `<p class="logistics-empty">${recipe.input ? "No supplier built yet." : "Gathered here; no delivered inputs."}</p>`}<h5>Outputs · ${buildingOutputs(b).map(r=>RESOURCE_NAMES[r]).join(" · ")}</h5>${links(view.outputs, "output") || '<p class="logistics-empty">No destination built yet.</p>'}<div class="goods-activity"><span class="input">${activity.incoming.length} incoming ${activity.incoming.length === 1 ? "delivery" : "deliveries"}</span><span class="output">${activity.outgoing.length} outgoing ${activity.outgoing.length === 1 ? "delivery" : "deliveries"}</span></div><p class="goods-workers"><b>${workers.length} assigned · ${visibleWorkers} travelling</b><span>${workers.length ? workers.map((r) => escapeHtml(r.name)).join(", ") : "No assigned workers"}</span></p>`;
  const panel = $("#production-logistics");
  if (panel.innerHTML !== html) panel.innerHTML = html;
}
function updateUpgrade(b: Building) {
  const next = HOUSE_TIERS[((b.houseTier ?? 1) + 1) as HouseTier];
  const costs = [
    { name: "Gold", need: next.cost, have: simulation.state.money },
    ...Object.entries(next.materials).map(([r, need]) => ({
      name: RESOURCE_NAMES[r as Resource],
      need,
      have: simulation.stored(r as Resource),
    })),
  ];
  $("#upgrade-costs").innerHTML = costs
    .map(
      (c) =>
        `<span class="${c.have < c.need ? "missing" : "ready"}">${c.need} ${c.name}<small>${c.have} available</small></span>`,
    )
    .join("");
  const reason = simulation.canUpgrade(b.id);
  $<HTMLButtonElement>("#upgrade-house").disabled = !!reason;
  $<HTMLButtonElement>("#upgrade-house").title =
    reason ?? "Start upgrading this home";
  const materials = materialGuidance(simulation, next.cost, next.materials);
  const steps = [
    ...(!b.connected
      ? [
          "Connect this home's front entrance to a warehouse using continuous roads. The road action in More actions shows the entrance.",
        ]
      : []),
    ...materials,
  ];
  $("#upgrade-reason").textContent = reason
    ? steps.join(" ") || reason
    : "Ready to upgrade. Three more residents · same plot. Builders work automatically; current residents keep their home.";
  $("#upgrade-reason").classList.toggle("blocked", !!reason);
  $<HTMLButtonElement>("#upgrade-house").setAttribute(
    "aria-describedby",
    "upgrade-reason",
  );
}
function drawMinimap() {
  $('#view-direction').textContent='View '+(scene.view.turn+1);
  const ctx = $<HTMLCanvasElement>("#minimap").getContext("2d")!;
  ctx.fillStyle = "#d5dfc9";
  ctx.fillRect(0, 0, 168, 102);
  const sx = 76 / SIZE,
    sy = 44 / SIZE;
  const map = (x: number, y: number) => {const p=scene.view.to({x,y});return{x:84+(p.x-p.y)*sx,y:6+(p.x+p.y)*sy};};
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const p = map(x, y);
      const cell = terrainCell(x, y, simulation.state.terrain);
      ctx.fillStyle =
        cell.kind === "water"
          ? "#82aaa0"
          : `hsl(91 21% ${55 + cell.height * 3}%)`;
      ctx.fillRect(p.x, p.y, sx + 0.4, sy + 0.4);
    }
  simulation.state.roads.forEach((k) => {
    const [x, y] = k.split(",").map(Number),
      p = map(x, y);
    ctx.fillStyle = terrainCell(x, y, simulation.state.terrain).kind === "water" ? "#c2a36c" : ROAD_TYPES[roadTypeAt(simulation.state.roadTypes, {x, y})].color;
    ctx.fillRect(p.x, p.y, sx + 0.4, sy + 0.4);
  });
  for (const [k, deposit] of Object.entries(DEPOSIT_TILES)) {
    const [x, y] = k.split(",").map(Number),
      p = map(x, y);
    ctx.fillStyle = DEPOSITS[deposit] === "stone" ? "#f6efd5" : "#ae603c";
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  simulation.state.buildings.forEach((b) => {
    const p = map(b.x, b.y);
    ctx.fillStyle =
      BUILDINGS[b.kind].category === "production" ? "#b77c51" : "#486553";
    ctx.fillRect(p.x, p.y - 1, 2, 2);
  });
  if (scene.cameras?.main) {
    const v = cameraViewport(scene.cameras.main);
    const x = 84 + (v.x * sx) / 32,
      y = 6 + (v.y * sy) / 16;
    const w = (v.width * sx) / 32,
      h = (v.height * sy) / 16;
    ctx.fillStyle = "#fff5cf22";
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#294f44";
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = "#fff6ce";
    ctx.strokeRect(x, y, w, h);
  }
}
for(const [id,turn] of [['rotate-view-left',-1],['rotate-view-right',1]] as const)$('#'+id).onclick=()=>{cancelTool();scene.rotateView(turn);drawMinimap();};
$("#minimap").title =
  "Tap to explore the valley · pale deposits: stone · copper deposits: metal";
$("#minimap").onclick = (event) => {
  const rect = $("#minimap").getBoundingClientRect();
  const u =
    (((event.clientX - rect.left) * 168) / rect.width - 84) / (76 / SIZE);
  const v =
    (((event.clientY - rect.top) * 102) / rect.height - 6) / (44 / SIZE);
  const p=scene.view.from({x:Math.max(0,Math.min(SIZE-1,(u+v)/2)),y:Math.max(0,Math.min(SIZE-1,(v-u)/2))});scene.focusTile(p.x,p.y);
};
function updateUI() {
  const s = simulation.state;
  townLog.update(s);
  const roadCrew=s.agents.filter(a=>a.roadWork!==undefined).length;
  const employed = s.residents.filter((r) => r.job !== null).length+roadCrew;
  const sites = s.buildings.filter((b) => b.construction && b.enabled);
  const buildersNeeded = sites.reduce(
    (total, b) => total + builderCapacity(b),
    roadBuildersNeeded(s),
  );
  const buildersAssigned = sites.reduce((total, b) => total + b.workers, roadCrew);
  $("#builders").textContent = `${buildersAssigned} / ${buildersNeeded}`;
  const builderSummary = `${buildersAssigned} builders assigned of ${buildersNeeded} needed at ${sites.length} building sites and ${s.roadWorks?.length??0} road tiles · ${Math.max(0, buildersNeeded - buildersAssigned)} more builders needed. Paused sites excluded; sites awaiting road access included.`;
  $(".resource.builders").title = builderSummary;
  $(".resource.builders").setAttribute("aria-label", builderSummary);
  $(".resource.builders").classList.toggle(
    "shortage",
    buildersAssigned < buildersNeeded,
  );
  $("#gold").textContent = Math.floor(s.money).toLocaleString();
  const income=incomeSummary(s.tick,s.income);
  $(".resource.gold small").textContent=`+${income.total.toLocaleString()} / day`;
  $(".resource.gold").title=`Income over the last game day: ${income.total} gold · taxes ${income.tax} · exports ${income.exports} · market sales ${income.market}. Building refunds are excluded.`;
  updatePlacementCost();
  const bread = simulation.stored("bread"),
    fish = simulation.stored("fish"),meat=simulation.stored("meat"),sausages=simulation.stored("sausages");
  $("#food-stock").textContent = String(FOOD_RESOURCES.reduce((n,r)=>n+simulation.stored(r),0)+(s.marketMeals??0));
  $(".resource.food-stock").title =
    `${bread} bread + ${fish} fish + ${meat} meat + ${sausages} sausages + ${simulation.stored("potatoes")} potatoes + ${simulation.stored("carrots")} carrots in warehouses · ${s.marketMeals??0} meals bought at markets · ${Math.ceil(s.residents.length / 3)} food needed per day · ${s.food}% of last day's needs met`;
  $(".resource.food-stock").setAttribute(
    "aria-label",
    $(".resource.food-stock").title,
  );
  for (const r of ["wood", "planks", "bricks", "stone", "metal"] as const)
    $("#" + r).textContent = simulation.stored(r).toString();
  $("#population").textContent = `${employed} / ${s.residents.length}`;
  $(".resource.population").title =
    `${employed} of ${s.residents.length} residents have jobs · ${s.residents.length - employed} without an assigned job`;
  $(".resource.population").setAttribute(
    "aria-label",
    $(".resource.population").title,
  );
  $("#happiness").textContent = simulation.happiness() + "%";
  $("#leisure").textContent = simulation.leisure() + "%";
  $(".resource.happiness").title =
    `Food ${s.food}% · religion ${simulation.faith()}% · leisure ${simulation.leisure()}% · actual nearby visits improve leisure`;
  daylightUI.update(s.tick);
  $("#goal-progress").style.width =
    Math.min(100, (s.delivered / 30) * 100) + "%";
  $("#goal-count").textContent =
    s.delivered < 30
      ? `${s.delivered} / 30 goods delivered`
      : `${s.delivered} goods delivered · ${s.exported} tools exported`;
  $("#goal-copy").textContent =
    s.delivered < 30
      ? "Let your first deliveries find their way home."
      : "Your little industries are finding their rhythm.";
  const needs=townNeeds(simulation),shortages=needs.filter(n=>n.have<n.need);
  $("#town-needs-button").textContent=shortages.length?`${shortages.length} town needs`:"Town needs met";
  $("#town-needs-button").classList.toggle("shortage",shortages.length>0);
  if (tab === "town") {
    $("#town-needs").innerHTML=needs.map(n=>`<div class="town-need ${n.have<n.need?"short":"met"}"><div><b>${n.label}</b><small>${n.have<n.need?`${n.need-n.have} more ${n.unit} needed`:n.id==="food"?`${n.need?Math.floor(n.have/n.need):0} days in reserve`:"Need met"}</small></div><strong>${n.have} <span>/ ${n.need}</span></strong>${n.have<n.need&&n.action?`<button class="quiet" data-need="${n.id}">${n.action.label}</button>`:""}</div>`).join("");
    $("#town-stats").innerHTML =
      `<div class="detail-row"><span>Employed residents</span><b>${employed} / ${s.residents.length}</b></div><div class="detail-row"><span>Deliveries on the road</span><b>${s.agents.filter((a) => a.kind === "truck").length}</b></div><div class="detail-row"><span>Tools exported</span><b>${s.exported}</b></div><div class="detail-row"><span>Food needs met</span><b>${s.food}%</b></div>`;
    const totals = simulation.totals();
    $("#inventory").innerHTML = RESOURCES.map(
      (r) =>
        `<div class="inventory-row">${icon(r === "bread" || r === "fish" || r === "wood" || r === "stone" || r === "metal" ? r : "box")}<span>${RESOURCE_NAMES[r]}</span><b>${simulation.stored(r)}</b><b>${totals[r]-simulation.stored(r)}</b></div>`,
    ).join("");
  }
  updateInspector();
  drawMinimap();
}
function save(showToast = true) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(simulation.snapshot()));
    lastSave = Date.now();
    $("#save-status").textContent = "Saved on this device";
    if (showToast) toast("Pinehaven saved on this device.");
  } catch {
    $("#save-status").textContent = "Save unavailable";
    if (showToast)
      toast("Device storage is unavailable. Export a save from settings.");
  }
}
function replaceTown(next: Simulation) {
  daylightUI.reset();
  simulation = next;
  gateway.simulation = next;
  scene.replace(next);
  closeInspection();
  selected = null;
  selectedAgent = null;
  $("#inspector").hidden = true;
  updateUI();
  save(false);
}
function openModal(content: string) {
  modalPreviousSpeed = scene.speed;
  scene.speed = 0;
  $("#dialog-content").innerHTML = content;
  $<HTMLDialogElement>("#dialog").showModal();
}
function closeModal() {
  $<HTMLDialogElement>("#dialog").close();
  scene.speed = modalPreviousSpeed;
}
function showChains() {
  openModal(
    `<span class="eyebrow">EVERY LITTLE THING CONNECTS</span><h2>Made in Pinehaven.</h2><p>Factories need people, roads, and the right ingredients. Trucks move real inventory between connected buildings.</p><div class="chain"><b>Daily bread</b><span>Wheat field → Flour mill → Bakery → Warehouse</span><small>Grain becomes flour, then bread. Bread feeds citizens each day.</small></div><div class="chain"><b>Fresh from the shore</b><span>Shoreline fishery → Warehouse → Citizens</span><small>Two land tiles for the hut, two water tiles for the dock. Fish and bread both satisfy food needs: one food per three residents each day.</small></div><div class="chain"><b>From woodland to table</b><span>Hunter → Butcher → Market / Warehouse</span><small>Hunters bring meat home. Butchers turn two meat into four sausages, feeding more citizens; markets sell sausages for 8 gold.</small></div><div class="chain"><b>A useful little industry</b><span>Forester → Sawmill → Warehouse · Metal mine → Workshop → Warehouse</span><small>Wood becomes construction planks. Two metal become one tool; exported tools earn 35 gold each.</small></div><div class="chain"><b>Brickmaking</b><span>Stone quarry → Brickworks → Warehouse → Brick roads and bridges</span><small>Two stone become four bricks. New brick road tiles use one brick; bridge tiles use four.</small></div><div class="chain"><b>Room to grow</b><span>Quarry / Metal mine → Warehouse → Construction</span><small>Mines use finite deposits. Building costs use materials already delivered to warehouses.</small></div><p class="muted">Homes pay 6 gold per resident each day. Disconnected or understaffed buildings stop producing.</p>`,
  );
}
function showSettings() {
  openModal(
    `<span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>Your little world.</h2><p>Your town saves automatically on this device. Export a copy to keep or move it.</p><div class="modal-actions"><button id="modal-save">${icon("save")} Save on this device</button><button id="export">${icon("download")} Export town</button><button id="import">${icon("upload")} Import town</button><button id="cloud-settings">${icon("cloud")} Cloud saves & sign-in</button><button id="art">${icon("leaf")} View art directions</button><button id="reset" class="danger">${icon("reset")} Start a fresh town</button></div><p class="muted">Foundation v0.1 · Phaser + TypeScript · Pine & Copper</p>`,
  );
  $("#dialog-content").insertAdjacentHTML(
    "beforeend",
    `<div class="artwork-setting"><label for="artwork-scaling">Artwork scaling</label><select id="artwork-scaling">${(
      [
        ["auto", "Automatic"],
        ["smooth", "Smooth"],
        ["crisp", "Crisp pixels"],
      ] as const
    )
      .map(
        ([value, label]) =>
          `<option value="${value}" ${artworkMode() === value ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select><small>Automatic uses smooth scaling when zoomed out and crisp pixels for close-ups. You can also keep either style at every zoom. Changes apply immediately.</small></div>`,
  );
  $<HTMLSelectElement>("#artwork-scaling").onchange = (event) =>
    setArtworkMode(
      game,
      (event.target as HTMLSelectElement).value as ArtworkMode,
      scene.cameras.main.zoom,
    );
  $("#dialog-content .modal-actions").insertAdjacentHTML("beforebegin",`<section class="audio-settings" aria-label="Sound settings"><h3>Sounds of Pinehaven</h3><label class="audio-mute"><input id="audio-mute" type="checkbox" ${townAudio.settings.muted?'checked':''}> Mute all audio</label><label for="music-volume">Cozy music <output id="music-value">${Math.round(townAudio.settings.music*100)}%</output></label><input id="music-volume" type="range" min="0" max="100" value="${Math.round(townAudio.settings.music*100)}"><label for="effects-volume">Sound effects & voices <output id="effects-value">${Math.round(townAudio.settings.effects*100)}%</output></label><input id="effects-volume" type="range" min="0" max="100" value="${Math.round(townAudio.settings.effects*100)}"><small>Sound starts with your first tap and pauses while the game is in the background.</small></section>`);
  $<HTMLInputElement>("#audio-mute").onchange=event=>townAudio.setSettings({muted:(event.target as HTMLInputElement).checked});
  for(const [id,key] of [["music","music"],["effects","effects"]] as const){
    $<HTMLInputElement>(`#${id}-volume`).oninput=event=>{const value=Number((event.target as HTMLInputElement).value);townAudio.setSettings({[key]:value/100});$(`#${id}-value`).textContent=`${value}%`;};
  }
  $<HTMLInputElement>("#effects-volume").onchange=()=>townAudio.place();
  $("#modal-save").onclick = () => save();
  $("#export").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(simulation.snapshot(), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "pinehaven-save.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  $("#import").onclick = () => $<HTMLInputElement>("#import-file").click();
  $("#cloud-settings").onclick = () => {
    closeModal();
    showCloud();
  };
  $("#art").onclick = () => {
    closeModal();
    openModal(
      `<span class="eyebrow">OUR VISUAL DIRECTION</span><h2>Pine & Copper.</h2><p>Warm timber and copper, Garden Streets trees, Alpine Slate roads and meadows, and Clear Brook water.</p><img class="art-board" src="/terrain-options.png" alt="Terrain options: selected C, Alpine Slate"><img class="art-board" src="/water-options.png" alt="Water options: selected A, Clear Brook"><p class="muted">Concept art. The town uses separate sprites, walking cycles, moving machinery, and a live simulation.</p>`,
    );
  };
  $("#reset").onclick = () => {
    closeModal();
    openModal(
      `<span class="eyebrow">A NEW BEGINNING</span><h2>Start fresh?</h2><p>This replaces the town saved on this device. Export it first if you want to keep it.</p><button id="confirm-reset" class="primary danger">Start a fresh town</button>`,
    );
    $("#confirm-reset").onclick = () => {
      replaceTown(new Simulation());
      closeModal();
      toast("Welcome back to a fresh Pinehaven.");
    };
  };
}
function showCloud() {
  openModal(
    `<span class="eyebrow">TAKE YOUR TOWN WITH YOU</span><h2>Cloud saves.</h2><p id="cloud-state">${!cloud.configured ? "Cloud saves need the Firebase web configuration. Local play is ready." : cloud.user ? (cloud.user.isAnonymous ? "Signed in as a guest on this device. Use Google sign-in for an account you can use elsewhere." : "Signed in. Save and load your town across devices.") : "Sign in to keep a copy of your town in Firebase."}</p><div class="modal-actions">${cloud.user ? '<button id="cloud-save">Save town to cloud</button><button id="cloud-load">Load town from cloud</button><button id="sign-out">Sign out</button>' : '<button id="google-signin">Continue with Google</button><button id="guest-signin">Continue as a guest</button>'}</div><p class="muted">Cloud saves are private to your account. Live shared worlds are a future phase.</p><p id="cloud-message" role="status"></p>`,
  );
  const run = async (action: () => Promise<unknown>, message: string) => {
    const buttons = $("#dialog-content").querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = true));
    try {
      await action();
      $("#cloud-message").textContent = message;
      toast(message);
    } catch (e) {
      $("#cloud-message").textContent = cloudError(e);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };
  if (cloud.user) {
    $("#cloud-save").onclick = () =>
      run(() => cloud.save(simulation.snapshot()), "Town saved to Firebase.");
    $("#cloud-load").onclick = () =>
      run(async () => {
        replaceTown(new Simulation(await cloud.load()));
      }, "Cloud town loaded.");
    $("#sign-out").onclick = () =>
      run(async () => {
        await cloud.signOut();
        closeModal();
        showCloud();
      }, "Signed out.");
  } else {
    $("#google-signin").onclick = () =>
      run(async () => {
        await cloud.signIn();
        closeModal();
        showCloud();
      }, "Signed in.");
    $("#guest-signin").onclick = () =>
      run(async () => {
        await cloud.signIn(true);
        closeModal();
        showCloud();
      }, "Guest account connected.");
  }
}
cloud.subscribe(() => {
  $("#cloud-label").textContent = cloud.user ? "Connected" : "Connect";
});
$("#build-tab").onclick = () => togglePanel("build");
$("#town-tab").onclick = () => togglePanel("town");
$(".brand").onclick = (e) => {
  e.preventDefault();
  scene.centerTown();
};
$("#settings").onclick = showSettings;
$("#cloud-button").onclick = showCloud;
$("#close-dialog").onclick = closeModal;
$<HTMLDialogElement>("#dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
$("#save-now").onclick = () => save();
$("#zoom-in").onclick = () => scene.zoomBy(0.15);
$("#zoom-out").onclick = () => scene.zoomBy(-0.15);
$("#center").onclick = () => scene.centerTown();
$("#grid").onclick = () => {
  scene.showGrid = !scene.showGrid;
  $("#grid").classList.toggle("active", scene.showGrid);
  scene.drawOverlay();
};
$("#pause").onclick = () => {
  scene.speed = scene.speed === 0 ? 1 : 0;
  $("#pause").innerHTML = icon(scene.speed ? "pause" : "play");
  $("#pause").setAttribute(
    "aria-label",
    scene.speed ? "Pause simulation" : "Resume simulation",
  );
};
document.querySelectorAll<HTMLElement>("[data-speed]").forEach(
  (el) =>
    (el.onclick = () => {
      scene.speed = Number(el.dataset.speed);
      document
        .querySelectorAll<HTMLElement>("[data-speed]")
        .forEach((b) => b.classList.toggle("active", b === el));
      $("#pause").innerHTML = icon("pause");
      $("#pause").setAttribute("aria-label", "Pause simulation");
    }),
);
document
  .querySelectorAll<HTMLElement>("[data-tool]")
  .forEach((el) => (el.onclick = () => setTool(el.dataset.tool as Tool)));
$("#help").onclick = () =>
  openModal(
    `<span class="eyebrow">WELCOME TO PINEHAVEN</span><h2>Settle in. Build a little.</h2><div class="help-list"><p><b>Build & rotate</b> Choose any building, then use Rotate or R to turn it. The footprint turns too. A green front arrow means road access; amber means the entrance still needs a road. That road must reach a warehouse for the building to work.</p><p><b>Explore</b> Click buildings for workers, stock and production. Click a person or vehicle to see their destination, cargo and route. Drag the map to move. Scroll to zoom.</p><p><b>Gardens & streets</b> Add trees, benches, lights, planters and fences from the build catalog. Select a decoration to remove it, or use Remove (X).</p><p><b>Gather</b> Quarries need stone deposits; metal mines need metal deposits. Unbuilt deposits are marked on the map.</p><p><b>Automate</b> Trucks deliver inputs and outputs. Cars keep right, queue behind traffic and take turns at junctions. Production stops without front road access or workers.</p><p><b>Bridges</b> Choose Road (R), then place spans over water for 35 gold each. Connect both banks to roads for workers and deliveries.</p><p><b>Shortcuts</b> V explore · R rotate while building, otherwise road · B build catalog · U your town · T terrain · X remove · G grid · Esc cancel · WASD / arrows move · Space + drag pan</p></div>`,
  );
$<HTMLInputElement>("#import-file").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 800000) throw new Error("This save file is too large.");
    const next = new Simulation(parseSave(await file.text()));
    closeModal();
    openModal(
      `<h2>Load this town?</h2><p>This replaces your local town with the imported save.</p><button id="confirm-import" class="primary">Load imported town</button>`,
    );
    $("#confirm-import").onclick = () => {
      replaceTown(next);
      closeModal();
      toast("Your town is ready.");
    };
  } catch (e) {
    toast(e instanceof Error ? e.message : "Could not read this save.");
  }
  input.value = "";
};
window.addEventListener("keydown", (e) => {
  if ($<HTMLDialogElement>("#dialog").open) return;
  if (
    ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)
  )
    return;
  const k = e.key.toLowerCase();
  if (k === "escape" || k === "v") cancelTool();
  if (k === "r") {
    if (isBuilding(tool) || tool === "move") rotatePlacement();
    else setTool("road");
  }
  if (k === "x") setTool("bulldoze");
  if (k === "b") togglePanel("build");
  if (k === "u") togglePanel("town");
  if (k === "t") setTool("terrain");
  if (k === "g") $("#grid").click();
});
window.addEventListener("beforeunload", () => save(false));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) save(false);
});
setInterval(() => {
  updateUI();
  if (Date.now() - lastSave > 15000) save(false);
}, 500);
renderPanel();
updateUI();
if (restoreError) toast(restoreError);
