# Tree variation

Generated with the built-in image tool on 17 November 2026. Source atlas:
`public/tree-variants-v1.png`, using `garden-sprites.png` as the style and
species reference. The original trees remain available. Final prompt:
`docs/tree-variants-prompt.txt`.

The new transparent atlas has four equal columns and four rows. Frame order:
0–1 oak; 2–3 pine; 4–5 birch; 6–7 blossom; 8–11 maple; 12–15 willow.
Existing species have three appearances including their original sprite;
maple and willow have four each, for twenty appearances total. Frames are
alpha-trimmed once at loading. Runtime scaling is uniform, anchored at the
trunk base, at the existing species heights (54–66 world pixels).

Each planted tree stores its variant. A deterministic pseudo-random planting
sequence excludes the previous variant of the same species, even across tool
switches, removal and save/load. Failed placement and elapsed time do not
advance the sequence. The ghost uses the same choice as the simulation.
Existing natural trees receive a stable ID-based variant; previously planted
trees retain their original appearance. View rotation and regrowth keep the
same variant. New species use the shared tree rules for forestry, pathing and
inspection; planted trees remain protected from foresters.

Fresh towns and existing saves also receive a one-time `woodlandVersion: 1`
species refresh. Some natural trees become maples or birches; willows favor
water edges. Positions, tree IDs, stumps, regrowth deadlines, planted garden
trees, removed trees and the player's entire town layout remain unchanged.
The refreshed natural trees use the new atlas views. This replaces the earlier
behavior that left the captured starter town's species unchanged.

Checked all twenty appearances in the actual renderer and all four camera
turns, the placement ghost against its placed result, and runtime errors.
Regression tests cover non-repetition, save/load, invalid variants, rotation,
regrowth, forestry protection, mining and hunting. No new per-frame texture
generation or source-art warping is used.
