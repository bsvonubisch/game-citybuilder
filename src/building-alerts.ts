import { buildingName } from "./catalog.js";
import { icon } from "./icons.js";
import { buildingGuidance } from "./building-guidance.js";
import { productionConnections } from "./logistics.js";
import { cameraViewport } from "./rendering.js";
import type { Building, BuildingAlert, Simulation } from "./simulation.js";
import type Phaser from "phaser";

export const alertIcon: Record<BuildingAlert["kind"], string> = {
  crop: "leaf",
  construction: "hammer",
  road: "road-off",
  warehouse: "warehouse-off",
  paused: "pause",
  depleted: "stone",
  workers: "people",
  output: "box",
  input: "download",
  leisure: "heart",
};

/** Status is derived from the simulation. Only changed badges touch the DOM. */
export class BuildingAlerts {
  private badges = new Map<
    number,
    { button: HTMLButtonElement; signature: string }
  >();
  private revision = "";
  private cameraKey = "";
  private state?: Simulation["state"];
  private simulation?: Simulation;
  constructor(
    private container: HTMLElement,
    private select: (id: number) => void,
  ) {}
  private explain(id: number) {
    const sim = this.simulation,
      badge = this.badges.get(id);
    const b = sim?.building(id);
    if (!sim || !b || !badge) return;
    const guide = buildingGuidance(sim, b, productionConnections(sim, id));
    const target = badge.button.querySelector(".building-alert-tip > span");
    if (target && guide)
      target.textContent = `${guide.message} Select this icon, then choose “${guide.label}”.`;
  }
  update(
    sim: Simulation,
    camera: Phaser.Cameras.Scene2D.Camera,
    inspect: boolean,
    anchor: (b: Building) => { x: number; y: number; center?: boolean } | undefined,
  ) {
    this.simulation = sim;
    const revision = `${sim.state.revision}:${sim.state.tick}:${inspect}`;
    const changed = revision !== this.revision || this.state !== sim.state;
    if (changed) {
      this.revision = revision;
      this.state = sim.state;
      this.container.classList.toggle("interactive", inspect);
      const active = new Set<number>();
      for (const b of sim.state.buildings) {
        const alert = sim.alert(b);
        if (!alert) continue;
        active.add(b.id);
        let badge = this.badges.get(b.id);
        if (!badge) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "building-alert";
          button.onclick = () => this.select(b.id);
          button.onpointerenter = () => this.explain(b.id);
          button.onfocus = () => this.explain(b.id);
          this.container.append(button);
          badge = { button, signature: "" };
          this.badges.set(b.id, badge);
        }
        const label = `${buildingName(b)}: ${alert.title}`;
        const signature = `${label}:${alert.message}`;
        if (badge.signature !== signature) {
          badge.signature = signature;
          badge.button.dataset.kind = alert.kind;
          const progress = b.construction
            ? Math.floor(
                (b.construction.completed / b.construction.required) * 100,
              )
            : 0;
          badge.button.innerHTML = `${icon(alertIcon[alert.kind])}${b.construction ? `<span class="construction-meter" role="progressbar" aria-label="Construction progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></span><span class="construction-percent">${progress}%</span>` : ""}<span class="building-alert-tip" role="tooltip" id="building-alert-tip-${b.id}"><strong></strong><span></span></span>`;
          badge.button.querySelector("strong")!.textContent = label;
          badge.button.querySelector(
            ".building-alert-tip > span",
          )!.textContent = `${alert.message} Click for next steps.`;
          badge.button.setAttribute("aria-label", label);
          badge.button.setAttribute(
            "aria-describedby",
            `building-alert-tip-${b.id}`,
          );
          if (badge.button.matches(":hover, :focus-visible"))
            this.explain(b.id);
        }
        badge.button.tabIndex = inspect ? 0 : -1;
      }
      for (const [id, badge] of this.badges)
        if (!active.has(id)) {
          badge.button.remove();
          this.badges.delete(id);
        }
    }
    const v = cameraViewport(camera);
    const cameraKey = `${v.x}:${v.y}:${camera.zoom}:${camera.width}:${camera.height}`;
    if (!changed && cameraKey === this.cameraKey) return;
    this.cameraKey = cameraKey;
    for (const b of sim.state.buildings) {
      const badge = this.badges.get(b.id);
      if (!badge) continue;
      const p = anchor(b);
      const x = p ? (p.x - v.x) * camera.zoom : -100;
      const y = p ? (p.y - v.y) * camera.zoom : -100;
      const visible =
        !!p && x > 14 && x < camera.width - 14 && y > 28 && y < camera.height;
      badge.button.hidden = !visible;
      if (!visible) continue;
      badge.button.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, ${p?.center ? '-50%' : '-100%'})`;
      badge.button.dataset.edge =
        x < 130 ? "left" : x > camera.width - 130 ? "right" : "center";
    }
  }
  clear() {
    this.badges.forEach(({ button }) => button.remove());
    this.badges.clear();
    this.revision = "";
    this.cameraKey = "";
    this.state = undefined;
  }
}
