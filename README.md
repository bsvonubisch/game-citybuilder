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
- Build wooden bridges with B: 35 gold per water tile. Raised decks, ramps, capped railings, and support posts follow the road connections. Cars, pedestrians, and delivery trucks cross at deck height; existing roads over water become bridges automatically.
- All eleven buildings rotate four ways before placement and after construction (R or Rotate). Rectangular plots rotate with the building; occupied roads, buildings and water block an invalid turn.
- The front entrance determines road access. A front edge and arrow show green when a road reaches that side and amber when it does not. The entrance road must connect to a warehouse for employment and production.
- Pedestrian walk cycles, turning vehicle wheels, windmill sails, working saw/conveyor details, hearth smoke, fountain droplets, and gentle water glints. Pause and speed controls apply to animation as well as the simulation.
- Full paved lots cover explicit 2×2, 3×2 and rotated 2×3 footprints. Building art uses uniform scale and translation only, retaining its original proportions; the separate flat paving follows the grid. Existing towns retain occupied plots, buildings, residents and inventories.
- Cars and trucks use right-hand lanes, safe following distances, continuous collision checks and fair junction reservations. Vehicles wait inside buildings until there is room to enter the road. Click a pedestrian or vehicle to inspect its destination, route and cargo.
- Plant and remove oak, pine, birch and blossom trees, benches, streetlights, flower planters and fences through Gardens & streets. Adjacent fence tiles join automatically into runs, corners, T-junctions and enclosures; removal updates both neighbours. Decorations persist in device, exported and cloud saves.
- Clear Brook water flows beneath fixed shorelines and bridge decks. Bridge support pilings render beneath opaque decks, with separate upper railing posts. A front entrance on the bank opens the adjoining railing and adds a matching ramp; side and rear walls keep their rails.
- Houses have three tiers with distinct four-direction artwork: Timber cottage (3 residents), Townhouse (6) and Grand house (9). Select a connected home to upgrade in place. The townhouse costs 180 gold, 12 wood and 10 stone; the grand-house upgrade costs 420 gold, 16 planks, 20 stone and 8 metal. Families, plot and orientation remain intact. Old saves default to tier 1; upgraded houses persist in all save formats.
- Residents walk or drive between home and assigned workplaces. Cars have stable bodies with animated wheel details. Road routing uses breadth-first search; disconnected or understaffed factories stop. Explore mode has no hover or selected-tile grid highlighting; construction and removal retain their placement guides.
- Gold, wood, stone, and metal construction costs. Quarries and metal mines use finite deposits. Delivered warehouse inventory pays material costs.
- Farm → mill → bakery → warehouse. Forester → sawmill → workshop → warehouse. Vehicles move inventory in transit, and delivered tools sell for gold.
- Daily bread consumption, household income, and basic happiness from food and parks.
- Device autosaves, JSON export/import, Google or anonymous authentication, and manual private Firestore cloud save/load.

## Controls

Choose a building, rotate it with R or Rotate, then click an empty plot. The preview shows the full footprint and a front entrance arrow: green for road access, amber for a missing entrance road. Click buildings, people, cars or decorations while exploring to inspect them. Hold Space and drag, right-drag, or use WASD/arrow keys to pan; scroll to zoom. V explores, R rotates the building being placed or inspected (otherwise selects roads), B selects bridges, X removes, G toggles the grid, and Escape cancels a tool. Connect bridges to roads at both banks; open-water ends make piers.

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

## Current scope

This is a single-player foundation, not live multiplayer. Firebase account/save code is implemented; project-specific provider setup and an authenticated Firebase CLI are required. Firestore ownership, schema, and shared-world isolation rules are covered by emulator tests (Java 21 required). See [the multiplayer plan](docs/MULTIPLAYER.md) for the authority and synchronization boundary.

The economy is intentionally forgiving and not balanced for a full game. Traffic uses a deterministic road model rather than a general physics engine; pedestrians use the pavement edge. Seasons, terrain editing, power, zoning, and advanced logistics are future work. Elevated roofs and tree canopies may visually occlude neighboring ground. Foundation corners determine plot alignment; atlas padding does not. Save schema 3 adds decorations and explicit legacy plot dimensions, and migrates versions 1 and 2. Local version 2 saves are backed up before the entrance upgrade.
