# Shorelines on the actual grid

The water surface is now 6 world pixels below unraised land. This is a shared
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
