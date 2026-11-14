import type { Resource } from "./catalog.js";

/** Permanent geology. Extraction removes a layer, never the deposit location. */
export const DEPOSITS: Record<string, "stone" | "metal"> = {
  "19,4": "stone",
  "19,7": "metal",
  "17,5": "stone",
  "19,5": "metal",
  "4,19": "stone",
  "20,20": "metal",
  "9,22": "stone",
  "15,3": "metal",
  "6,32": "stone",
  "16,36": "metal",
  "4,44": "metal",
  "12,49": "stone",
  "19,55": "metal",
  "5,59": "stone",
  "34,5": "stone",
  "43,9": "metal",
  "53,4": "stone",
  "59,16": "metal",
  "37,19": "metal",
  "47,23": "stone",
  "56,29": "metal",
  "35,32": "stone",
  "42,36": "metal",
  "60,40": "stone",
  "35,46": "metal",
  "41,54": "stone",
  "52,58": "metal",
  "59,53": "stone",
};
export const INITIAL_RESERVE = 6000;
export const isExtractor = (kind: string) =>
  kind === "quarry" || kind === "mine";
export function deeperLayer(depth: number) {
  const next = depth + 1;
  return {
    depth: next,
    reserve: INITIAL_RESERVE * (next + 1),
    cost: 300 + next * 150,
    materials: { planks: 12 + next * 4, metal: 6 + next * 2 } as Partial<
      Record<Resource, number>
    >,
    labour: Math.min(1200, 240 + next * 120),
  };
}
