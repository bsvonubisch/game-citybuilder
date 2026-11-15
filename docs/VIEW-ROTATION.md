# Town view rotation

The minimap's left/right controls turn the view by 90 degrees. The camera stays
over the same location. The chosen view is stored locally, independently of the
town save and multiplayer state.

`ViewWorld` is a read-only projection of the authoritative `Simulation`. It maps
ground coordinates, building footprints/frontages, paths, field patches and
decoration edges into the selected view. Upright sprites use their existing four
directional frames; never rotate, shear or stretch an upright image on screen.

Rendering and canvas picking use view coordinates. Commands pass through
`scene.view.command` exactly once before reaching the gateway. UI actions that
focus a tile, including town-log entries, use canonical world coordinates.
Commands that address an entity by ID are unchanged. Never save the projected
world or run job allocation/traffic logic against it.

Preview planners run against the original world, then project their results.
This preserves L-shaped road ties, even-sized terrain brushes and fixed deposit
locations. Placement previews have no original entity, so `sourceBuilding`
converts their origin, footprint and entrance direction explicitly.

Projected entities retain object identity; paths and terrain are cached. Removed
entities are pruned. A view change invalidates scenery, lighting, route and badge
caches. Farm patches and workers retain their physical positions and progress.

Validation covers all four footprints and entrances, placement/moving with stock
preserved, road/terrain previews, mining reach, crop patches, lamps/fences, live
traffic and unchanged save snapshots. Browser checks cover rectangular dragging,
selection, minimap navigation, mobile controls and persistence after reload.
