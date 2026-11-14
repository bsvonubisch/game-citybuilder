# Shoreline fishery

Available in Build → Make & gather. Costs 180 gold, 12 wood, 4 planks and 6 stone; needs 220 worker-seconds to construct and two workers to operate. Fish are delivered by truck to warehouses and can satisfy daily food needs alongside bread. One food feeds three residents per day. The Food counter reports warehouse food; its tooltip separates bread and fish, daily demand and the previous day's coverage. Town inventory includes fish in buildings and deliveries.

The 2×2 plot contains exactly two land tiles at the entrance and two water tiles behind. Rotate during placement or moving to match the shore. Land must be at water level. The blue preview cells indicate the water half, sand cells the land half. Occupancy, road access, terrain protection, save validation and moving all use this same layout. Construction dirt and builders stay on land; the water half has a timber pier. Moving preserves inventory and completed labor.

The hut is a rigid transparent cutout on a 2×1 land rectangle (or 1×2 after a quarter turn). Its land foundation shares the other buildings' stone material, height and density. The pier uses the bridge timber material and covers exactly the water rectangle. Supports are drawn before the opaque deck so hidden pilings cannot appear through it. All four directions use distinct views and the correct land-facing entrance.

## Generated art

Each completed fishery has one four-direction fishing launch. A staffed, connected fishery sends it along a reserved open-water route, fishes for ten seconds and brings three fish back to the pier. Catch is counted aboard while returning and enters the building's inventory only on arrival. Leave at least three connected open-water tiles beyond the pier. Routes avoid land, bridge decks, buildings, other piers and occupied boat corridors. Building and terrain edits protect active routes. Pausing preserves the trip; moving or removing a fishery recovers its catch. Trips, partial work and catch survive saves.

Click a boat or select its fishery to see its blue route, destination and catch aboard. Directional artwork follows travel and reverses for the return trip. Wakes animate behind moving boats, with ripples while fishing. Position interpolates between simulation ticks without moving the hull up and down.

Boat asset: `public/fishing-boats.png`, generated with the built-in image tool from `exec-dd742bec-fddd-432f-8717-a9facc47e439.png`. Prompt: create a transparent 2×2 atlas of the same compact wooden fishing launch in four distinct isometric directions (southeast, southwest, northwest, northeast). Match the fishery's cozy detailed pixel art: honey timber, teal gunwale, cream canopy, copper lantern, fishing net and fish crate, with a straw-hatted fisher in a green vest. Keep equal scale and complete padding; no water, wake, ground, haze, text or surrounding scene. Wakes are rendered separately in the game.

Built-in image generation was used. Final asset: `public/building-fishery.png`, from `exec-0bdaa67a-0319-4ea1-ba1f-1473a12f7d20.png`. Style reference: `public/building-warehouse.png`. Initial source: `exec-0ea014f3-9def-4eb2-83ae-1d7fea20fd94.png`.

Initial prompt: create four quarter-turn views of the same low, elongated fishermen's hut, a 2:1 rectangular plan, in a transparent 2×2 atlas. Match the warehouse's crisp cozy pixel art, dark teal shingles, honey timber, warm windows, copper lantern and narrow wall footing. Add a drying net, creel, rope coil, silver fish crate and fish-shaped sign without text. No platform, dock, land, water, surrounding ground, shadows or people. Standard 2:1 isometric ground axes, upright verticals, equal scale and complete padding in every view.

Correction prompt: preserve the atlas, architecture, scale, materials and directions. Move the top-row main entrances from the short gable walls to the center of the long walls. Close the short walls with timber and a small window, and place the lantern and sign beside the new entrance. Bottom views show the opposite long wall with the entrance hidden. Preserve consistent fishing props and transparent surroundings.

Verification includes all four shoreline directions, dry/wet/raised/occupied rejection, construction and material charges, terrain protection, moving and save roundtrips, actual truck delivery, mixed-food consumption and shortages. The visual gallery at `tests/footprints.html?kind=fishery` shows the four composed hut/pier views.
