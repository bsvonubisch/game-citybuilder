import type { BuildingKind } from "./catalog.js";
export type GroundPoint = readonly [number, number];
export type PlotCorners = readonly [GroundPoint, GroundPoint, GroundPoint];
export interface BuildingArt {
  texture: string;
  frame: number;
  columns: number;
  rows: number;
  size: readonly [number, number];
  /** Left, front, right outer foundation corners in reference-cell pixels. */
  ground: PlotCorners;
  chimney?: GroundPoint;
  mechanism?: GroundPoint;
}
// Full stone foundations measured independently in all four views. Mapping
// these corners aligns both plot axes and fills the entire reserved plot.
const grounds: Record<BuildingKind, readonly PlotCorners[]> = {
  house: [
    [
      [0, 443],
      [292, 590],
      [584, 443],
    ],
    [
      [37, 442],
      [329, 589],
      [624, 441],
    ],
    [
      [9, 445],
      [306, 591],
      [598, 445],
    ],
    [
      [30, 443],
      [328, 590],
      [623, 443],
    ],
  ],
  farm: [
    [
      [32, 461],
      [316, 572],
      [600, 405],
    ],
    [
      [45, 421],
      [279, 571],
      [594, 436],
    ],
    [
      [17, 375],
      [288, 559],
      [594, 436],
    ],
    [
      [29, 397],
      [275, 551],
      [605, 370],
    ],
  ],
  mill: [
    [
      [49, 451],
      [316, 585],
      [584, 451],
    ],
    [
      [35, 452],
      [301, 586],
      [576, 450],
    ],
    [
      [52, 455],
      [318, 586],
      [584, 455],
    ],
    [
      [33, 456],
      [299, 588],
      [574, 453],
    ],
  ],
  bakery: [
    [
      [31, 439],
      [319, 591],
      [609, 439],
    ],
    [
      [19, 439],
      [303, 588],
      [596, 438],
    ],
    [
      [29, 417],
      [316, 570],
      [609, 417],
    ],
    [
      [17, 421],
      [305, 571],
      [596, 419],
    ],
  ],
  forester: [
    [
      [42, 428],
      [306, 582],
      [608, 410],
    ],
    [
      [25, 415],
      [320, 580],
      [608, 415],
    ],
    [
      [19, 408],
      [309, 569],
      [598, 408],
    ],
    [
      [21, 408],
      [313, 574],
      [610, 408],
    ],
  ],
  sawmill: [
    [
      [150, 408],
      [393, 497],
      [715, 360],
    ],
    [
      [128, 285],
      [307, 493],
      [608, 443],
    ],
    [
      [165, 389],
      [401, 472],
      [715, 340],
    ],
    [
      [119, 366],
      [356, 470],
      [609, 286],
    ],
  ],
  workshop: [
    [
      [57, 485],
      [288, 597],
      [609, 423],
    ],
    [
      [52, 404],
      [323, 593],
      [575, 496],
    ],
    [
      [49, 443],
      [273, 547],
      [588, 394],
    ],
    [
      [27, 382],
      [301, 580],
      [574, 465],
    ],
  ],
  warehouse: [
    [
      [175, 395],
      [442, 499],
      [713, 364],
    ],
    [
      [0, 348],
      [273, 494],
      [525, 389],
    ],
    [
      [150, 344],
      [448, 484],
      [714, 371],
    ],
    [
      [28, 379],
      [287, 489],
      [561, 334],
    ],
  ],
  park: [
    [
      [41, 404],
      [318, 563],
      [591, 405],
    ],
    [
      [29, 391],
      [314, 569],
      [591, 392],
    ],
    [
      [35, 356],
      [318, 528],
      [591, 355],
    ],
    [
      [35, 316],
      [320, 516],
      [590, 346],
    ],
  ],
  quarry: [
    [
      [13, 305],
      [223, 417],
      [427, 305],
    ],
    [
      [20, 306],
      [225, 418],
      [429, 305],
    ],
    [
      [17, 306],
      [228, 416],
      [431, 306],
    ],
    [
      [18, 305],
      [222, 415],
      [433, 302],
    ],
  ],
  mine: [
    [
      [18, 312],
      [218, 428],
      [436, 302],
    ],
    [
      [11, 303],
      [223, 425],
      [436, 302],
    ],
    [
      [9, 301],
      [215, 420],
      [432, 294],
    ],
    [
      [8, 296],
      [219, 418],
      [431, 296],
    ],
  ],
};
const chimneys: Partial<Record<BuildingKind, readonly GroundPoint[]>> = {
  house: [
    [221, 16],
    [391, 16],
    [359, 22],
    [255, 25],
  ],
  bakery: [
    [421, 50],
    [288, 43],
    [223, 81],
    [250, 101],
  ],
  forester: [
    [252, 103],
    [288, 133],
    [393, 99],
    [337, 97],
  ],
  sawmill: [
    [563, 62],
    [246, 38],
    [308, 125],
    [260, 52],
  ],
  workshop: [
    [240, 48],
    [270, 48],
    [333, 49],
    [307, 27],
  ],
  mine: [
    [194, 35],
    [243, 27],
    [295, 36],
    [270, 38],
  ],
};
const mechanisms: Partial<Record<BuildingKind, readonly GroundPoint[]>> = {
  mill: [
    [270, 172],
    [362, 172],
    [252, 180],
    [363, 184],
  ],
  park: [
    [323, 261],
    [315, 272],
    [318, 214],
    [315, 223],
  ],
  sawmill: [
    [392, 302],
    [424, 315],
    [244, 252],
    [234, 325],
  ],
  workshop: [
    [285, 459],
    [458, 452],
    [456, 375],
    [100, 349],
  ],
};
export function buildingArt(kind: BuildingKind, rotation = 0): BuildingArt {
  return {
    texture: `plot-${kind}`,
    frame: rotation,
    columns: kind === "mine" || kind === "quarry" ? 4 : 2,
    rows: 2,
    size:
      kind === "warehouse" || kind === "sawmill"
        ? [768, 512]
        : kind === "mine" || kind === "quarry"
          ? [443, 443]
          : [627, 627],
    ground: grounds[kind][rotation],
    chimney: chimneys[kind]?.[rotation],
    mechanism: mechanisms[kind]?.[rotation],
  };
}
