/** One existing simulation day remains 240 ticks. Start at 08:00. */
export function daylight(tick: number) {
  const hour = ((tick / 240) * 24 + 8) % 24;
  const smooth = (n: number) => {
    const t = Math.max(0, Math.min(1, n));
    return t * t * (3 - 2 * t);
  };
  const light = smooth((hour - 5) / 2) * (1 - smooth((hour - 18) / 3));
  const night = hour < 6 || hour >= 20;
  return {
    day: Math.floor((tick + 80) / 240) + 1,
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
  if (previous === undefined || tick <= previous || tick - previous >= 240)
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
