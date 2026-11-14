/** Isometric facing columns used by both the pedestrian and vehicle atlases. */
export function facing(dx: number, dy: number): 0 | 1 | 2 | 3 {
  if (dx > 0) return 0; // southeast
  if (dy > 0) return 1; // southwest
  if (dx < 0) return 2; // northwest
  return 3; // northeast
}

/** Bounds exclude alpha padding, so image origins refer to visible ground contact. */
export function opaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] >= 160) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left) return { x: 0, y: 0, width, height, groundX: width / 2 };
  // The frontmost visible ground-contact pixels can be off center in an asymmetrical building.
  let sum = 0,
    count = 0;
  for (let y = Math.max(top, bottom - 2); y <= bottom; y++)
    for (let x = left; x <= right; x++)
      if (data[(y * width + x) * 4 + 3] >= 160) {
        sum += x;
        count++;
      }
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    groundX: (count ? sum / count : (left + right) / 2) - left,
  };
}
