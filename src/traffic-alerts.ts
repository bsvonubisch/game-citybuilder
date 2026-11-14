import type Phaser from "phaser";
import { cameraViewport } from "./rendering.js";
import { icon } from "./icons.js";
import { trafficQueues, type TrafficQueue } from "./traffic-queues.js";
import type { Simulation } from "./simulation.js";

export class TrafficAlerts {
  private revision = "";
  private state?: Simulation["state"];
  private queues: TrafficQueue[] = [];
  private badges = new Map<number, HTMLButtonElement>();
  private rings = new Map<number, Phaser.GameObjects.Graphics>();
  constructor(
    private scene: Phaser.Scene,
    private container: HTMLElement,
    private select: (queue: TrafficQueue) => void,
  ) {}
  update(
    sim: Simulation,
    inspect: boolean,
    time: number,
    sprite: (id: number) => Phaser.GameObjects.Image | undefined,
  ) {
    const revision = `${sim.state.tick}:${sim.state.revision}`;
    if (revision !== this.revision || sim.state !== this.state) {
      this.queues = trafficQueues(sim.state.agents);
      this.revision = revision;
      this.state = sim.state;
    }
    this.container.classList.toggle("interactive", inspect);
    const live = new Set<number>(),
      vehicles = new Set<number>();
    const camera = this.scene.cameras.main,
      v = cameraViewport(camera);
    for (const queue of this.queues) {
      live.add(queue.id);
      const anchor = sprite(queue.id);
      let badge = this.badges.get(queue.id);
      if (!badge) {
        badge = document.createElement("button");
        badge.type = "button";
        badge.className = "building-alert traffic-alert";
        badge.innerHTML = `${icon("traffic")}<b></b><span class="building-alert-tip"><strong></strong><span></span></span>`;
        const id = queue.id;
        badge.onclick = () => {
          const current = this.queues.find((q) => q.id === id);
          if (current) this.select(current);
        };
        this.container.append(badge);
        this.badges.set(queue.id, badge);
      }
      const label = `${queue.severe ? "Heavy traffic" : "Traffic queue"}: ${queue.agents.length} ${queue.agents.length === 1 ? "vehicle" : "vehicles"} delayed`;
      const signature = `${label}:${Math.floor(queue.seconds)}`;
      if (badge.dataset.signature !== signature) {
        badge.dataset.signature = signature;
        badge.setAttribute("aria-label", label);
        badge.querySelector("b")!.textContent = String(queue.agents.length);
        badge.querySelector("strong")!.textContent = label;
        badge.querySelector(".building-alert-tip > span")!.textContent =
          `Longest delay about ${Math.floor(queue.seconds)}s. Click to inspect the queue and improve its route.`;
        badge.dataset.severity = queue.severe ? "heavy" : "slow";
      }
      badge.tabIndex = inspect ? 0 : -1;
      const x = anchor ? (anchor.x - v.x) * camera.zoom : -100,
        y = anchor ? (anchor.y - v.y - 20) * camera.zoom : -100;
      badge.hidden =
        !anchor?.visible ||
        x < 24 ||
        x > camera.width - 24 ||
        y < 32 ||
        y > camera.height;
      badge.style.transform = `translate(${x}px, ${y}px) translate(-50%,-100%)`;
      badge.dataset.edge =
        x < 130 ? "left" : x > camera.width - 130 ? "right" : "center";
      for (const id of queue.agents) {
        vehicles.add(id);
        const car = sprite(id);
        if (!car?.visible) continue;
        let ring = this.rings.get(id);
        if (!ring) {
          ring = this.scene.add.graphics();
          this.rings.set(id, ring);
        }
        const color = queue.severe ? 0xe28259 : 0xe7b154;
        ring
          .clear()
          .setVisible(true)
          .setPosition(car.x, car.y + 2)
          .setDepth(car.depth - 0.01);
        ring
          .fillStyle(color, 0.18 + 0.06 * Math.sin(time * 2))
          .fillEllipse(0, 0, 30, 15);
        ring.lineStyle(1.3, color, 0.85).strokeEllipse(0, 0, 30, 15);
      }
    }
    for (const [id, badge] of this.badges)
      if (!live.has(id)) {
        badge.remove();
        this.badges.delete(id);
      }
    for (const [id, ring] of this.rings)
      if (!vehicles.has(id)) {
        ring.destroy();
        this.rings.delete(id);
      }
  }
  clear() {
    this.badges.forEach((b) => b.remove());
    this.badges.clear();
    this.rings.forEach((r) => r.destroy());
    this.rings.clear();
    this.queues = [];
    this.revision = "";
    this.state = undefined;
  }
}
