import Phaser from "phaser";
import "./style.css";
import {
  BUILDINGS,
  RESOURCES,
  RESOURCE_NAMES,
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
  type Point,
  type Building,
} from "./simulation.js";
import { LocalGateway } from "./gateway.js";
import { builderCapacity, constructionWork } from "./construction.js";
import { fishingStatus } from "./fishing.js";
import { TownScene } from "./scene.js";
import {
  artworkMode,
  setArtworkMode,
  type ArtworkMode,
} from "./artwork-scaling.js";
import { terrainCell, type TerrainMode } from "./terrain.js";
import { icon } from "./icons.js";
import { buildingPreview } from "./previews.js";
import { alertIcon } from "./building-alerts.js";
import { buildingGuidance, type GuidanceAction } from "./building-guidance.js";
import { trafficQueues } from "./traffic-queues.js";
import { cameraViewport } from "./rendering.js";
import { productionActivity, type GoodsConnection } from "./logistics.js";
import { CloudSaves, cloudError } from "./cloud.js";
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
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
      (b: { kind: string; plot?: number[] }) =>
        ["farm", "sawmill", "workshop", "warehouse"].includes(b.kind) &&
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
const cloud = new CloudSaves();
let category: "homes" | "production" | "town" | "decorations" = "homes",
  tab: "build" | "town" = "build",
  selected: number | null = null,
  selectedAgent: number | null = null,
  selectedTraffic: number[] | null = null,
  selectedDecoration: number | null = null,
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
) => {
  const { key, promise } = buildingPreview(kind, rotation, houseTier);
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
   ["stone", "stone", "Stone in warehouses"],
   ["metal", "metal", "Metal in warehouses"],
   ["people", "population", "Employed / residents"],
   ["hammer", "builders", "Builders / needed"],
   ["heart", "happiness", "Happiness"],
 ]
   .map(
     ([i, id, title]) =>
       `<div class="resource ${id}" title="${title}">${icon(i)}<span id="${id}">—</span><small>${id === "population" || id === "builders" ? title : title.split(" ")[0]}</small></div>`,
   )
   .join("")}
 </div><div class="header-actions"><button class="quiet" id="cloud-button" title="Sign in & cloud saves">${icon("cloud")}<span id="cloud-label">Connect</span></button><button class="icon-button" id="settings" aria-label="Save and settings">${icon("settings")}</button></div></header>
 <div class="townbar"><div class="town-identity"><span class="eyebrow">THE EMERALD VALLEY</span><h1>Pinehaven <span class="town-star">✦</span></h1><span class="town-motto">A little industry. A lovely life.</span></div><div class="town-season">${icon("sun")}<b id="day">Day 1</b><span>Spring · Year 1</span></div><details class="town-progress"><summary>${icon("flag")}<span>Town progress</span></summary><div class="town-progress-content"><h3>Small town. Big possibilities.</h3><p id="goal-copy">Let your first deliveries find their way home.</p><div class="goal-progress"><span id="goal-progress"></span></div><small id="goal-count">0 / 30 goods delivered</small></div></details><div class="save-indicator"><span class="status-dot"></span><span id="save-status">Saved on this device</span><button id="save-now" title="Save now" aria-label="Save town">${icon("save")}</button></div></div>
 <main>
 <section class="world" aria-label="Interactive town map"><div id="game"></div><div id="building-alerts" role="group" aria-label="Building alerts"></div>
 <div id="inspector" class="inspector" hidden></div>
 <div class="map-corner"><canvas id="minimap" width="168" height="102" aria-label="Town minimap"></canvas><div class="zoom-controls"><button id="zoom-out" aria-label="Zoom out">−</button><button id="center" title="Center town">${icon("map")}<span id="zoom-level">100%</span></button><button id="zoom-in" aria-label="Zoom in">+</button></div></div>
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
  '<div id="traffic-alerts" role="group" aria-label="Traffic warnings"></div>',
);
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
function setTool(next: Tool) {
  scene.guidanceBuilding = null;
  if (next !== "move") scene.movingBuilding = null;
  const wasTerrain = tool === "terrain";
  setPanelOpen(false);
  if (next !== "inspect") closeInspection();
  tool = next;
  scene.tool = next;
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
    ? BUILDINGS[next as BuildingKind]
    : null;
  const decoration = isDecoration(next) ? DECORATIONS[next] : null;
  $("#placement-hint").innerHTML = d
    ? `${icon("hammer")} Place ${d.name.toLowerCase()} · ${d.cost} gold ${Object.entries(
        d.materials ?? {},
      )
        .map(([r, n]) => `· ${n} ${r}`)
        .join(
          " ",
        )} · ${dimensions(next as BuildingKind, scene.rotation).join("×")} tiles · ${constructionWork(next as BuildingKind)} worker-seconds ${isBuilding(next) ? `<button id="rotate-placement" class="rotate-placement" title="Rotate building (R)">${icon("reset")} Rotate <kbd>R</kbd></button><span id="front-access"></span>` : ""} <kbd>Esc</kbd>`
    : decoration
      ? `${icon("leaf")} Place ${decoration.name.toLowerCase()} · ${decoration.cost} gold · 1 tile <kbd>Esc</kbd>`
      : next === "road"
        ? `${icon("road")} Click to lay roads · 12 gold · Bridges 35 gold <kbd>Esc</kbd>`
        : next === "bridge"
          ? `${icon("bridge")} Build over water · 35 gold per tile · Connect both ends to roads <kbd>Esc</kbd>`
          : next === "bulldoze"
            ? `${icon("hammer")} Click to remove · Recover half the gold cost <kbd>Esc</kbd>`
            : `${icon("inspect")} Tap buildings, people or cars · Drag to pan · Pinch or scroll to zoom`;
  if (isBuilding(next)) $("#rotate-placement").onclick = rotatePlacement;
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
$("#close-panel").onclick = () => {
  setPanelOpen(false);
  $(tool === "terrain" ? '[data-tool="terrain"]' : `#${tab}-tab`).focus();
};
function rotatePlacement() {
  scene.rotation = ((scene.rotation + 1) % 4) as 0 | 1 | 2 | 3;
  scene.drawOverlay();
  setTool(tool);
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
    ? kind === "park"
      ? "Square connected to road"
      : "Front connected to road"
    : kind === "park"
      ? "Connect a road on any of the four sides"
      : "Front entrance needs a road";
  el.className = connected ? "front-connected" : "front-missing";
}
function renderPanel() {
  setPanelOpen(panelOpen);
  if (tab === "town") {
    $("#panel-content").innerHTML =
      `<div class="town-overview"><section><span class="eyebrow">GROWING TOGETHER</span><h3>Life in Pinehaven</h3><div id="town-stats"></div></section><section><h4>Town inventory</h4><p class="muted">Across buildings and deliveries.</p><div id="inventory"></div></section></div>`;
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
      const result = await gateway.command({ type: "undoTerrain" });
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
  const names = {
    homes: "Neighbourhood",
    production: "Make & gather",
    town: "Town essentials",
    decorations: "Gardens & streets",
  };
  const cards =
    category === "decorations"
      ? Object.entries(DECORATIONS)
          .map(
            ([kind, d]) =>
              `<button class="building-card ${tool === kind ? "selected" : ""}" data-building="${kind}" title="Place or remove ${d.name.toLowerCase()}">${d.texture === "garden" ? atlasIcon("/garden-sprites.png", 4, 4, 313.5, 313.5, d.frame) : atlasIcon("/town-props.png", 2, 2, 887, 443.5, d.frame)}<b>${d.name}</b><span class="price">${icon("coin")}${d.cost}</span></button>`,
          )
          .join("")
      : (Object.entries(BUILDINGS) as [BuildingKind, typeof BUILDINGS.house][])
          .filter(([, d]) => d.category === category)
          .map(
            ([kind, d]) =>
              `<button class="building-card ${tool === kind ? "selected" : ""}" data-building="${kind}" title="${d.description}">${frame(kind)}<b>${d.name}</b><span class="price">${icon("coin")}${d.cost}${d.materials ? "<small>+ materials</small>" : ""}</span></button>`,
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
    )}</div><div class="catalog-heading"><h3>${names[category]}</h3></div><div class="building-grid">${cards}</div><div class="build-note">${icon("leaf")}<div><b>${category === "decorations" ? "Make the streets your own." : "Connect the front entrance."}</b><p>${category === "decorations" ? "Plant trees, add benches and lights. Use Remove (X) to clear decorations." : "Rotate with R. The entrance arrow turns green when a road reaches the front."}</p></div></div><button class="chain-button" id="production-guide">See production chains ${icon("arrow")}</button>`;
  document.querySelectorAll<HTMLElement>("[data-category]").forEach(
    (el) =>
      (el.onclick = () => {
        category = el.dataset.category as typeof category;
        renderPanel();
      }),
  );
  if (category === "homes") {
    $("#panel-content .building-grid").insertAdjacentHTML(
      "beforeend",
      `<section class="housing-ladder" aria-label="House upgrades"><h4>Grow your homes</h4><p>Build a cottage, then select it to upgrade.</p><div>${([1, 2, 3] as HouseTier[]).map((tier) => `<figure>${frame("house", "", 0, tier)}<figcaption><small>Tier ${tier}</small><b>${HOUSE_TIERS[tier].name}</b><span>${HOUSE_TIERS[tier].capacity} residents</span></figcaption></figure>`).join("")}</div></section>`,
    );
  } else if (category === "decorations") {
    $("#panel-content .build-note p").textContent =
      "Place fence pieces side by side to join them. Corners and junctions connect automatically. Use Remove (X) to clear decorations.";
  }
  document
    .querySelectorAll<HTMLElement>("[data-building]")
    .forEach((el) => (el.onclick = () => setTool(el.dataset.building as Tool)));
  $("#production-guide").onclick = showChains;
}
scene.onTile = async (p: Point) => {
  if (tool === "terrain") {
    scene.previewTerrain(p);
    return;
  }
  if (tool === "inspect") {
    selectedAgent = null;
    scene.selectedAgent = null;
    selectedDecoration = simulation.decorationAt(p.x, p.y)?.id ?? null;
    const b = simulation.buildingAt(p.x, p.y);
    selected = b?.id ?? null;
    scene.selected = selected;
    scene.drawOverlay();
    if (selectedDecoration) renderDecorationInspector();
    else renderInspector();
    if (!b && DEPOSITS[key(p)])
      toast(
        `${DEPOSITS[key(p)] === "stone" ? "Stone" : "Metal"} deposit · ${simulation.state.deposits[key(p)]} remaining`,
      );
    return;
  }
  const result = await gateway.command(
    tool === "move"
      ? {
          type: "move",
          id: scene.movingBuilding!,
          ...p,
          rotation: scene.rotation,
        }
      : tool === "bulldoze"
        ? { type: "demolish", ...p }
        : { type: "place", kind: tool, rotation: scene.rotation, ...p },
  );
  toast(result.message);
  if (result.ok) {
    if (tool === "move") {
      const id = scene.movingBuilding!;
      setTool("inspect");
      scene.onSelect(id);
    }
    scene.redraw();
    save(false);
    updateUI();
  }
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
  const result = await gateway.command(command);
  toast(result.message);
  if (result.ok) {
    scene.redraw();
    save(false);
    updateUI();
    renderPanel();
  }
};
scene.onHover = (p) => {
  hovered = p;
  updateEntranceHint();
  $("#tile-label").textContent = p
    ? `${p.x}, ${p.y}${DEPOSITS[key(p)] ? " · " + DEPOSITS[key(p)] + " deposit" : ""}`
    : "";
};
scene.onSelectAgent = (id) => {
  selectedTraffic = null;
  selected = null;
  selectedDecoration = null;
  scene.selected = null;
  selectedAgent = id;
  scene.selectedAgent = id;
  scene.drawOverlay();
  renderAgentInspector();
};
scene.onSelect = (id) => {
  selectedTraffic = null;
  selectedAgent = null;
  selectedDecoration = null;
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
  const b = selected ? simulation.building(selected) : null;
  const panel = $("#inspector");
  panel.hidden = !b;
  if (!b) return;
  panel.dataset.buildingView = `${b.id}:${b.houseTier ?? 1}:${!!b.construction}`;
  panel.scrollTop = 0;
  const d = BUILDINGS[b.kind];
  panel.innerHTML = `<button id="close-inspector" class="icon-button close" aria-label="Close building details">${icon("close")}</button><span class="eyebrow">${b.kind === "house" ? `HOME · TIER ${b.houseTier ?? 1} OF 3` : d.category === "production" ? "LITTLE INDUSTRIES" : "AROUND TOWN"}</span>${frame(b.kind, "inspector-art", b.rotation, b.houseTier)}<h3>${buildingName(b)}</h3><p>${b.kind === "house" ? HOUSE_TIERS[b.houseTier ?? 1].description : d.description}</p><div id="building-status" class="building-status"></div>${b.kind === "fishery" && !b.construction ? '<section id="boat-detail" class="boat-detail"></section>' : ""}${b.kind === "house" ? '<div id="house-upgrade"></div>' : ""}${d.recipe ? '<section id="production-logistics" class="production-logistics" aria-label="Goods routes and workers"></section>' : ""}<div id="building-detail"></div>${d.recipe ? '<button id="toggle-production" class="primary"></button>' : ""}`;
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
  $("#building-status").insertAdjacentHTML(
    "afterend",
    '<div class="building-actions"><p id="building-next-step" class="next-step" hidden></p><div id="building-primary"></div><button id="resolve-issue" hidden></button><details id="building-more"><summary>More actions</summary><div id="building-menu-items"></div></details></div>',
  );
  if (b.construction && !d.recipe)
    panel.insertAdjacentHTML(
      "beforeend",
      '<button id="toggle-production"></button>',
    );
  if (b.kind === "house") {
    $("#house-upgrade").hidden = !!b.construction;
    const tier = b.houseTier ?? 1;
    if (tier < 3) {
      const nextTier = (tier + 1) as HouseTier,
        next = HOUSE_TIERS[nextTier];
      $("#house-upgrade").innerHTML =
        `<div class="upgrade-heading">${frame("house", "upgrade-art", b.rotation, nextTier)}<div><span class="eyebrow">NEXT · TIER ${nextTier}</span><b>${next.name}</b><small>${houseCapacity(b)} → ${next.capacity} residents · same plot</small></div></div><div id="upgrade-costs" class="upgrade-costs"></div><button id="upgrade-house" class="primary">Upgrade to ${next.name.toLowerCase()}</button><p id="upgrade-reason" class="upgrade-reason" aria-live="polite"></p>`;
      $("#upgrade-house").onclick = async () => {
        const result = await gateway.command({ type: "upgrade", id: b.id });
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
  {
    panel.insertAdjacentHTML(
      "beforeend",
      '<button id="move-building" class="primary">Move building</button>',
    );
    $("#move-building").onclick = () => {
      scene.movingBuilding = b.id;
      scene.rotation = b.rotation;
      setTool("move");
    };
  }
  $("#close-inspector").onclick = () => {
    selected = null;
    scene.selected = null;
    panel.hidden = true;
    scene.drawOverlay();
  };
  if (d.recipe || b.construction)
    $("#toggle-production").onclick = async () => {
      const result = await gateway.command({ type: "toggle", id: b.id });
      toast(result.message);
      scene.redraw();
      save(false);
      updateInspector();
    };
  updateInspector();
}
function closeInspection() {
  selectedTraffic = null;
  selected = null;
  selectedAgent = null;
  selectedDecoration = null;
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
    $("#building-next-step").textContent = guide.message;
    resolve.textContent = guide.label;
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
    "toggle-production",
    "move-building",
  ]
    .map((id) => document.getElementById(id) as HTMLButtonElement | null)
    .filter((button): button is HTMLButtonElement => !!button);
  const primary = buttons.find(
    (button) =>
      button.id ===
      (guide
        ? "resolve-issue"
        : b.construction
          ? "toggle-production"
          : b.kind === "house" && (b.houseTier ?? 1) < 3
            ? "upgrade-house"
            : BUILDINGS[b.kind].recipe
              ? "toggle-production"
              : "move-building"),
  )!;
  for (const button of buttons) {
    const isPrimary = button === primary;
    button.classList.toggle("primary", isPrimary);
    const parent = $(isPrimary ? "#building-primary" : "#building-menu-items");
    if (button.parentElement !== parent) parent.append(button);
    button.hidden =
      button.id === "resolve-issue"
        ? !guide
        : (button.id === "upgrade-house" && !!b.construction) ||
          (button.id === "toggle-production" &&
            guide?.action.type === "toggle") ||
          (button.id === "move-building" && guide?.action.type === "move");
  }
  $("#building-more").hidden = !buttons.some(
    (button) => button !== primary && !button.hidden,
  );
}
function runGuidance(b: Building, action: GuidanceAction) {
  if (action.type === "toggle") $("#toggle-production").click();
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
function renderDecorationInspector() {
  selectedTraffic = null;
  const d = simulation.state.decorations.find(
    (d) => d.id === selectedDecoration,
  );
  if (!d) return;
  $("#inspector").hidden = false;
  $("#inspector").innerHTML =
    `<button id="close-inspector" class="icon-button close" aria-label="Close decoration details">${icon("close")}</button><span class="eyebrow">GARDENS & STREETS</span><h3>${DECORATIONS[d.kind].name}</h3><p>A little detail at ${d.x}, ${d.y}.</p><button id="remove-decoration" class="primary">Remove decoration</button>`;
  $("#close-inspector").onclick = closeInspection;
  $("#remove-decoration").onclick = async () => {
    const result = await gateway.command({ type: "demolish", x: d.x, y: d.y });
    toast(result.message);
    if (result.ok) {
      scene.redraw();
      closeInspection();
      save(false);
    }
  };
}
function renderAgentInspector() {
  $("#inspector").hidden = false;
  $("#inspector").innerHTML =
    `<button id="close-inspector" class="icon-button close" aria-label="Close traveller details">${icon("close")}</button><span class="eyebrow">ON THE MOVE</span><h3 id="traveller-name"></h3><p id="traveller-kind"></p><div id="traveller-status" class="building-status"></div><div id="traveller-detail"></div><button id="show-destination" class="primary">Show destination</button>`;
  $("#close-inspector").onclick = closeInspection;
  $("#show-destination").onclick = () => {
    const a = simulation.state.agents.find((a) => a.id === selectedAgent);
    if (a) scene.focusBuilding(a.onsite ?? (a.returning ? a.source : a.target));
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
  if (a.onsite) {
    const site = simulation.building(a.onsite);
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
  $("#traveller-name").textContent = person?.name ?? "Delivery truck";
  $("#traveller-kind").textContent =
    a.kind === "person"
      ? "Walking around Pinehaven"
      : a.kind === "car"
        ? "Driving · keeps right"
        : "Delivering goods · keeps right";
  const from = simulation.building(a.returning ? a.target : a.source),
    to = simulation.building(a.returning ? a.source : a.target);
  const label = (b: typeof from) =>
    b ? `${buildingName(b)} · ${b.x}, ${b.y}` : "No destination";
  $("#traveller-status").textContent =
    a.wait > 0
      ? "At the building"
      : a.trafficWait
        ? "Waiting for traffic"
        : a.kind === "person"
          ? "Walking to destination"
          : "Driving to destination";
  $("#traveller-detail").innerHTML =
    `<div class="detail-row"><span>From</span><b>${escapeHtml(label(from))}</b></div><div class="detail-row"><span>Headed to</span><b>${escapeHtml(label(to))}</b></div>${a.cargo ? `<div class="detail-row"><span>Carrying</span><b>${a.amount} ${RESOURCE_NAMES[a.cargo]}</b></div>` : ""}<p class="muted">The gold line shows this journey on the map.</p>`;
}
function updateInspector() {
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
  const d = BUILDINGS[b.kind];
  const alert = simulation.alert(b);
  if (
    $("#inspector").dataset.buildingView !==
    `${b.id}:${b.houseTier ?? 1}:${!!b.construction}`
  ) {
    renderInspector();
    return;
  }
  $("#building-status").innerHTML = alert
    ? `<div class="status-heading">${icon(alertIcon[alert.kind])}<b>${escapeHtml(alert.title)}</b></div><p>${escapeHtml(alert.message)}</p>`
    : escapeHtml(simulation.status(b));
  $("#building-status").classList.toggle("warning", !!alert);
  $("#building-detail").innerHTML =
    `<div class="detail-row"><span>Front entrance</span><b>${b.connected ? "Connected" : "Disconnected"}</b></div>${d.jobs ? `<div class="detail-row"><span>Workers</span><b>${b.workers} / ${d.jobs}</b></div>` : ""}${
      d.recipe
        ? `<div class="recipe">${d.recipe.input ? `${d.recipe.amount} ${d.recipe.input}` : "Gather"} <span>→</span> ${d.recipe.count} ${d.recipe.output}</div><div class="goal-progress"><span style="width:${(b.progress / d.recipe.seconds) * 100}%"></span></div><div class="detail-row"><span>Cycle</span><b>${b.progress.toFixed(1)} / ${d.recipe.seconds}s</b></div>${Object.entries(
            b.inventory,
          )
            .map(
              ([r, n]) =>
                `<div class="detail-row"><span>${r}</span><b>${n}</b></div>`,
            )
            .join(
              "",
            )}${b.kind === "quarry" || b.kind === "mine" ? `<div class="detail-row"><span>Deposit remaining</span><b>${simulation.state.deposits[key(b)]}</b></div>` : ""}`
        : b.kind === "house"
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
  if (d.recipe)
    $("#toggle-production").textContent = b.enabled
      ? "Pause production"
      : "Resume production";
  if (d.recipe) updateLogistics(b);
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
  if (b.construction) {
    const progress = Math.floor(
      (b.construction.completed / b.construction.required) * 100,
    );
    const onsite = simulation.state.agents.filter(
      (a) => a.onsite === b.id,
    ).length;
    const names = simulation.state.residents
      .filter((r) => r.job === b.id)
      .map((r) => escapeHtml(r.name));
    $("#building-detail").innerHTML =
      `<h4>${b.construction.upgradeTo ? "Home improvements" : "Construction site"}</h4><div class="goal-progress" role="progressbar" aria-label="Construction progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><div class="detail-row"><span>Progress</span><b>${progress}%</b></div><div class="detail-row"><span>Builders assigned</span><b>${b.workers} / ${builderCapacity(b)}</b></div><div class="detail-row"><span>Working on site</span><b>${onsite}</b></div><div class="detail-row"><span>Remaining labor</span><b>${Math.ceil(b.construction.required - b.construction.completed)} worker-seconds</b></div><p class="muted">${names.join(", ") || "Waiting for available residents."}</p>${b.construction.upgradeTo ? '<p class="muted">The current residents keep their home during the upgrade.</p>' : '<p class="muted">Opens when construction is complete. Only builders on site contribute progress.</p>'}`;
    if (d.recipe) $("#production-logistics").hidden = true;
    $("#toggle-production").textContent = b.enabled
      ? "Pause construction"
      : "Resume construction";
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
    recipe = BUILDINGS[b.kind].recipe!;
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
  const html = `<h4>Goods routes</h4><div class="goods-legend"><span class="input">Inputs</span><span class="output">Outputs</span><span class="worker">Workers</span></div><p class="logistics-hint">Arrows follow delivery direction. Rings mark related deliveries and travelling workers.</p><h5>Inputs${recipe.input ? ` · ${RESOURCE_NAMES[recipe.input]}` : ""}</h5>${links(view.inputs, "input") || `<p class="logistics-empty">${recipe.input ? "No supplier built yet." : "Gathered here; no delivered inputs."}</p>`}<h5>Outputs · ${RESOURCE_NAMES[recipe.output]}</h5>${links(view.outputs, "output") || '<p class="logistics-empty">No destination built yet.</p>'}<div class="goods-activity"><span class="input">${activity.incoming.length} incoming ${activity.incoming.length === 1 ? "delivery" : "deliveries"}</span><span class="output">${activity.outgoing.length} outgoing ${activity.outgoing.length === 1 ? "delivery" : "deliveries"}</span></div><p class="goods-workers"><b>${workers.length} assigned · ${visibleWorkers} travelling</b><span>${workers.length ? workers.map((r) => escapeHtml(r.name)).join(", ") : "No assigned workers"}</span></p>`;
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
  $("#upgrade-reason").textContent =
    reason ?? "Three more neighbours can move in.";
}
function drawMinimap() {
  const ctx = $<HTMLCanvasElement>("#minimap").getContext("2d")!;
  ctx.fillStyle = "#d5dfc9";
  ctx.fillRect(0, 0, 168, 102);
  const map = (x: number, y: number) => ({
    x: 76 + (x - y) * 2.7,
    y: 6 + (x + y) * 1.55,
  });
  for (let y = 0; y < 28; y++)
    for (let x = 0; x < 28; x++) {
      const p = map(x, y);
      const cell = terrainCell(x, y, simulation.state.terrain);
      ctx.fillStyle =
        cell.kind === "water"
          ? "#82aaa0"
          : `hsl(91 21% ${55 + cell.height * 3}%)`;
      ctx.fillRect(p.x, p.y, 3, 2);
    }
  simulation.state.roads.forEach((k) => {
    const [x, y] = k.split(",").map(Number),
      p = map(x, y);
    ctx.fillStyle = "#ddd1ae";
    ctx.fillRect(p.x, p.y, 3, 2);
  });
  simulation.state.buildings.forEach((b) => {
    const p = map(b.x, b.y);
    ctx.fillStyle =
      BUILDINGS[b.kind].category === "production" ? "#b77c51" : "#486553";
    ctx.fillRect(p.x, p.y - 1, 3, 3);
  });
  if (scene.cameras?.main) {
    const v = cameraViewport(scene.cameras.main);
    const x = 76 + (v.x * 2.7) / 32,
      y = 6 + (v.y * 1.55) / 16;
    const w = (v.width * 2.7) / 32,
      h = (v.height * 1.55) / 16;
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
function updateUI() {
  const s = simulation.state;
  const employed = s.residents.filter((r) => r.job !== null).length;
  const sites = s.buildings.filter((b) => b.construction && b.enabled);
  const buildersNeeded = sites.reduce(
    (total, b) => total + builderCapacity(b),
    0,
  );
  const buildersAssigned = sites.reduce((total, b) => total + b.workers, 0);
  $("#builders").textContent = `${buildersAssigned} / ${buildersNeeded}`;
  const builderSummary = `${buildersAssigned} builders assigned of ${buildersNeeded} needed at ${sites.length} active construction sites · ${Math.max(0, buildersNeeded - buildersAssigned)} more builders needed. Paused sites excluded; sites awaiting road access included.`;
  $(".resource.builders").title = builderSummary;
  $(".resource.builders").setAttribute("aria-label", builderSummary);
  $(".resource.builders").classList.toggle(
    "shortage",
    buildersAssigned < buildersNeeded,
  );
  $("#gold").textContent = Math.floor(s.money).toLocaleString();
  const bread = simulation.stored("bread"),
    fish = simulation.stored("fish");
  $("#food-stock").textContent = String(bread + fish);
  $(".resource.food-stock").title =
    `${bread} bread + ${fish} fish in warehouses · ${Math.ceil(s.residents.length / 3)} food needed per day · ${s.food}% of last day's needs met`;
  $(".resource.food-stock").setAttribute(
    "aria-label",
    $(".resource.food-stock").title,
  );
  for (const r of ["wood", "planks", "stone", "metal"] as const)
    $("#" + r).textContent = simulation.stored(r).toString();
  $("#population").textContent = `${employed} / ${s.residents.length}`;
  $(".resource.population").title =
    `${employed} of ${s.residents.length} residents have jobs · ${s.residents.length - employed} without an assigned job`;
  $(".resource.population").setAttribute(
    "aria-label",
    $(".resource.population").title,
  );
  $("#happiness").textContent = simulation.happiness() + "%";
  $("#day").textContent = `Day ${Math.floor(s.tick / 240) + 1}`;
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
  if (tab === "town") {
    $("#town-stats").innerHTML =
      `<div class="detail-row"><span>Employed residents</span><b>${employed} / ${s.residents.length}</b></div><div class="detail-row"><span>Deliveries on the road</span><b>${s.agents.filter((a) => a.kind === "truck").length}</b></div><div class="detail-row"><span>Tools exported</span><b>${s.exported}</b></div><div class="detail-row"><span>Food needs met</span><b>${s.food}%</b></div>`;
    const totals = simulation.totals();
    $("#inventory").innerHTML = RESOURCES.map(
      (r) =>
        `<div class="inventory-row">${icon(r === "bread" || r === "fish" || r === "wood" || r === "stone" || r === "metal" ? r : "box")}<span>${RESOURCE_NAMES[r]}</span><b>${totals[r]}</b></div>`,
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
  simulation = next;
  gateway.simulation = next;
  scene.replace(next);
  selected = null;
  selectedAgent = null;
  selectedDecoration = null;
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
    `<span class="eyebrow">EVERY LITTLE THING CONNECTS</span><h2>Made in Pinehaven.</h2><p>Factories need people, roads, and the right ingredients. Trucks move real inventory between connected buildings.</p><div class="chain"><b>Daily bread</b><span>Wheat farm → Flour mill → Bakery → Warehouse</span><small>Grain becomes flour, then bread. Bread feeds citizens each day.</small></div><div class="chain"><b>Fresh from the shore</b><span>Shoreline fishery → Warehouse → Citizens</span><small>Two land tiles for the hut, two water tiles for the dock. Fish and bread both satisfy food needs: one food per three residents each day.</small></div><div class="chain"><b>A useful little industry</b><span>Forester → Sawmill → Workshop → Warehouse</span><small>Wood becomes planks, then tools. Tools sell for 35 gold each.</small></div><div class="chain"><b>Room to grow</b><span>Quarry / Metal mine → Warehouse → Construction</span><small>Mines use finite deposits. Building costs use materials already delivered to warehouses.</small></div><p class="muted">Homes pay 6 gold per resident each day. Disconnected or understaffed buildings stop producing.</p>`,
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
