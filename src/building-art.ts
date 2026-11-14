import { BUILDINGS, type BuildingKind } from "./catalog.js";

export type GroundPoint = readonly [number, number];
export interface BuildingArt {
  texture: "buildings" | "houses" | "mill";
  frame: number;
  cellSize: number;
  /** Ground contacts in untrimmed atlas-cell pixels, including steps and props.
   * Roofs, tree canopies and other elevated parts are intentionally excluded. */
  ground: readonly GroundPoint[];
}

// Calibrated against the actual artwork, not its transparent bounds or bottom pixel.
// Contacts trace the visible foundation and the feet of ground-level props.
// The obscured rear corner is inferred by the two isometric-axis extents.
const buildingGround: readonly (readonly GroundPoint[])[] = [
  [
    [56, 374],
    [130, 400],
    [228, 410],
    [366, 355],
  ],
  [
    [6, 318],
    [207, 402],
    [401, 295],
  ],
  [
    [60, 355],
    [119, 392],
    [202, 407],
    [286, 406],
    [377, 363],
  ],
  [
    [50, 324],
    [87, 347],
    [208, 385],
    [278, 370],
    [366, 333],
  ],
  [
    [4, 313],
    [36, 327],
    [84, 342],
    [84, 381],
    [174, 386],
    [208, 368],
    [283, 367],
    [386, 323],
  ],
  [
    [12, 309],
    [38, 334],
    [101, 363],
    [136, 372],
    [157, 389],
    [222, 389],
    [253, 365],
    [302, 361],
    [380, 332],
    [399, 288],
  ],
  [
    [18, 360],
    [54, 372],
    [102, 375],
    [155, 387],
    [189, 406],
    [242, 405],
    [274, 383],
    [367, 348],
  ],
  [
    [0, 328],
    [34, 344],
    [34, 377],
    [103, 388],
    [160, 371],
    [205, 385],
    [274, 383],
    [393, 332],
  ],
  [
    [13, 282],
    [203, 398],
    [404, 283],
  ],
];

const houseGround: readonly (readonly GroundPoint[])[] = [
  [
    [111, 509],
    [191, 546],
    [274, 546],
    [357, 565],
    [532, 484],
  ],
  [
    [85, 482],
    [191, 534],
    [274, 565],
    [357, 551],
    [437, 548],
    [521, 518],
  ],
  [
    [112, 471],
    [244, 533],
    [285, 551],
    [321, 547],
    [368, 550],
    [535, 473],
  ],
  [
    [83, 476],
    [329, 554],
    [514, 475],
  ],
];

/** The neighboring warehouse leaks into the workshop's atlas cell. Exclude that
 * fragment from its runtime frame without modifying the original artwork. */
export function atlasContentWidth(
  texture: string,
  frame: number,
  cellWidth: number,
) {
  return texture === "buildings" && frame === 6
    ? Math.floor((cellWidth * 390) / 418)
    : cellWidth;
}

export function buildingArt(kind: BuildingKind, rotation = 0): BuildingArt {
  if (kind === "mill")
    return {
      texture: "mill",
      frame: 0,
      cellSize: 887,
      ground: [
        [128, 743],
        [235, 806],
        [330, 818],
        [409, 849],
        [603, 843],
        [815, 763],
      ],
    };
  if (kind === "house") {
    const frame = [1, 0, 2, 3][rotation];
    return {
      texture: "houses",
      frame,
      cellSize: 627,
      ground: houseGround[frame],
    };
  }
  const frame = BUILDINGS[kind].frame;
  return {
    texture: "buildings",
    frame,
    cellSize: 418,
    ground: buildingGround[frame],
  };
}
