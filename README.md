# Little Works — Pine & Copper

[Play the game](https://vu-citybuilder.web.app) · [Source repository](https://github.com/bsvonubisch/game-citybuilder)

A playable browser city-building foundation. Phaser 3.90 + TypeScript + Vite, with Firebase Authentication, private Firestore cloud saves, and Firebase Hosting deployment configuration.

The selected art direction is **Pine & Copper architecture + Garden Streets**. Buildings, trees, villagers, and vehicles use generated pixel-art atlases; connected paving and terrain are drawn by the renderer.

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
- Explicit 2×2 and 3×2 building footprints. The entire footprint is validated against roads, buildings, water, and map edges; roads connect through the perimeter. Existing one-tile saves migrate without discarding buildings or their inventories.
- Cottages provide three named residents. Residents walk or drive between home and assigned workplaces. Road routing uses breadth-first search; disconnected or understaffed factories stop.
- Gold, wood, stone, and metal construction costs. Quarries and metal mines use finite deposits. Delivered warehouse inventory pays material costs.
- Farm → mill → bakery → warehouse. Forester → sawmill → workshop → warehouse. Vehicles move inventory in transit, and delivered tools sell for gold.
- Daily bread consumption, household income, and basic happiness from food and parks.
- Device autosaves, JSON export/import, Google or anonymous authentication, and manual private Firestore cloud save/load.

## Controls

Choose a building in the sidebar, then click an empty plot. Click a building while exploring to inspect it. Hold Space and drag, right-drag, or use WASD/arrow keys to pan; scroll to zoom. V explores, R lays roads, X removes, G toggles the grid, and Escape cancels a tool.

## Firebase & GitHub

See [Firebase setup](docs/FIREBASE.md). GitHub Actions reads `FIREBASE_WEB_CONFIG` for test/build artifacts. Deployment uses the Firebase CLI with the owner's existing sign-in, matching the Spyfall workflow. No deployment service-account secret is required for this approach. No admin key belongs in the repository or browser bundle.

## Architecture

- `src/catalog.ts`: resources, recipes, prices, and footprint sizes.
- `src/simulation.ts`: serializable, deterministic 250 ms simulation, commands, occupancy, routing, production, and logistics. No DOM, Phaser, or Firebase dependency.
- `src/gateway.ts`: command boundary used by the interface.
- `src/scene.ts`: Phaser rendering, asset atlas frames, camera, picking, and overlays.
- `src/main.ts`: interface, local saves, and interaction wiring.
- `src/cloud.ts`: Firebase initialization, account login, and private save storage.
- `tests/simulation.test.mjs`: economic, routing, persistence, migration, and collision regressions.

## Current scope

This is a single-player foundation, not live multiplayer. Firebase account/save code is implemented; project-specific provider setup and an authenticated Firebase CLI are required. Firestore ownership, schema, and shared-world isolation rules are covered by emulator tests (Java 21 required). See [the multiplayer plan](docs/MULTIPLAYER.md) for the authority and synchronization boundary.

The economy is intentionally forgiving and not balanced for a full game. Vehicles follow routes without traffic queues or physical vehicle collisions. Residents currently use static directional sprites with movement bobbing; full walk animation cycles, seasons, terrain editing, power, zoning, and advanced logistics are future work. Decorative tree canopies can overhang neighboring ground; building base footprints cannot overlap roads.
