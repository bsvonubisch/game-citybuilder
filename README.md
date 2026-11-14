# Little Works — Pine & Copper

[Play the game](https://vu-citybuilder.web.app) · [Source repository](https://github.com/bsvonubisch/game-citybuilder)

A playable browser city-building foundation. Phaser 3.90 + TypeScript + Vite, with Firebase Authentication, private Firestore cloud saves, and Firebase Hosting deployment configuration.

The selected art direction is **Pine & Copper architecture + Garden Streets trees + Alpine Slate terrain + Clear Brook water**. Buildings, trees, villagers, vehicles, ground textures, and resource rocks use generated pixel-art assets.

## Run

Use Node 22 or newer.

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and set `VITE_FIREBASE_CONFIG` to the Firebase web configuration JSON to enable account features locally. The game runs without Firebase configuration.

```sh
npm test
npm run test:rules
npm run build
```

## Playable now

- Isometric 28×28 valley; pan, zoom, grid, building inspection, and speed controls.
- Detailed Alpine Slate paving, continuous meadow grass, and Clear Brook water with shallow riverbed stones, banks, and reeds. Terrain retains four source pixels per world pixel through the maximum zoom.
- Use Road (R) over water to build wooden bridges: 35 gold per water tile. Raised decks, ramps, capped railings, and support posts follow the road connections. Cars, pedestrians, and delivery trucks cross at deck height; existing roads over water become bridges automatically.
- All eleven buildings rotate four ways in the build or Move preview (R or Rotate). Select a built building and choose Move to relocate it with its identity, inventory, production progress and tier intact. The inspector has no separate rotation action. Occupied roads, buildings and water block an invalid move.
- New buildings begin as dirt construction sites with modular timber scaffolding and material stacks sized to their footprint. Unassigned residents walk to the site, remain visible there and use dedicated hammering/digging sprite cycles. Only builders who have arrived contribute labor. Site badges and inspectors show progress, assigned builders, on-site builders and remaining work. Houses open after completion; upgrades retain their existing residents and take longer at higher tiers (300 / 600 worker-seconds). Construction saves and moves retain completed labor.
- The front entrance determines road access. A front edge and arrow show green when a road reaches that side and amber when it does not. The entrance road must connect to a warehouse for employment and production.
- Pedestrian walk cycles, turning vehicle wheels, windmill sails, working saw/conveyor details, hearth smoke, fountain droplets, and gentle water glints. Pause and speed controls apply to animation as well as the simulation.
- Full paved lots cover explicit 2×2, 3×2 and rotated 2×3 footprints. Building art uses uniform scale and translation only, retaining its original proportions; the separate flat paving follows the grid. Existing towns retain occupied plots, buildings, residents and inventories.
- Cars and trucks use right-hand lanes, safe following distances, continuous collision checks and fair junction reservations. Vehicles wait inside buildings until there is room to enter the road. Click a pedestrian or vehicle to inspect its destination, route and cargo.
- Plant and remove oak, pine, birch and blossom trees, benches, streetlights, flower planters and fences through Gardens & streets. Adjacent fence tiles join automatically into runs, corners, T-junctions and enclosures; removal updates both neighbours. Decorations persist in device, exported and cloud saves.
- Clear Brook water flows beneath fixed shorelines and bridge decks. Bridge support pilings render beneath opaque decks, with separate upper railing posts. A front entrance on the bank opens the adjoining railing and adds a matching ramp; side and rear walls keep their rails.
- Houses have three tiers with distinct four-direction artwork: Timber cottage (3 residents), Townhouse (6) and Grand house (9). Select a connected home to upgrade in place. The townhouse costs 180 gold, 12 wood and 10 stone; the grand-house upgrade costs 420 gold, 16 planks, 20 stone and 8 metal. Families, plot and orientation remain intact. Old saves default to tier 1; upgraded houses persist in all save formats.
- Residents walk or drive between home and assigned workplaces. Cars have stable bodies with animated wheel details. Road routing uses breadth-first search; disconnected or understaffed factories stop. Explore mode leaves hovered empty tiles clear; selected buildings show their full footprint and front entrance. Construction and removal retain their placement guides.
- Building badges flag missing front roads, disconnected warehouse routes, full output storage, missing workers or ingredients, paused production, and exhausted deposits. Hover or keyboard-focus for an explanation; click to inspect. Badges clear as their issue resolves and never intercept construction clicks.
- Selecting a production building shows directional road routes to suppliers (teal) and destinations (gold), including bridge heights and front entrances. Matching cargo deliveries and assigned travelling workers (purple) are highlighted live. Its inspector lists partners, route problems, delivery counts and worker names; select a partner to follow the supply chain. Road searches are cached until the selection or network changes.
- Traffic reserves adjacent junction tiles together, releases crossings before the next stop line, and gives waiting departures priority by queue age. Vehicles keep safe gaps while merging; opposing traffic cannot hold nearby crossings against each other indefinitely.
- The header holds the town name, day, season, save status and expandable town progress. A Builders / needed counter totals assigned builders and demand from unpaused construction sites, including sites awaiting road access. The bottom toolbar opens a horizontal build catalog, town inventory and terrain controls; it stays compact in Explore with no idle hint. The top-left minimap outlines the visible area and follows camera panning, zooming and resizing.
- The resource bar shows employed residents / total residents, updated from real job assignments. Hover for the number without a job; the same breakdown is available in Your town.
- Shoreline fisheries occupy two land and two water tiles, with a stone-based hut and timber pier. Four-direction fishing boats sail along clear water routes and return catches to the pier; click a boat to see its route, destination and catch. Fish are delivered to warehouses and feed citizens alongside bread. The top Food counter shows stored meals and daily demand. See `docs/FISHERY.md` for placement and art details.
- Gold, wood, stone, and metal construction costs. Quarries and metal mines use finite deposits. Delivered warehouse inventory pays material costs.
- Farm → mill → bakery → warehouse. Forester → sawmill → workshop → warehouse. Vehicles move inventory in transit, and delivered tools sell for gold.
- Daily bread consumption, household income, and basic happiness from food and parks.
- Device autosaves, JSON export/import, Google or anonymous authentication, and manual private Firestore cloud save/load.

## Controls

Choose a building, rotate it with R or Rotate, then click an empty plot. The preview shows the full footprint and a front entrance arrow: green for road access, amber for a missing entrance road. Click buildings, people, cars or decorations while exploring to inspect them. Hold Space and drag, right-drag, or use WASD/arrow keys to pan; scroll to zoom. V explores, R rotates the building being placed or moved (otherwise selects roads), B opens the build catalog, U opens town statistics, T selects terrain, X removes, G toggles the grid, and Escape or right-click cancels a tool. Connect bridges to roads at both banks; open-water ends make piers.

## Firebase & GitHub

See [Firebase setup](docs/FIREBASE.md). GitHub Actions reads `FIREBASE_WEB_CONFIG` for test/build artifacts. Deployment uses the Firebase CLI with the owner's existing sign-in, matching the Spyfall workflow. No deployment service-account secret is required for this approach. No admin key belongs in the repository or browser bundle.

## Architecture

- `src/catalog.ts`: resources, recipes, prices, and footprint sizes.
- `src/simulation.ts`: serializable, deterministic 250 ms simulation, commands, occupancy, routing, production, and logistics. No DOM, Phaser, or Firebase dependency.
- `src/gateway.ts`: command boundary used by the interface.
- `src/scene.ts`: Phaser rendering, asset atlas frames, camera, picking, and overlays.
- `src/building-art.ts` / `src/plot-art.ts`: four-view art for buildings and house tiers, rigid sprite fitting, separate paved lots and animation anchors.
- `src/fences.ts` / `src/fence-art.ts`: automatic cardinal fence connections and cached timber geometry.
- `src/traffic.ts`: right-hand lanes, continuous swept collision checks, junction queues and entry spacing.
- `src/decorations.ts`: persisted decorations and one-time migration of procedural scenery.
- `src/rendering.ts`: ground fitting and smooth road movement between simulation ticks.
- `src/terrain-art.ts`: detailed cached terrain chunks, slate curbs, and shoreline transitions.
- `src/water-art.ts`: one animated water texture masked to the lake silhouette.
- `src/bridges.ts` / `src/bridge-art.ts`: shared deck elevation, road connections, and cached textured bridge geometry with separate rail depth layers.
- `src/animation.ts`: walking frames, vehicle details, projected mill rotor, and working-building effects.
- `src/main.ts`: interface, local saves, and interaction wiring.
- `src/cloud.ts`: Firebase initialization, account login, and private save storage.
- `tests/simulation.test.mjs` / `tests/traffic.test.mjs`: economy, entrance access, rotations, full footprints, decoration persistence, migrations, traffic queues and continuous collision regressions.

Terrain and roads are baked at 4× resolution into chunks no larger than 2048×2048 pixels when the town changes. Bridge geometry is cached by neighbor connections; the grid and mill rotor frames are cached separately. Static paving geometry is not replayed every frame. Agents and effects render continuously between the deterministic 250 ms ticks, including road turns and pauses. Add `?perf=1` to show a rolling FPS/frame-time counter; add `?qa=performance&perf=1` to measure in an isolated local-save slot. The visual footprint audit at `/tests/footprints.html` is available through the dev server.

Artwork defaults to Automatic scaling: smooth below 200% zoom and crisp for close-ups. Zooming back out restores smooth at 185%; this small gap prevents flicker near the transition during a pinch. Settings → Artwork scaling also offers fixed Smooth and Crisp pixels modes, applied immediately and remembered on this device. Camera positions remain continuous in every mode to avoid snapping while panning or following moving agents. Filter changes happen only at a transition, and also apply to newly created textures and refreshed terrain/foundation canvases. Source sprites retain their full resolution; this is texture filtering, not a blur over the screen.

## Current scope

This is a single-player foundation, not live multiplayer. Firebase account/save code is implemented; project-specific provider setup and an authenticated Firebase CLI are required. Firestore ownership, schema, and shared-world isolation rules are covered by emulator tests (Java 21 required). See [the multiplayer plan](docs/MULTIPLAYER.md) for the authority and synchronization boundary.

The economy is intentionally forgiving and not balanced for a full game. Traffic uses a deterministic road model rather than a general physics engine; pedestrians use the pavement edge. Seasons, terrain editing, power, zoning, and advanced logistics are future work. Elevated roofs and tree canopies may visually occlude neighboring ground. Foundation corners determine plot alignment; atlas padding does not. Save schema 3 adds decorations and explicit legacy plot dimensions, and migrates versions 1 and 2. Local version 2 saves are backed up before the entrance upgrade.

### Terrain and touch controls

Terrain (T) provides 1–5 tile square brushes for adding water, filling ground, raising, lowering and leveling. Drag vertically to preview height changes before release, or tap the map and press Apply on touch screens. Raise affects the lowest selected terrace, Lower the highest; Level uses the selected center. Water fills at river level and spreads through connected depressions. Costs are previewed; buildings, roads and placed garden objects are protected from flooding. Undo restores the latest terrain edit and refunds its cost. Terrain persists in local, exported and cloud saves. Flat building foundations are required; roads can climb one height step at a time.

The brush and vertical drag interaction are inspired by the [RollerCoaster Tycoon 2 manual](https://cdn.akamai.steamstatic.com/steam/apps/285330/manuals/manual.pdf). This implementation uses terraced tile heights, rather than RCT's individual corner-slope controls.

On phones, the build catalog becomes a drawer. One finger drags the map in any tool; two fingers pan and pinch around their midpoint. Releasing a gesture never places or removes a building. Tap to select or build. Warehouse planks and employed/total residents appear in the resource bar; swipe the bar to see additional stocks on narrow screens. Sawmills deliver planks to warehouses as well as workshops, so grand-house upgrades can use produced materials.
