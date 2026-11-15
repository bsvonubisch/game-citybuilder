# Crop fields

The single Farm build item replaces the old wheat-farm sprite and automatic
production timer. Drag an inclusive 1×1 through 10×10 rectangle, then choose
wheat, potatoes or carrots in the farm details. A new farm has no selected crop
and shows an amber leaf badge linking to this choice; it assigns no farmers yet.
The complete plot must be level, dry and clear of roads or other buildings.
Surface deposits are cleared by builders before the field opens. Any edge can
connect to the warehouse road network. Gold and wood scale with area; staffing
grows to at most twelve farmers. Clear land opens immediately. A rocky field
opens after its remaining rocks are cleared, with no additional construction
timer. Loading old farms removes that extra wait while retaining unfinished
rock clearing and its partial progress. Equipment upgrades keep their own labour.

Each tile has four independent patches. An assigned resident must reach the
field, walk to a patch and plant it. Seeded patches grow with simulation time,
including overnight. Growth takes five times the initial release: wheat 375,
potatoes 475 and carrots 325 seconds at 1×, including 60 seconds as seedlings.
Farmers plant adjacent patches without returning to the entrance each time.
They finish sowing the entire plot before starting its harvest pass. A farmer
then harvests each ripe patch and carries its yield
back to the field entrance before it enters inventory. Harvested patches return
to soil; replanting waits until this harvest pass finishes. This prevents a big
farm from repeatedly growing only its first row. Storage reservations prevent
workers from overfilling it. Crop changes apply at the next sowing after the
existing harvest is collected, preserving its identity, cargo and inventory.
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
- A fully staffed 10×10 simulation must sow all 400 patches before harvesting.
  New unselected fields, queued crop changes and removal of the old preparation
  wait are covered by save/reload checks.
- These are desktop browser and mobile-viewport checks, not physical-phone tests.
