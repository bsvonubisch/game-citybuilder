# Starter town

The new-game layout is the played local Pinehaven town captured on 2026-11-16.
`src/starter-layout.ts` contains only its buildings, rotations, plot sizes, upgrades,
crop choices, roads and materials, terrain edits, cleared deposits and decorations.
It contains the 73 captured buildings plus one 1×1 wayside chapel on the empty
roadside tile (19,26): 74 buildings, 273 road tiles and 1,593 decorations. The old shore fishery
already marked for demolition in the captured save is omitted.

`seedStarterTown` makes a fresh copy for each new game. It starts in the first
morning with 5,000 gold, food and construction supplies, two animals per pen,
fresh deposit reserves and established growing fields. Residents and work
assignments are generated normally. Saved trips, construction orders, statistics,
notifications and the previous town's accumulated wealth are not copied.

The layout is intentionally preserved, including the southern expansion: its
parks cover all 128 residents and its churches cover 122. Both foresters can
reach trees, with the larger woodland around the eastern lodge. Existing saves
never receive this template and are not reset by an update.

Validation: the starter-town tests verify the captured layout, frontages,
non-overlapping plots, fishery shores, worker availability, gathering access,
starter supplies, independent instances and preservation of existing saves.
