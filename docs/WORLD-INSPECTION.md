# Inspecting map objects

Map selections use the existing details panel. Toasts acknowledge actions; they
are not a substitute for persistent object details.

- Roads, bridges and pavements show their actual surface, access and speed.
  Extend the route with the main action; change surfaces or remove roads through
  More actions. A road under construction opens its crew panel, just like its badge.
- Deposits show the remaining reserve, layer, exposed tiles and reachable
  workplaces. Reachability uses the mining pathfinder, not distance alone.
  Link to an existing workplace or offer to build the correct extractor.
- Wild deer are selectable, show their current activity and nearby hunting
  lodges, and have a selection ring that follows their movement. Close their
  details when the animal is no longer visible; do not expose respawn timers.
- Trees and decorations use the same status/facts/guidance/action layout. Tree
  growth is live; removal is a secondary action, with permanent stump removal
  explicitly named.

`world-inspection.ts` reads the authoritative simulation. Selections store
canonical map coordinates or stable IDs so they survive camera rotation. The
scene projects their highlights and picks the frontmost visible interactive
sprite. Selecting a different object, clicking empty ground, changing tools or
replacing the town clears the previous inspection.

Keep one main action and put optional actions under More actions. Preserve the
existing desktop side panel and mobile bottom sheet. New object types should
follow this pattern instead of adding selection toasts or separate menus.

Verification: model tests cover bridge materials and pedestrian access, deposit
depletion/clearance and blocked routes, wildlife removal, and tree regrowth.
Browser checks cover actual sprite/tile clicks, four road-view rotations, live
updates, placement actions, roadwork handoff, building selection, and mobile layout.
