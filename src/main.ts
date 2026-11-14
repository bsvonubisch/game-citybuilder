import Phaser from "phaser";
import "./style.css";
import {
  BUILDINGS,
  RESOURCES,
  RESOURCE_NAMES,
  FOOTPRINTS,
  type BuildingKind,
  type Tool,
} from "./catalog.js";
import {
  Simulation,
  parseSave,
  DEPOSITS,
  key,
  type Point,
} from "./simulation.js";
import { LocalGateway } from "./gateway.js";
import { TownScene } from "./scene.js";
import { icon } from "./icons.js";
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
let category: "homes" | "production" | "town" = "homes",
  tab: "build" | "town" = "build",
  selected: number | null = null,
  tool: Tool = "inspect",
  lastSave = Date.now(),
  toastTimer = 0,
  modalPreviousSpeed = 1;
const frame = (kind: BuildingKind, cls = "") =>
  `<span class="building-icon ${cls}" style="--col:${BUILDINGS[kind].frame % 3};--row:${Math.floor(BUILDINGS[kind].frame / 3)}" aria-hidden="true"></span>`;
$("#app").innerHTML = `
 <header class="topbar"><a class="brand" href="#" aria-label="Center town">${icon("tree")}<span>LITTLE WORKS<small>PINE & COPPER</small></span></a><div class="resource-bar">
 ${[
   ["coin", "gold", "Gold"],
   ["wood", "wood", "Wood in warehouses"],
   ["stone", "stone", "Stone in warehouses"],
   ["metal", "metal", "Metal in warehouses"],
   ["people", "population", "Residents"],
   ["heart", "happiness", "Happiness"],
 ]
   .map(
     ([i, id, title]) =>
       `<div class="resource ${id}" title="${title}">${icon(i)}<span id="${id}">—</span><small>${title.split(" ")[0]}</small></div>`,
   )
   .join("")}
 </div><div class="header-actions"><button class="quiet" id="cloud-button" title="Sign in & cloud saves">${icon("cloud")}<span id="cloud-label">Connect</span></button><button class="icon-button" id="settings" aria-label="Save and settings">${icon("settings")}</button></div></header>
 <main><aside class="sidebar"><div class="side-heading"><span class="eyebrow">A TOWN OF YOUR OWN</span><h1>Little by little.</h1><p>Good things grow here.</p></div>
 <div class="side-tabs"><button id="build-tab" class="active">${icon("hammer")} Build</button><button id="town-tab">${icon("leaf")} Your town</button></div>
 <div id="sidebar-content"></div><div class="sidebar-footer"><span class="status-dot"></span><span id="save-status">Saved on this device</span><button id="save-now" title="Save now" aria-label="Save town">${icon("save")}</button></div></aside>
 <section class="world" aria-label="Interactive town map"><div id="game"></div><div class="world-heading"><span class="world-tag">THE EMERALD VALLEY</span><h2>Pinehaven<span>✦</span></h2><p>A little industry. A lovely life.</p></div>
 <div class="season"><span class="sun-icon">${icon("sun")}</span><div><b id="day">Day 1</b><small>Spring · Year 1</small></div></div>
 <div class="goal-card"><div class="goal-icon">${icon("flag")}</div><div><span class="eyebrow">A FRESH BEGINNING</span><h3>Small town. Big possibilities.</h3><p id="goal-copy">Let your first deliveries find their way home.</p><div class="goal-progress"><span id="goal-progress"></span></div><small id="goal-count">0 / 30 goods delivered</small></div></div>
 <div id="inspector" class="inspector" hidden></div>
 <div class="map-corner"><canvas id="minimap" width="168" height="102" aria-label="Town minimap"></canvas><div class="zoom-controls"><button id="zoom-out" aria-label="Zoom out">−</button><button id="center" title="Center town">${icon("map")}<span id="zoom-level">100%</span></button><button id="zoom-in" aria-label="Zoom in">+</button></div></div>
 <div class="bottom-area"><div id="placement-hint" class="placement-hint">${icon("inspect")} Click a building to explore. Drag to look around.</div><nav class="toolbar" aria-label="Town tools"><div class="tool-group">${[
   ["inspect", "inspect", "Explore", "V"],
   ["road", "road", "Road", "R"],
   ["bulldoze", "hammer", "Remove", "X"],
 ]
   .map(
     ([id, i, label, k]) =>
       `<button data-tool="${id}" class="tool-button ${id === "inspect" ? "active" : ""}" title="${label} (${k})">${icon(i)}<span>${label}</span><kbd>${k}</kbd></button>`,
   )
   .join(
     "",
   )}<button id="grid" class="tool-button" title="Show grid (G)">${icon("grid")}<span>Grid</span></button></div><div class="speed-controls"><button id="pause" aria-label="Pause simulation">${icon("pause")}</button><button data-speed="1" class="active">1×</button><button data-speed="2">2×</button><button data-speed="4">4×</button></div></nav></div>
 <button id="help" class="help-button" aria-label="How to play">${icon("help")}</button><div id="tile-label" class="tile-label"></div></section></main>
 <div id="toast" role="status" aria-live="polite"></div><dialog id="dialog"><button id="close-dialog" class="icon-button close" aria-label="Close dialog">${icon("close")}</button><div id="dialog-content"></div></dialog><input id="import-file" type="file" accept="application/json,.json" hidden>`;
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#a7b9ad",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: $("#game").clientWidth,
    height: $("#game").clientHeight,
  },
  scene: [scene],
  banner: false,
  audio: { noAudio: true },
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
  tool = next;
  scene.tool = next;
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
  $("#placement-hint").innerHTML = d
    ? `${icon("hammer")} Place ${d.name.toLowerCase()} · ${d.cost} gold ${Object.entries(
        d.materials ?? {},
      )
        .map(([r, n]) => `· ${n} ${r}`)
        .join(
          " ",
        )} · ${FOOTPRINTS[next as BuildingKind].join("×")} tiles ${next === "house" ? `<button id="rotate-placement" class="rotate-placement" title="Rotate cottage (R)">${icon("reset")} Rotate <kbd>R</kbd></button>` : ""} <kbd>Esc</kbd>`
    : next === "road"
      ? `${icon("road")} Click to lay roads · 12 gold · Bridges 35 gold <kbd>Esc</kbd>`
      : next === "bulldoze"
        ? `${icon("hammer")} Click to remove · Recover half the gold cost <kbd>Esc</kbd>`
        : `${icon("inspect")} Click a building to explore. Drag to look around.`;
  if (next === "house") $("#rotate-placement").onclick = rotatePlacement;
  scene.drawOverlay();
}
function rotatePlacement() {
  scene.rotation = ((scene.rotation + 1) % 4) as 0 | 1 | 2 | 3;
  scene.drawOverlay();
  toast(
    `Cottage facing ${["southeast", "southwest", "northwest", "northeast"][scene.rotation]}.`,
  );
}
function renderSidebar() {
  $("#build-tab").classList.toggle("active", tab === "build");
  $("#town-tab").classList.toggle("active", tab === "town");
  if (tab === "town") {
    $("#sidebar-content").innerHTML =
      `<div class="town-overview"><span class="eyebrow">GROWING TOGETHER</span><h3>Life in Pinehaven</h3><div id="town-stats"></div><h4>Town inventory</h4><p class="muted">Across buildings and deliveries.</p><div id="inventory"></div><div class="chain-note">${icon("cloud")} Single-player foundation<br><small>Firebase cloud saves · Shared worlds planned</small></div></div>`;
    updateUI();
    return;
  }
  const names = {
    homes: "Neighbourhood",
    production: "Make & gather",
    town: "Town essentials",
  };
  $("#sidebar-content").innerHTML =
    `<div class="category-tabs">${Object.entries(names)
      .map(
        ([id, name]) =>
          `<button data-category="${id}" class="${category === id ? "active" : ""}">${name}</button>`,
      )
      .join(
        "",
      )}</div><div class="catalog-heading"><h3>${names[category]}</h3><span>${Object.values(BUILDINGS).filter((b) => b.category === category).length} buildings</span></div><div class="building-grid">${(
      Object.entries(BUILDINGS) as [BuildingKind, typeof BUILDINGS.house][]
    )
      .filter(([, d]) => d.category === category)
      .map(
        ([kind, d]) =>
          `<button class="building-card ${tool === kind ? "selected" : ""}" data-building="${kind}" title="${d.description}">${frame(kind)}<b>${d.name}</b><span class="price">${icon("coin")}${d.cost}${d.materials ? `<small>+ materials</small>` : ""}</span></button>`,
      )
      .join(
        "",
      )}</div><div class="build-note">${icon(category === "production" ? "factory" : "leaf")}<div><b>${category === "production" ? "A town that works together." : "Leave a little room to grow."}</b><p>${category === "production" ? "Roads carry workers and deliveries. Click a building to see what it needs." : "Connect homes to a warehouse by road. Every cottage welcomes three residents."}</p></div></div><button class="chain-button" id="production-guide">${icon("factory")} See production chains ${icon("arrow")}</button>`;
  document.querySelectorAll<HTMLElement>("[data-category]").forEach(
    (el) =>
      (el.onclick = () => {
        category = el.dataset.category as typeof category;
        renderSidebar();
      }),
  );
  document
    .querySelectorAll<HTMLElement>("[data-building]")
    .forEach(
      (el) => (el.onclick = () => setTool(el.dataset.building as BuildingKind)),
    );
  $("#production-guide").onclick = showChains;
}
scene.onTile = async (p: Point) => {
  if (tool === "inspect") {
    const b = simulation.buildingAt(p.x, p.y);
    selected = b?.id ?? null;
    scene.selected = selected;
    scene.drawOverlay();
    renderInspector();
    if (!b && DEPOSITS[key(p)])
      toast(
        `${DEPOSITS[key(p)] === "stone" ? "Stone" : "Metal"} deposit · ${simulation.state.deposits[key(p)]} remaining`,
      );
    return;
  }
  const result = await gateway.command(
    tool === "bulldoze"
      ? { type: "demolish", ...p }
      : { type: "place", kind: tool, rotation: scene.rotation, ...p },
  );
  toast(result.message);
  if (result.ok) {
    scene.redraw();
    save(false);
    updateUI();
  }
};
scene.onHover = (p) => {
  $("#tile-label").textContent = p
    ? `${p.x}, ${p.y}${DEPOSITS[key(p)] ? " · " + DEPOSITS[key(p)] + " deposit" : ""}`
    : "";
};
scene.onSelect = (id) => {
  selected = id;
  scene.selected = id;
  scene.drawOverlay();
  renderInspector();
};
scene.onCamera = () => {
  if ($("#zoom-level"))
    $("#zoom-level").textContent =
      `${Math.round(scene.cameras.main.zoom * 100)}%`;
};
function renderInspector() {
  const b = selected ? simulation.building(selected) : null;
  const panel = $("#inspector");
  panel.hidden = !b;
  if (!b) return;
  const d = BUILDINGS[b.kind];
  panel.innerHTML = `<button id="close-inspector" class="icon-button close" aria-label="Close building details">${icon("close")}</button><span class="eyebrow">${d.category === "production" ? "LITTLE INDUSTRIES" : "AROUND TOWN"}</span>${frame(b.kind, "inspector-art")}<h3>${d.name}</h3><p>${d.description}</p><div id="building-status" class="building-status"></div><div id="building-detail"></div>${d.recipe ? '<button id="toggle-production" class="primary"></button>' : ""}`;
  if (b.kind === "house") {
    panel.insertAdjacentHTML(
      "beforeend",
      `<button id="rotate-house" class="primary">${icon("reset")} Rotate cottage · R</button>`,
    );
    $("#rotate-house").onclick = async () => {
      const result = await gateway.command({ type: "rotate", id: b.id });
      toast(result.message);
      scene.redraw();
      save(false);
    };
  }
  $("#close-inspector").onclick = () => {
    selected = null;
    scene.selected = null;
    panel.hidden = true;
    scene.drawOverlay();
  };
  if (d.recipe)
    $("#toggle-production").onclick = async () => {
      const result = await gateway.command({ type: "toggle", id: b.id });
      toast(result.message);
      scene.redraw();
      updateInspector();
    };
  updateInspector();
}
function updateInspector() {
  if (!selected) return;
  const b = simulation.building(selected);
  if (!b) {
    $("#inspector").hidden = true;
    return;
  }
  const d = BUILDINGS[b.kind];
  $("#building-status").textContent = simulation.status(b);
  $("#building-status").classList.toggle(
    "warning",
    simulation.status(b) !== "Producing" && !!d.recipe,
  );
  $("#building-detail").innerHTML =
    `<div class="detail-row"><span>Road connection</span><b>${b.connected ? "Connected" : "Disconnected"}</b></div>${d.jobs ? `<div class="detail-row"><span>Workers</span><b>${b.workers} / ${d.jobs}</b></div>` : ""}${
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
          ? `<div class="residents">${simulation.state.residents
              .filter((r) => r.home === b.id)
              .map(
                (r) =>
                  `<div>${icon("people")}<span><b>${r.name}</b><small>${r.job ? BUILDINGS[simulation.building(r.job)!.kind].name : "Enjoying town life"}</small></span></div>`,
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
      ctx.fillStyle = x > 23 ? "#82aaa0" : "#8fa57c";
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
}
function updateUI() {
  const s = simulation.state;
  $("#gold").textContent = Math.floor(s.money).toLocaleString();
  for (const r of ["wood", "stone", "metal"] as const)
    $("#" + r).textContent = simulation.stored(r).toString();
  $("#population").textContent = s.residents.length.toString();
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
      `<div class="detail-row"><span>Employed residents</span><b>${s.residents.filter((r) => r.job).length} / ${s.residents.length}</b></div><div class="detail-row"><span>Deliveries on the road</span><b>${s.agents.filter((a) => a.kind === "truck").length}</b></div><div class="detail-row"><span>Tools exported</span><b>${s.exported}</b></div><div class="detail-row"><span>Food needs met</span><b>${s.food}%</b></div>`;
    const totals = simulation.totals();
    $("#inventory").innerHTML = RESOURCES.map(
      (r) =>
        `<div class="inventory-row">${icon(r === "bread" ? "bread" : r === "wood" || r === "stone" || r === "metal" ? r : "box")}<span>${RESOURCE_NAMES[r]}</span><b>${totals[r]}</b></div>`,
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
    `<span class="eyebrow">EVERY LITTLE THING CONNECTS</span><h2>Made in Pinehaven.</h2><p>Factories need people, roads, and the right ingredients. Trucks move real inventory between connected buildings.</p><div class="chain"><b>Daily bread</b><span>Wheat farm → Flour mill → Bakery → Warehouse</span><small>Grain becomes flour, then bread. Residents eat bread each day.</small></div><div class="chain"><b>A useful little industry</b><span>Forester → Sawmill → Workshop → Warehouse</span><small>Wood becomes planks, then tools. Tools sell for 35 gold each.</small></div><div class="chain"><b>Room to grow</b><span>Quarry / Metal mine → Warehouse → Construction</span><small>Mines use finite deposits. Building costs use materials already delivered to warehouses.</small></div><p class="muted">Homes pay 6 gold per resident each day. Disconnected or understaffed buildings stop producing.</p>`,
  );
}
function showSettings() {
  openModal(
    `<span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>Your little world.</h2><p>Your town saves automatically on this device. Export a copy to keep or move it.</p><div class="modal-actions"><button id="modal-save">${icon("save")} Save on this device</button><button id="export">${icon("download")} Export town</button><button id="import">${icon("upload")} Import town</button><button id="cloud-settings">${icon("cloud")} Cloud saves & sign-in</button><button id="art">${icon("leaf")} View art directions</button><button id="reset" class="danger">${icon("reset")} Start a fresh town</button></div><p class="muted">Foundation v0.1 · Phaser + TypeScript · Pine & Copper</p>`,
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
      `<span class="eyebrow">OUR VISUAL DIRECTION</span><h2>Pine & Copper.</h2><p>Forest greens, warm timber, copper machinery. Pine & Copper architecture with Garden Streets: textured trees, warm paving, and shaded villagers.</p><img class="art-board" src="/street-directions.png" alt="Woodland Lanes, Alpine Cobble, and the selected Garden Streets style"><p class="muted">Concept art. The playable scene uses individual building sprites and a live simulation.</p>`,
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
$("#build-tab").onclick = () => {
  tab = "build";
  renderSidebar();
};
$("#town-tab").onclick = () => {
  tab = "town";
  renderSidebar();
};
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
    `<span class="eyebrow">WELCOME TO PINEHAVEN</span><h2>Settle in. Build a little.</h2><div class="help-list"><p><b>Build</b> Choose a building, then click an empty tile. Connect it to a warehouse with roads.</p><p><b>Explore</b> Click a building for its workers, stock, and production. Drag the map to move. Scroll to zoom.</p><p><b>Gather</b> Quarries need stone deposits; metal mines need metal deposits. Unbuilt deposits are marked on the map.</p><p><b>Automate</b> Trucks deliver inputs and outputs. Residents walk or drive to work. Production stops without roads or workers.</p><p><b>Shortcuts</b> V explore · R road · X remove · G grid · Esc cancel · WASD / arrows move · Space + drag pan</p></div>`,
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
  if (k === "escape" || k === "v") setTool("inspect");
  if (k === "r") {
    if (tool === "house") rotatePlacement();
    else if (
      tool === "inspect" &&
      selected &&
      simulation.building(selected)?.kind === "house"
    )
      $("#rotate-house").click();
    else setTool("road");
  }
  if (k === "x") setTool("bulldoze");
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
renderSidebar();
updateUI();
if (restoreError) toast(restoreError);
