import { dimensions } from "./catalog.js";
import { iso } from "./rendering.js";
import type { Building } from "./simulation.js";

export const NIGHT_AMBIENT = [52, 65, 91] as const;
export interface Lamp {
  x: number;
  y: number;
  groundX: number;
  groundY: number;
  power: number;
  radius: number;
}

/** Project a painted window down onto its visible foundation edge. */
export function windowGround(b: Building, screenX: number, elevation: number) {
  const [w, h] = dimensions(b.kind, b.rotation, b.plot);
  const left = iso(b.x - 0.5, b.y + h - 0.5),
    front = iso(b.x + w - 0.5, b.y + h - 0.5),
    right = iso(b.x + w - 0.5, b.y - 0.5);
  const x = Math.max(left.x, Math.min(right.x, screenX));
  const [a, z] = x <= front.x ? [left, front] : [front, right];
  return {
    x,
    y: a.y + ((z.y - a.y) * (x - a.x)) / Math.max(1, z.x - a.x) - elevation,
  };
}

export function castShadow(
  x: number,
  y: number,
  lamps: readonly Lamp[],
  night: boolean,
) {
  let closest: Lamp | undefined,
    distance = Infinity;
  if (night)
    for (const lamp of lamps) {
      const d = Math.hypot(x - lamp.groundX, (y - lamp.groundY) * 2);
      if (d > 3 && d < lamp.radius * 1.3 && d < distance) {
        closest = lamp;
        distance = d;
      }
    }
  if (!night) return { x: 13, y: 8, alpha: 0.18 };
  if (!closest) return { x: 0, y: 2, alpha: 0.11 };
  const dx = x - closest.groundX,
    dy = y - closest.groundY,
    length = Math.hypot(dx, dy);
  return {
    x: (dx / length) * 19,
    y: (dy / length) * 12,
    alpha: 0.3 * Math.min(1, closest.power),
  };
}

/** Cached world-space illumination multiplies existing ground/wall texture. */
export function paintLightField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lamps: readonly Lamp[],
  left: number,
  top: number,
  scale: number,
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgb(${NIGHT_AMBIENT.join(",")})`;
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(-left, -top);
  ctx.globalCompositeOperation = "lighter";
  const glow = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    power: number,
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(225,191,125,${Math.min(1, power)})`);
    gradient.addColorStop(
      0.28,
      `rgba(225,170,86,${Math.min(1, power * 0.62)})`,
    );
    gradient.addColorStop(
      0.64,
      `rgba(205,141,60,${Math.min(1, power * 0.22)})`,
    );
    gradient.addColorStop(1, "rgba(180,120,45,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };
  for (const lamp of lamps) {
    glow(
      lamp.groundX,
      lamp.groundY + 4,
      lamp.radius,
      lamp.radius * 0.53,
      lamp.power * 0.75,
    );
    glow(lamp.x, lamp.y, lamp.radius * 0.54, lamp.radius * 0.65, lamp.power);
  }
  ctx.restore();
}
