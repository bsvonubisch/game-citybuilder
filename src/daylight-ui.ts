import { daylight } from "./daylight.js";
import { weather } from "./weather.js";
import { icon } from "./icons.js";

export class DaylightUI {
  private phase = "";
  constructor(private panel: HTMLElement) {
    panel.classList.add("daylight-clock");
    panel.innerHTML = `<span id="daylight-icon" aria-hidden="true"></span><div class="daylight-labels"><b id="day"></b><strong id="shift-state"></strong></div><span class="daylight-season">Spring · Year 1</span><span class="weather-indicator"></span>`;
  }
  reset() {this.phase="";}
  update(tick: number) {
    const light = daylight(tick), sky = weather(tick);
    const badge=this.panel.querySelector<HTMLElement>(".weather-indicator")!;
    if(badge.dataset.weather!==sky.kind){badge.dataset.weather=sky.kind;badge.innerHTML=`${icon(sky.icon)}<span>${sky.label}</span>`;}
    badge.title=`${sky.label}${sky.changing?" · weather is changing":""}. Weather changes through the day; rain and mist do not stop your town.`;
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
  }
}
