import { daylight, shiftChange } from "./daylight.js";
import { icon } from "./icons.js";

export class DaylightUI {
  private previous?: number;
  private timer = 0;
  private phase = "";
  private notice: HTMLElement;
  constructor(private panel: HTMLElement) {
    panel.classList.add("daylight-clock");
    panel.innerHTML = `<span id="daylight-icon" aria-hidden="true"></span><div class="daylight-labels"><b id="day"></b><strong id="shift-state"></strong></div><span class="daylight-season">Spring · Year 1</span>`;
    this.notice = document.createElement("div");
    this.notice.id = "shift-notice";
    this.notice.hidden = true;
    this.notice.innerHTML = `<span class="shift-notice-icon" aria-hidden="true"></span><div role="status" aria-live="polite" aria-atomic="true"><strong></strong><p></p></div><button class="icon-button" aria-label="Dismiss day and night notice">${icon("close")}</button>`;
    panel.parentElement!.append(this.notice);
    this.notice.querySelector("button")!.onclick = () => this.dismiss();
  }
  private dismiss() {
    window.clearTimeout(this.timer);
    this.notice.hidden = true;
  }
  reset() {
    this.previous = undefined;
    this.dismiss();
  }
  update(tick: number) {
    const light = daylight(tick);
    const minutes = Math.round(light.hour * 60) % 1440;
    this.panel.querySelector("#day")!.textContent =
      `Day ${light.day} · ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const phase = light.night ? "night" : light.phase.toLowerCase();
    if (phase !== this.phase) {
      this.phase = phase;
      this.panel.dataset.phase = phase;
      this.panel.querySelector("#daylight-icon")!.innerHTML = icon(
        light.night ? "moon" : phase === "dusk" ? "sunset" : "sun",
      );
      this.panel.querySelector("#shift-state")!.textContent = light.night
        ? "Night shift · 25% work"
        : `${light.phase === "Day" ? "Day shift" : light.phase} · 100% work`;
      this.panel.title = light.night
        ? "Night shift · 20:00–06:00. Work and construction run at 25% pace. Fewer deliveries leave; most residents rest. Full work resumes at 06:00."
        : phase === "dusk"
          ? "Dusk · lanterns are coming on. Work stays at full pace until the night shift starts at 20:00."
          : "Day shift · 06:00–20:00. Work and construction run at full pace. Lights fade out in the morning; night shift starts at 20:00.";
    }
    const change = shiftChange(this.previous, tick);
    this.previous = tick;
    if (!change) return;
    this.dismiss();
    this.notice.dataset.phase = change;
    this.notice.querySelector(".shift-notice-icon")!.innerHTML = icon(
      change === "night" ? "moon" : "sun",
    );
    this.notice.hidden = false;
    this.notice.querySelector("strong")!.textContent =
      change === "night" ? "Night has begun" : "Morning has arrived";
    this.notice.querySelector("p")!.textContent =
      change === "night"
        ? "Work and construction slow to 25%. Fewer deliveries leave; most residents rest until 06:00."
        : "Work and construction return to 100%. Residents head out and deliveries resume their daytime pace.";
    this.timer = window.setTimeout(() => this.dismiss(), 5000);
  }
}
