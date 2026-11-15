import type { BuildingKind, HouseTier } from "./catalog.js";
import { fisheryLayout } from "./shoreline.js";
export type GroundPoint = readonly [number, number];
export type PlotCorners = readonly [GroundPoint, GroundPoint, GroundPoint];
export interface BuildingArt {
  plazaSize?: 2|4;
  sourceRect?:readonly[number,number,number,number];
  texture: string;
  frame: number;
  columns: number;
  rows: number;
  size: readonly [number, number];
  /** Left, front, right outer foundation corners in reference-cell pixels. */
  ground: PlotCorners;
  chimney?: GroundPoint;
  mechanism?: GroundPoint;
  /** A shoreline hut uses only the land rectangle within its full plot. */
  land?: { x: number; y: number; width: number; height: number };
}
// Original ground contacts align the base-free cutouts without shearing them.
// The shared raised foundation fills the exact occupied grid in every view.
const grounds: Record<
  Exclude<BuildingKind, "fishery"|"garden"|"market">,
  readonly PlotCorners[]
> = {
  butcher:[[[70,462],[332,593],[594,462]],[[38,462],[300,593],[562,462]],[[48,460],[310,591],[572,460]],[[39,460],[301,591],[563,460]]],
  hunter:[[[30,445],[312,586],[594,445]],[[25,445],[307,586],[589,445]],[[25,449],[307,590],[589,449]],[[28,449],[310,590],[592,449]]],
  church:[[[28,450],[346,609],[558,503]],[[38,504],[250,610],[568,451]],[[47,472],[263,580],[587,418]],[[45,414],[369,576],[585,468]]],
  cottage:[[[236,331],[450,438],[664,331]],[[219,331],[433,438],[647,331]],[[236,339],[450,446],[664,339]],[[217,339],[431,446],[645,339]]],
  brickworks:[[[40,475],[320,615],[600,475]],[[25,480],[305,620],[585,480]],[[35,472],[315,612],[595,472]],[[35,472],[315,612],[595,472]]],
  tavern: [
    [
      [80, 483],
      [340, 613],
      [600, 483],
    ],
    [
      [27, 483],
      [287, 613],
      [547, 483],
    ],
    [
      [70, 475],
      [330, 605],
      [590, 475],
    ],
    [
      [37, 475],
      [297, 605],
      [557, 475],
    ],
  ],
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
      [64, 360],
      [384, 520],
      [704, 360],
    ],
    [
      [35, 350],
      [355, 510],
      [675, 350],
    ],
    [
      [88, 330],
      [408, 490],
      [728, 330],
    ],
    [
      [38, 340],
      [358, 500],
      [678, 340],
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
      [30, 461],
      [298, 587],
      [608, 437],
    ],
    [
      [19, 437],
      [329, 587],
      [596, 459],
    ],
    [
      [33, 411],
      [328, 549],
      [608, 417],
    ],
    [
      [19, 418],
      [298, 550],
      [595, 410],
    ],
  ],
  park: [
    [
      [31, 410],
      [315, 553],
      [598, 412],
    ],
    [
      [29, 410],
      [310, 553],
      [592, 409],
    ],
    [
      [33, 331],
      [316, 478],
      [598, 330],
    ],
    [
      [29, 329],
      [310, 477],
      [598, 332],
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
  cottage:[[341,88],[545,87],[539,90],[336,91]],
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
  brickworks:[[319,540],[73,481],[0,0],[0,0]],
  bakery:[[480,370],[0,0],[0,0],[0,0]],
  mill: [
    [270, 172],
    [362, 172],
    [377, 147],
    [252, 147],
  ],
  park: [
    [320, 304],
    [307, 302],
    [316, 232],
    [308, 232],
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
export function buildingArt(
  kind: BuildingKind,
  rotation = 0,
  houseTier: HouseTier = 1,
): BuildingArt {
  if(kind==="market")return {texture:"market-stalls",frame:rotation,columns:4,rows:3,size:[444,296],ground:[[0,148],[222,259],[444,148]]};
  if(kind==="church"){
    const frame=[1,0,2,3][rotation],y=frame<2?0:610,height=frame<2?610:637;
    return {texture:"building-church",frame,columns:2,rows:2,size:[630,height],sourceRect:[frame%2*630,y,630,height],ground:grounds.church[frame].map(([x,y])=>[x,y+(frame>=2?25:12)]) as unknown as PlotCorners};
  }
  if (kind === "fishery") {
    // Atlas frames are mirrored pairs; map them to the four road-facing edges.
    const frame = [1, 0, 3, 2][rotation];
    const ground: PlotCorners[] = [
      [
        [53, 495],
        [239, 558],
        [596, 415],
      ],
      [
        [26, 415],
        [374, 558],
        [560, 495],
      ],
      [
        [53, 482],
        [239, 550],
        [596, 407],
      ],
      [
        [26, 407],
        [374, 550],
        [560, 482],
      ],
    ];
    return {
      texture: "building-fishery",
      frame,
      columns: 2,
      rows: 2,
      size: [627, 627],
      ground: ground[frame],
      land: fisheryLayout(rotation).land,
    };
  }
  if (kind === "park" || kind === "garden")
    return {
      texture: "park-parts",
      plazaSize:kind==="garden"?4:2,
      frame: rotation,
      columns: 2,
      rows: 2,
      size: [512, 512],
      ground: [
        [0, 256],
        [256, 384],
        [512, 256],
      ],
      mechanism: [256, kind==="garden"?194:132],
    };
  if (kind === "house" && houseTier > 1) {
    const upgradedGrounds: Record<2 | 3, readonly PlotCorners[]> = {
      2: [
        [
          [121, 447],
          [329, 545],
          [538, 447],
        ],
        [
          [90, 447],
          [300, 545],
          [509, 447],
        ],
        [
          [121, 429],
          [330, 522],
          [540, 429],
        ],
        [
          [86, 428],
          [298, 523],
          [507, 429],
        ],
      ],
      3: [
        [
          [73, 500],
          [323, 622],
          [572, 500],
        ],
        [
          [55, 499],
          [305, 621],
          [554, 499],
        ],
        [
          [73, 499],
          [323, 619],
          [573, 499],
        ],
        [
          [55, 498],
          [305, 619],
          [554, 499],
        ],
      ],
    };
    const upgradedChimneys: Record<2 | 3, readonly GroundPoint[]> = {
      2: [
        [274, 72],
        [350, 72],
        [382, 60],
        [248, 60],
      ],
      3: [
        [242, 17],
        [386, 17],
        [237, 32],
        [385, 32],
      ],
    };
    return {
      texture: `building-house-${houseTier}`,
      frame: rotation,
      columns: 2,
      rows: 2,
      size: [627, 627],
      ground: upgradedGrounds[houseTier as 2 | 3][rotation],
      chimney: upgradedChimneys[houseTier as 2 | 3][rotation],
    };
  }
  return {
    texture: `building-${kind}`,
    frame: rotation,
    columns: kind === "mine" || kind === "quarry" ? 4 : 2,
    rows: 2,
    size:
      kind === "butcher" ? [639,615] : kind === "cottage" ? [887,443] : kind === "sawmill"
        ? [768, 512]
        : kind === "mine" || kind === "quarry"
          ? [443, 443]
          : [627, 627],
    ground: grounds[kind][rotation],
    chimney: kind==="butcher"?([[414,25],[237,24],[250,30],[292,31]] as const)[rotation]:kind==="hunter"?([[215,83],[427,80],[210,115],[435,116]] as const)[rotation]:kind==="brickworks"?([[458,50],[450,55],[208,52],[173,48]] as const)[rotation]:chimneys[kind]?.[rotation],
    mechanism: mechanisms[kind]?.[rotation],
  };
}
