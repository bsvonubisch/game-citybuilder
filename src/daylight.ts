import type { World } from "./simulation.js";
/** Four minutes per day at 1x; start at 08:00. */
export const DAY_TICKS=960;
export function lengthenDays(world:Pick<World,"tick"|"clockVersion"|"decorations">) {
  if(world.clockVersion===2)return;
  const shift=world.tick*3;
  world.tick+=shift;
  for(const d of world.decorations??[])if(d.cutAt!==undefined){
    d.cutAt+=shift;
    if(d.regrowsAt!==undefined)d.regrowsAt+=shift;
  }
  world.clockVersion=2;
}
export function daylight(tick: number) {
  const hour = ((tick / DAY_TICKS) * 24 + 8) % 24;
  const smooth = (n: number) => {
    const t = Math.max(0, Math.min(1, n));
    return t * t * (3 - 2 * t);
  };
  const light = smooth((hour - 5) / 2) * (1 - smooth((hour - 18) / 3));
  const night = hour < 6 || hour >= 20;
  return {
    day: Math.floor((tick + DAY_TICKS/3) / DAY_TICKS) + 1,
    hour,
    light,
    darkness: 1 - light,
    night,
    phase:
      hour < 5 || hour >= 21
        ? "Night"
        : hour < 7
          ? "Dawn"
          : hour < 18
            ? "Day"
            : "Dusk",
    workRate: night ? 0.25 : 1,
  };
}

/** Only announce a live shift transition, never loading a save or a paused tick. */
export function shiftChange(previous: number | undefined, tick: number) {
  if (previous === undefined || tick <= previous || tick - previous >= DAY_TICKS)
    return null;
  const now = daylight(tick);
  if (daylight(previous).night === now.night) return null;
  return now.night ? "night" : "morning";
}

/** Bright amber details in the existing art emit light; green roofs and grey
 * stone do not. This is a runtime light mask, never a changed source sprite. */
export function warmEmission(r: number, g: number, b: number, a: number) {
  if (
    a < 150 ||
    r < 224 ||
    g < 146 ||
    g > 239 ||
    b > 148 ||
    r < g * 1.05 ||
    g < b * 1.35
  )
    return 0;
  return Math.min(1, ((r - 214) / 41) * ((g - b) / 110));
}
