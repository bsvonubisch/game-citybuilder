# Crop fields

Fields replace the old wheat-farm sprite and automatic production timer. Choose
wheat, potatoes or carrots, then drag an inclusive 1×1 through 10×10 rectangle.
The complete plot must be level, dry and clear of roads or other buildings.
Surface deposits are cleared by builders before the field opens. Any edge can
connect to the warehouse road network. Gold, wood and preparation labour scale
with area; staffing grows to at most twelve farmers.

Each tile has four independent patches. An assigned resident must reach the
field, walk to a patch and plant it. Seeded patches grow with simulation time,
including overnight. A farmer then harvests each ripe patch and carries its yield
back to the field entrance before it enters inventory. Harvested patches return
to soil for replanting. Storage reservations prevent workers from overfilling it.
Wheat enters the grain/flour/bread chain. Potatoes and carrots go to warehouses
or market stalls and satisfy the same daily food demand as other food.

Old farms become 2×2 wheat fields while retaining their inventory, building ID
and production total. Explicit rectangular fields bypass the old 3×2 sprite
footprint migration. Movement and rotation retain patch growth and inventory.
Reload settles any carried harvest exactly once before workers resume travel.
Saved fields validate crop type, dimensions, patch timestamps, task paths and
bounded cargo. No automatic terrain edits or changes to the user's town layout
are required to migrate.

## Art and rendering

Fields deliberately use soil at ground level, without a raised stone foundation.
The exact 2:1 footprint is assembled from a shared 256×128 earth tile, using the
existing construction-earth material. Plants are upright cutouts, never sheared.
All dimensions use the same plant density: four patches per tile. Crop types have
three source growth frames; bare soil is the fourth visible state. Workers use
the town's walking poses and a separate, foot-anchored planting/harvest bend.

The two generated source atlases and their exact prompts, layouts and scales are
recorded in `farm-art-prompts.json`. Both source images were visually inspected.
The footprint gallery uses the production renderer and the existing pedestrian
scale reference. Fields render individual shared sprites instead of retaining
a huge texture for every possible rectangular size; only the active placement
preview has a replaceable composite texture. Offscreen crop sprites are hidden.

## Verification

- Regression checks cover every size, four drag directions, matching prices,
  actual worker participation, all growth stages and all three supply chains.
- Food consumption, carried inventory, save migration, relocation/rotation and
  malformed-save rejection are covered.
- Browser checks exercise the real build menu, crop choice and 3×2 drag, inspect
  growing fields and working farmers, and check a 10×10 field at mobile size.
- These are desktop browser and mobile-viewport checks, not physical-phone tests.
