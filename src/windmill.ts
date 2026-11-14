/** The two rear views put the axle on the FAR wall, behind the tower. */
export function rotorView(rotation: number) {
  const rear = rotation >= 2;
  return {
    rear,
    flipX: rotation % 2 === 1,
    depthOffset: rear ? -0.2 : 0.2,
    spin: rear ? -1 : 1,
  };
}
export function drawRotor(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement,
  x: number,
  y: number,
  scale: number,
  rotation: number,
  phase = 0,
) {
  const view = rotorView(rotation),
    cell = source.width / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (view.flipX ? -1 : 1), scale);
  ctx.transform(0.894427, 0.447214, 0, 1, 0, 0);
  ctx.rotate(phase * view.spin);
  ctx.drawImage(
    source,
    cell,
    0,
    cell,
    source.height,
    -cell / 2,
    -source.height / 2,
    cell,
    source.height,
  );
  ctx.restore();
}
