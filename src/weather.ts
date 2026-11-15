import { DAY_TICKS } from "./daylight.js";

export type WeatherKind = "clear" | "cloudy" | "rain" | "mist";
const PERIOD = DAY_TICKS / 2;
const TRANSITION = 100;
const PATTERN: WeatherKind[] = ["clear", "cloudy", "rain", "clear", "mist", "clear", "cloudy", "rain", "cloudy", "clear"];
const CONDITIONS = {
  clear: { cloud: 0, rain: 0, mist: 0, label: "Clear skies", icon: "sun" },
  cloudy: { cloud: 0.7, rain: 0, mist: 0, label: "Cloudy", icon: "cloud" },
  rain: { cloud: 1, rain: 1, mist: 0, label: "Rain showers", icon: "rain" },
  mist: { cloud: 0.3, rain: 0, mist: 1, label: "Valley mist", icon: "mist" },
};
/** Weather uses simulation time, so pauses, saves and shared towns agree. */
export function weather(tick: number) {
  tick = Math.max(0, Number.isFinite(tick) ? tick : 0);
  const slot = Math.floor(tick / PERIOD), kind = PATTERN[slot % PATTERN.length];
  const before = CONDITIONS[PATTERN[Math.max(0, slot - 1) % PATTERN.length]], after = CONDITIONS[kind];
  const t = Math.min(1, (tick % PERIOD) / TRANSITION), blend = t * t * (3 - 2 * t);
  return { kind, label: after.label, icon: after.icon, changing: blend < 1 && slot > 0,
    cloud: before.cloud + (after.cloud - before.cloud) * blend,
    rain: before.rain + (after.rain - before.rain) * blend,
    mist: before.mist + (after.mist - before.mist) * blend,
    wind: 0.65 + Math.sin(tick / 160) * 0.2,
  };
}
export function rainStrokes(width:number, height:number, time:number, strength:number) {
  const count = Math.min(180, Math.ceil(width * height / 6500)) * Math.max(0,Math.min(1,strength));
  return Array.from({length:Math.floor(count)},(_,i)=>{
    const seed=(i*0.61803398875)%1, speed=230+(i%5)*30;
    return {x:((seed*width+time*48)%(width+24))-12,
      y:(((i*0.38196601125)%1)*height+time*speed)%(height+28)-14,
      length:8+i%7, alpha:0.22+(i%3)*.08};
  });
}

/** Shared smoke motion for renderers and visual checks, in world pixels. */
export function smokePuffs(time:number, id:number, industrial:boolean, wind:number) {
  return Array.from({length:industrial?10:7},(_,i)=>{
    const age=(time*(industrial?.17:.14)+i/(industrial?10:7)+id*.137)%1;
    return {x:age*age*18*wind+Math.sin(age*9+id)*age*2,
      y:-age*(industrial?39:29), radius:(industrial?2.3:1.8)+age*(industrial?5:3.8),
      alpha:Math.sin(Math.min(1,age*6)*Math.PI/2)*(1-age)*.64};
  });
}
