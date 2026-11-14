import type Phaser from "phaser";
import { SIZE } from "./catalog.js";
import { terrain } from "./simulation.js";
import { iso } from "./rendering.js";

/** One moving texture, clipped to the water silhouette. Shorelines and bridge
 * geometry stay still above it; animation does not rebuild or upload map tiles. */
export class WaterArt {
  private surface: Phaser.GameObjects.TileSprite;
  constructor(scene: Phaser.Scene) {
    const maskShape = scene.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (terrain(x, y) === "water") {
          const p = iso(x, y);
          maskShape.fillPoints(
            [
              { x: p.x, y: p.y - 16.1 },
              { x: p.x + 32.2, y: p.y },
              { x: p.x, y: p.y + 16.1 },
              { x: p.x - 32.2, y: p.y },
            ],
            true,
          );
        }
    const source = scene.textures
      .get("brook")
      .getSourceImage() as HTMLImageElement;
    this.surface = scene.add
      .tileSprite(-SIZE * 32, -16, SIZE * 64, SIZE * 32 + 32, "brook")
      .setOrigin(0)
      .setDepth(-1001)
      .setTileScale(320 / source.width, 320 / source.height)
      .setMask(maskShape.createGeometryMask());
  }
  update(time: number) {
    this.surface.setTilePosition(
      time * 10 + Math.sin(time * 0.2) * 2,
      time * 3,
    );
  }
}
