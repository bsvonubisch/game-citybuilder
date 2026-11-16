# Sprite acceptance standard

User requirement, November 15: check the actual geometry and physical scale of
new buildings so distorted source sprites, oversized windows and footprint
mismatches do not recur. This applies to new art and replacements.

## Fixed projection and physical scale

- The game uses orthographic **2:1 dimetric** projection: `iso(x,y) =
  ((x-y)*32,(x+y)*16)`. Horizontal ground-plane lines slope exactly ±0.5 on
  screen. It is not a perspective camera or a 30-degree isometric projection.
- Walls stay vertical. Parallel wall bases, sills, roof ridges, gutters, steps,
  ramps and counter tops must agree with the same two ground axes. Roof pitches
  and architectural diagonals are exceptions, not a reason to tilt the building.
- Start with a correctly projected geometry blockout. Examples are in
  `docs/art-guides/`. Paint material/detail onto those planes. Do not copy a
  distorted old sprite's geometry as the reference for a new one.
- Carry that same projection guide into every subsequent structural image edit.
  A successful first generation does not make a later regeneration safe. Compare
  the wall/base axes, parallel edges, roof planes, physical proportions and four
  views again before replacing it. Do not sacrifice correct projection to meet a
  single measurement. The November 16 chapel door-height revision flattened the
  roof, altered proportions and drifted from the earlier isometric geometry; the
  user explicitly rejected it. Keep the earlier steep-roof source, not that edit.
- Compare at **one fixed world zoom**, never separately fit each picture to a
  thumbnail. Pedestrians are about 22 world pixels tall. Ordinary entrance clear
  height should be about 24–28 world pixels and ordinary windows about 10–14.
  Warehouse loading doors and church windows can be deliberately larger; their
  masonry, handles and ordinary doors must still match the human scale.
- A larger plot does not imply larger windows, bricks, doors or people. Add
  rooms, storeys, yard space or machinery rather than scaling up every detail.

## One building, four views

- Use four actual quarter-turn views of one consistent structure. Room shape,
  roof geometry, chimney position, storeys, doors, windows and attached props
  must correspond around the building. Do not invent a different building on
  the rear frames or just mirror one side to supply every view.
- Rotation 0 entrance faces southwest; 1 southeast; 2 northeast; 3 northwest.
  Confirm the actual door with the game's frontage arrow. Explicitly map atlas
  frame order in `building-art.ts` where necessary.
- Keep one physical pixel density for all views. `resolvedBuildingArt` applies
  a shared scale ceiling; it must not enlarge a smaller rear silhouette just to
  fill the lot. This does not excuse inconsistent source geometry.
- Prefer equal atlas cells with generous clear padding. If cell boundaries are
  uneven, define `sourceRect` and measure that same rectangle. Never silently
  squash the actual source rectangle into assumed square dimensions.

## Footprint and stone foundation

- Source sprites have true transparent alpha, with no baked surrounding paving,
  grass, broad platform, cast ground shadow or painted smoke plume. Narrow wall
  masonry and entrance steps may remain. The engine supplies the full foundation.
- Use the shared **4-world-pixel** raised stone base and **six stones per tile**
  along each grid axis. Its lower outer edge covers the exact occupied footprint.
- The upright building stands on the top of that base. Ground-level props,
  barrels, ramps, stairs and stored materials must fit inside the footprint too.
  A roof may overhang naturally; ground clutter may not spill into a road.
- Measure real ground contacts from the correct source crop. Do not manufacture
  an ideal diamond that leaves actual ground props outside it. Runtime fitting
  is uniform scaling plus translation only, with no independent X/Y stretching,
  affine skew or screen rotation of the upright artwork.
- Reassess the footprint if the building and its working area do not fit
  naturally. Do not create a huge empty apron to hide a bad source image. Any
  footprint migration must preserve save data, frontage, inventory and workers.

## Characters and animated parts

- Match the established compact pedestrian proportions and approximately
  22-world-pixel height; don't introduce tall realistic characters beside them.
- Walking requires alternating contact/passing poses in every travel direction.
  A static sprite bobbing along a route is not a walk cycle.
- Anchor feet consistently and retain one body scale through an action; bending
  or reaching must not cause resizing or sliding. Serving is one small gesture
  per customer, not a continuously repeating full-body animation.
- Keep smoke, sails and other animated parts separate from the static building.
  Recalibrate all chimney/mechanism anchors after replacing an atlas. Check
  lighting, shadows, rear occlusion, thumbnails and placement ghosts as well.

## Required acceptance before publishing

1. Inspect the source atlas, including alpha and all four views, not just the
   generated preview. Reject a geometry failure and revise the source.
2. Inspect `tests/footprints.html` at common scale with the 22-pixel pedestrian,
   frontage arrow and footprint. Check each rotation against neighbouring roads
   and buildings, including steps and rear props. The gallery uses the production
   renderer; keep it current when introducing building types.
3. Check the placed building and build preview in the running game at normal and
   close zoom. Verify window/door scale, foundation contact and moving parts.
4. Run the build and relevant regression tests. Geometry tests are a guard
   against crop/fit mistakes; they cannot certify an artistically distorted wall.
5. Save the accepted asset, geometry guide, final prompt and atlas/anchor metadata
   in the repository. Record what was actually checked. Publish the ready stage
   before moving to the next queued task.

The current wider redraw follows the first shared-alignment correction. Do not
describe a render-position adjustment as a source-art redraw.
