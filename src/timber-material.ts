/** Shared painted timber for bridges and fishery piers. Coordinates are measured
 * from the current atlas; keep deck density at six boards per world tile. */
export const BRIDGE_TIMBER = {
  key:'bridge-woodland',
  file:'/bridge-woodland-v1.png',
  deck:[1,1,1252,599],
  post:[6,850,40,250],
  beam:[72,663,480,34],
} as const;
