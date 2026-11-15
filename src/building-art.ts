import type { BuildingKind, HouseTier } from "./catalog.js";
import { fisheryLayout } from "./shoreline.js";
export type GroundPoint = readonly [number, number];
export type PlotCorners = readonly [GroundPoint, GroundPoint, GroundPoint];
export interface BuildingArt {
  livestock?:'cattle'|'chickens'|'pigs';
  contacts?: readonly GroundPoint[];
  /** Shared atlas density: rotating a building never enlarges its windows. */
  scaleLimit?: number;
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
const grounds: Partial<Record<
  Exclude<BuildingKind, "fishery"|"garden"|"market">,
  readonly PlotCorners[]
>> = {
  butcher:[[[76,389],[311,507],[551,387]],[[76,389],[311,507],[551,387]],[[76,389],[311,507],[551,387]],[[76,389],[311,507],[551,387]]],
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
  tavern:[[458,31],[172,32],[458,33],[171,36]],
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
  mine: [
    [194, 35],
    [243, 27],
    [295, 36],
    [270, 38],
  ],
};
const mechanisms: Partial<Record<BuildingKind, readonly GroundPoint[]>> = {
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
};
/** Geometry-guided redraws: equal cells within each atlas, direct SW/SE/NE/NW order.
 * Keep source anchors here; the renderer uses one measured scale for all views. */
const redrawn: Partial<Record<BuildingKind, {
  size?: readonly [number,number];
  ground: readonly PlotCorners[];
  chimneys?: readonly GroundPoint[];
  mechanisms?: readonly GroundPoint[];
}>> = {
  warehouse:{ground:[[[110,440],[307,508],[496,430]],[[130,430],[321,508],[518,440]],[[113,420],[311,489],[498,420]],[[130,420],[319,489],[514,420]]]},
  hunter:{ground:[[[126,429],[313,497],[489,429]],[[137,429],[319,497],[502,429]],[[126,430],[314,499],[490,430]],[[137,430],[319,499],[502,430]]],chimneys:[[299,110],[298,111],[298,86],[299,88]]},
  forester:{size:[887,443],ground:[[[345,355],[510,402],[711,332]],[[170,332],[373,402],[548,355]],[[350,350],[510,402],[711,332]],[[170,332],[373,402],[548,350]]],chimneys:[[528,62],[353,62],[528,61],[353,61]]},
  cottage:{ground:[[[126,409],[309,490],[488,409]],[[130,409],[313,490],[490,409]],[[124,405],[307,481],[490,405]],[[130,405],[313,481],[490,405]]],chimneys:[[309,54],[310,54],[309,54],[310,54]]},
  church:{ground:[[[95,467],[264,529],[523,407]],[[75,407],[345,529],[515,467]],[[90,461],[250,538],[522,418]],[[79,418],[349,538],[518,461]]]},
  sawmill:{ground:[[[109,439],[327,510],[505,432]],[[121,432],[307,510],[530,439]],[[110,408],[325,484],[505,408]],[[121,408],[307,484],[530,408]]],chimneys:[[322,96],[283,96],[311,79],[295,79]],mechanisms:[[217,387],[396,387],[0,0],[0,0]]},
  workshop:{ground:[[[119,419],[305,490],[485,418]],[[135,418],[316,490],[501,419]],[[119,420],[305,470],[485,420]],[[135,420],[316,470],[501,420]]],chimneys:[[296,99],[306,99],[298,75],[301,75]],mechanisms:[[225,409],[392,409],[0,0],[0,0]]},
  brickworks:{ground:[[[79,444],[294,520],[488,432]],[[136,432],[329,520],[543,444]],[[79,430],[295,505],[489,430]],[[136,430],[330,505],[543,430]]],chimneys:[[312,94],[288,94],[310,84],[289,84]],mechanisms:[[242,413],[359,413],[0,0],[0,0]]},
};
export function buildingArt(
  kind: BuildingKind,
  rotation = 0,
  houseTier: HouseTier = 1,
): BuildingArt {
  if(kind==='cattle'||kind==='chickens'||kind==='pigs')return{texture:'livestock-shelter',livestock:kind,frame:rotation,columns:2,rows:2,size:[512,512],ground:[[51,400],[256,502],[461,400]]};
  if(kind==='farm')return {texture:'farm-crops',frame:0,columns:3,rows:3,size:[512,342],ground:[[0,32],[32,48],[64,32]]};
  if(kind==="market")return {texture:"market-stalls",frame:rotation,columns:4,rows:3,size:[444,296],ground:[[0,148],[222,259],[444,148]]};
  const redraw=redrawn[kind];
  if(redraw)return {texture:`building-${kind}`,frame:rotation,columns:2,rows:2,size:redraw.size??[627,627],ground:redraw.ground[rotation],chimney:redraw.chimneys?.[rotation],mechanism:redraw.mechanisms?.[rotation]};
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
       kind === "mine" || kind === "quarry"
          ? [443, 443]
          : [627, 627],
    ground: grounds[kind]![rotation],
    chimney: kind==="butcher"?([[250,96],[338,97],[250,99],[338,100]] as const)[rotation]:chimneys[kind]?.[rotation],
    mechanism: mechanisms[kind]?.[rotation],
  };
}
