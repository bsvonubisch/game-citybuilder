# Livestock art and behavior

Pens use the same drag interaction as farms, with a 2×2 minimum and 10×10 maximum.
The authoritative plot controls collision, price, jobs, capacity, fences and preview.
Every pen begins with two animals. Grain and farmers physically on site enable
growth during daylight; more breeding pairs increase the birth rate. A full pen supplies surplus meat and retains at least two
animals. Milk and eggs are additional outputs. Herd state is saved and moves with
the pen; changing butcher cuts retains previous stock for delivery.

## Source art

- `livestock-cow.png`, `livestock-chicken.png`, `livestock-pig.png`: 1774×887,
  four equal columns and four rows. Rows face SE, SW, NW, NE. Columns are neutral,
  left step, right step, and feeding. Frame boundaries are rounded from sheet
  dimensions by `prepareActorFrames`. Transparent padding is measured once;
  feet remain anchored and each row shares a scale across its poses.
- Game heights: cows 20, pigs 12, chickens 7 world pixels; pedestrians are 22.
- `livestock-shelter.png`: 1254×1254, four 627×627 cells. Row-major directions
  SW entrance, SE entrance, NE rear, NW rear. Raw contact hints in each cell:
  `(52,482), (310,613), (570,482)`. Alpha measurements refine contacts and all four
  views share one uniform scale. No upright shearing or independent X/Y resizing.
- Geometry guide: `art-guides/livestock-shelter.svg` and matching PNG. One-tile
  timber shelter on the shared 4px stone foundation. Fences use exact tile edges;
  the entrance gate follows plot orientation. Meadow/soil reuse existing assets.

## Generation prompts

Animal sheets used `wildlife-deer.png` as a style and layout reference only:
“Four equal columns × four equal rows, sixteen isolated full-body animals,
generous transparent margins, no text, grass, floors or shadows. Same animal
markings and scale. Rows SE, SW, NW, NE; columns neutral, left contact, right
contact, head lowered eating. Actual leg poses, fixed baseline, orthographic
2:1 projection. Cozy detailed pixel art.” Species: brown-and-white dairy cow,
warm brown chicken, and small pink pig. The cow sheet required a transparency
correction: “Remove the white background from this exact 4 by 4 cow sprite atlas.
Preserve all sixteen cow sprites, exact positions and scale, markings including
white fur. Truly transparent alpha outside silhouettes. Same 2:1 canvas and grid.
No shadows, ground, padding changes or extra elements.”

Shelter prompt: “Use this exact geometric blockout as the immutable structure of
a small livestock shelter for the existing cozy pixel-art city-builder. Paint over
the four silhouettes, preserving all parallel lines, upright walls, exact 2:1
dimetric projection, identical dimensions, camera, row order and doorway positions.
A warm honey-brown timber animal shed with dark green wooden shingles, solid
framing, an open central stable doorway with hay visible, and a single small square
ventilation opening on the rear wall only. One practical shelter, four quarter-turn
views in a 2×2 equal-cell atlas, SW door top-left, SE door top-right, NE rear
bottom-left, NW rear bottom-right. Rich crisp detailed pixel texture matching old
cozy SNES town art, no outlines around the whole object. No added steps, barrels,
tools, people, fence, grass, broad base, platform, external shadows, smoke or ground.
Transparent background, generous padding; keep full bottom wall contacts within
each cell. This is a one-tile shed, not a huge barn: the opening is about human height.”

## Verification

Checked all four rotations in-game against streets, people, foundation and
footprints. Alpha coverage measured for every sheet; cow background corrected
before release. Tests cover minimum/maximum rectangular pens in every orientation,
growth requirements, capacity/breeding pair, saved herd state, movement and goods
routes. The new starter town includes all three pens with exactly two animals.
