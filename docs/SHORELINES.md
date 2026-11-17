# Shorelines on the actual grid

The water surface is now 12 world pixels below unraised land. This is a shared
rendering datum, not a change to saved terrain ownership or road routing.
Boats, wakes, fishing gear and water glints use it; dock pilings reach it.

Each land tile owns exactly its exposed land/water edges. The two front-facing
edges have a visible earth face; the back faces sit behind the land. Joined
edges share exact grid corners. Banks use the existing meadow, soil and
foundation materials at game scale. Natural shores have sparse reed clumps,
not repeated piles of stones. A land road on the shore automatically gets a
stone retaining face and coping, for every road material. Bridge entrances are
left open. Raised land extends the same bank down to the water datum.

The earlier illustrations are style concepts, not screenshots. This delivery
uses the real 2:1 grid and modest bank height; it does not promise their freeform
coast contours or exaggerated depth. No save migration is needed.

Checked in the running game: the starter waterfront with roads, bridge ramps,
fishery piers and boats; a concave inlet and small island through all four view
turns. Regression tests cover shared corner endpoints, roads becoming/removing
embankments, raised land and open bridge landings. Bank pixels are baked into
the existing terrain chunks on edits, with no per-frame bank texture uploads.

## Vegetation placement correction

Natural shoreline plants are rooted slightly inside the dry turf at the land's
actual elevation. They no longer use the water's lowered datum. Vegetation stays
off roads, bridge entrances, building plots (including fisheries), deposits and
occupied decoration tiles. The stone road embankments are unchanged.

Placement, size and atlas-frame selection are independent: the old spawn threshold
always selected the fourth reed image. All four existing grass/flower/reed clumps
now appear, with varied heights and sparse, evenly distributed spacing. Positions
are calculated in canonical map space, so camera turns do not reroll the shore.
No new textures or per-frame work were added.

## Inside-corner overlap correction

Flat bank faces are now painted together with their owning land tile, before
the next row of foreground ground. Painting every bank in a final pass let
rear soil cover the grass at stepped, concave shoreline corners. The tile
order now provides the same occlusion as the actual terrain geometry.

Verified with a stepped shoreline through all four camera turns. Three pixels
inside foreground grass previously contained brown bank material; after the
fix, each matches the same location in a grass-only reference exactly. Terrain
chunks retain their existing resolution, caching and filtering gutters.

Verified around the starter fisheries, shoreline corners and raised banks, with
four camera views and a narrow mobile viewport. Browser checks confirm roots use
land elevation, avoid buildings/roads and retain their world positions through
rotation. Six shoreline/bridge regression tests and the production build pass.
