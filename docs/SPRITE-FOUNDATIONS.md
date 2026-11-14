# Shared foundations and directional art

Generated with the built-in image generation tool. All project assets are in `public/`; the renderer composes them once per building view at 4× resolution and caches them.

## Geometry and footprints

Every land building now uses the same four-world-pixel raised stone foundation, with six stones per tile along both grid axes. Its lower outside corners coincide exactly with the occupied footprint. Building artwork uses only uniform scaling and translation; no shearing, rotation of the upright image, or independent axis scaling. Menu thumbnails use the same composition as the game.

The sawmill, warehouse, copper workshop and wheat farm now use compact 2×2 plots, matching the near-square ground envelopes of the art. All current buildings occupy 2×2. The shoreline fishery uses this shared stone base only on its land half, with a timber pier over the other half. The rendering/placement system still supports rectangular footprints for future larger buildings. Old six-cell lots shrink only inside their previously occupied area; the preferred retained area keeps their road frontage. IDs, stocks, work, enabled state, residents and money are retained. Local saves are backed up before this migration.

## Assets

| Asset | Generated source |
|---|---|
| `public/building-house.png` | `exec-2ae6ddbd-d4cc-4190-9468-600a7dd3920f.png` |
| `public/building-house-2.png` | `exec-ec21c3ed-fb21-435a-ba2f-43a62c7f0db6.png` |
| `public/building-house-3.png` | `exec-3e99cde1-d721-4854-93aa-cdcc05a750ec.png` |
| `public/building-farm.png` | `exec-90ae9a1c-fdbc-4b47-91c1-f763f873adf3.png` |
| `public/building-forester.png` | `exec-a5d4ee57-9123-4adb-825f-68dc673b392d.png` |
| `public/building-workshop.png` | `exec-6e754055-6b05-44b1-9e83-c3b4fb902081.png` |
| `public/building-bakery.png` | `exec-2fa31832-07d1-491b-87b8-8562ec29c100.png` |
| `public/building-quarry.png` | `exec-08baf09a-8b45-49cf-980b-412c2266942f.png` |
| `public/building-mine.png` | `exec-b3e764d1-3f29-431f-91df-844a8d124432.png` |
| `public/building-mill.png` | `exec-b2711f43-d95f-4638-b396-f423b8c81c5e.png` |
| `public/building-warehouse.png` | `exec-4809bdc1-3fe4-45eb-87d5-c83aa4a014f7.png` |
| `public/building-sawmill.png` | `exec-c13aa144-18cc-4bd6-80b9-2e6127868f0a.png` |
| `public/park-parts.png` | `exec-d6d90ae8-f682-4aa9-9503-46b36956ed01.png` |
| `public/park-benches.png` | `exec-0b67359b-7a78-4d77-ae52-cb2808991da1.png` |
| `public/foundation-stone.png` | `exec-7d561941-04da-4ada-8a87-2a37081cd265.png` |

## Prompts

### Building cutouts (all building and house-tier atlases)

Edit this game sprite atlas for a shared foundation renderer. REMOVE the ENTIRE external paved ground platform under EACH building: all flat stone paving tiles, outer curb blocks, raised platform side faces, apron and cast ground shadows must become completely clear alpha=0. Keep the building itself and every individual prop (crates, barrels, sacks, wooden ramp, flowers, trees, fences, machinery) as separate clean cutout pixels at their EXACT existing positions and scale. Keep the narrow stone masonry wall footing directly under the walls and the entrance stairs; remove the broad surrounding flat platform only. Empty ground between all those objects must be fully transparent, no replacement dirt, no grass, no new base. The game will draw ONE consistent shared stone base under these cutouts. Preserve the exact atlas canvas proportions, cell layout, number of views, all building details, cozy pixel style, lighting, orientation and pixel scale. Do NOT crop/recenter/resize individual sprites or rearrange props. No text, no new background, no halo or haze, no gray backdrop. This is precise removal of ground/platform from the supplied sprites, NOT a redesign.

Sawmill addition: correct the slanted ground axes in the two right-hand views to standard 2:1 projection while retaining upright walls. A second extraction explicitly removed all green/brown diffuse background haze and shadows, preserving hard-edged building pixels and the 2×2 atlas.

Windmill addition: remove the incorrectly visible near-wall sail hubs from the two rear views and replace them with matching timber. The animated axle belongs on the far wall in those views; do not add sails to the building atlas.

### Plaza parts

Extract/recreate exactly four isolated objects from the original fountain plaza in a 2×2 transparent atlas: fountain, square wooden pink-and-white flower planter, pine tree, copper lantern on a short gray stone pillar. Preserve the cozy pixel-art details and colors. No ground/platform/shadows/haze. Consistent cell positions with generous transparent padding. The game assembles them from one fixed floor plan.

### Benches

Four views of the SAME three-seat-plank, three-backrest-plank wooden bench with cast iron arms and feet, in a transparent 2×2 atlas. Row 1: seats facing southeast then southwest. Row 2: seats facing northwest then northeast, with the backrest on the near side and seat partly occluded. Standard 2:1 isometric axes. Preserve the scale, parts and shape. No platforms, ground or haze.

The plaza floor plan contains one fountain, two benches, two identical square planters, one pine and two lantern pillars. Object positions and bench-facing vectors rotate together. Objects are sorted by ground depth. Counts, planter shapes and bench facing are tested for all four rotations.

### Foundation material

Create one seamless square top-down paving texture matching the paving around the original house sprites: warm gray limestone, muted rose-beige and ivory highlights, medium-gray fine mortar, softly worn chunky beveled edges, tiny pixel chips and mottling. Exactly six columns by six rows of roughly square stones in a regular pitch, with slight irregular outlines and subtle colors. Orthographic directly-above view; edge-to-edge seamless material. Match high-detail cozy pixel art. No buildings, objects, foliage, dirt, grass, platform outline, labels or background.

## Windmills

Each direction has its own hub location. The front two views draw sails ahead of the tower; the rear two draw them behind it, so the tower correctly hides the far-side blades. Sails use the same 2:1 projected vertical plane as the building and reverse phase for the rear view. Placement ghosts and thumbnails use the same direction settings.

## Verification

The local `tests/footprints.html` gallery displays all 56 views (12 types plus the two extra house tiers). Tests cover rigid sprite proportions, exact foundation bounds, equal tile density/height, plaza object counts and facing, windmill layering, migration preserving inventories/work/frontage, and normal construction/logistics/traffic behavior.

